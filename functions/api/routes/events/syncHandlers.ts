/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — GCal Sync Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getDb, getDbSettings } from "../../middleware";

import { pushEventToGcal, pullEventsFromGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { eq, and } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { HandlerInput, ApiResponse } from "@shared/types/api";

import {
    syncEventsRoute,
    repairCalendarRoute,
} from "../../../../shared/routes/events";

import {
    type AresContext,
    invalidateEventsCache,
} from "./eventHelpers";

export const syncHandlers = {
    syncEvents: async (_input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof syncEventsRoute>> => {
        const db = getDb(c);
        let oauthToken: string;
        try {
            oauthToken = await getUnifiedOAuthToken(c.env, db);
        } catch (_error) {
            throw new ApiError("Google OAuth not connected. Please connect your Google account in Settings.", 500);
        }

        try {
            const dbSettings = await getDbSettings(c);
            const internalId = dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"] || "primary";
            const outreachId = dbSettings["CALENDAR_ID_OUTREACH"] || dbSettings["CALENDAR_ID"] || "primary";
            const externalId = dbSettings["CALENDAR_ID_EXTERNAL"] || dbSettings["CALENDAR_ID"] || "primary";

            const uniqueCalendars = Array.from(new Set([internalId, outreachId, externalId]));

            // Fetch all local active (published, non-deleted) events
            const activeEvents = await db.select()
                .from(schema.events)
                .where(and(
                    eq(schema.events.isDeleted, 0),
                    eq(schema.events.status, "published")
                ))
                .all();

            // 1. Push all active local events to Google Calendar (reconciling/updating existing ones)
            const activeGcalIds = new Set<string>();

            for (const event of activeEvents) {
                try {
                    const cat = event.category || "internal";
                    const calendarId = (
                        cat === "internal" ? internalId :
                        cat === "outreach" ? outreachId :
                        cat === "external" ? externalId : null
                    ) || dbSettings["CALENDAR_ID"] || "primary";

                    const gcalId = await pushEventToGcal(
                        {
                            id: event.id,
                            title: event.title,
                            dateStart: event.dateStart,
                            dateEnd: event.dateEnd || undefined,
                            location: event.location || undefined,
                            description: event.description || undefined,
                            coverImage: event.coverImage || undefined,
                            gcalEventId: event.gcalEventId || undefined,
                            meetingNotes: event.meetingNotes || undefined,
                            recurrenceRule: event.rrule || undefined,
                        },
                        calendarId,
                        oauthToken
                    );

                    if (gcalId) {
                        activeGcalIds.add(gcalId);
                        if (gcalId !== event.gcalEventId) {
                            await db.update(schema.events)
                                .set({ gcalEventId: gcalId })
                                .where(eq(schema.events.id, event.id))
                                .run();
                            console.debug(`[syncEvents] Recreated event "${event.title}" on GCal (ID: ${gcalId})`);
                        } else {
                            console.debug(`[syncEvents] Updated event "${event.title}" on GCal (ID: ${gcalId})`);
                        }
                    }
                } catch (pushErr) {
                    const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
                    console.error(`[syncEvents] Failed to push/sync "${event.title}":`, msg);
                }
            }

            // 2. Identify all extraneous events on Google Calendar and delete them
            for (const calId of uniqueCalendars) {
                try {
                    const gcalEvents = await pullEventsFromGcal(calId, oauthToken);
                    for (const gcalEv of gcalEvents) {
                        if (gcalEv.gcalEventId && !activeGcalIds.has(gcalEv.gcalEventId) && !gcalEv.parentGcalId) {
                            console.warn(`[syncEvents] Extraneous event "${gcalEv.title}" (GCal ID: ${gcalEv.gcalEventId}) found on GCal. Deleting...`);
                            await deleteEventFromGcal(gcalEv.gcalEventId, calId, oauthToken);
                        }
                    }
                } catch (pullErr) {
                    console.error(`[syncEvents] Failed to reconcile/clean calendar "${calId}":`, pullErr);
                }
            }

            // Save the last calendar sync timestamp
            const nowIso = new Date().toISOString();
            await db.insert(schema.settings)
                .values({ key: "LAST_CALENDAR_SYNC", value: nowIso })
                .onConflictDoUpdate({ target: schema.settings.key, set: { value: nowIso } })
                .run();

            invalidateEventsCache(c);
            return { status: 200 as const, body: { success: true, count: activeEvents.length } };

        } catch (syncErr) {
            const msg = syncErr instanceof Error ? syncErr.message : String(syncErr);
            console.error(`SYNC_EVENTS: Calendar sync failed:`, msg);
            throw new ApiError(`Calendar sync failed: ${msg}`, 500);
        }
    },

    repairCalendar: async (_input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof repairCalendarRoute>> => {
        const db = getDb(c);
        const events = await db.select()
            .from(schema.events)
            .where(and(
                eq(schema.events.isDeleted, 0),
                eq(schema.events.status, "published")
            ))
            .all();

        if (events.length === 0) {
            return { status: 200 as const, body: { success: true, pushed: 0, failed: 0, message: "No events needing repair" } };
        }

        let oauthToken: string;
        try {
            oauthToken = await getUnifiedOAuthToken(c.env, db);
        } catch (error) {
            const msg = error instanceof Error ? error.message : String(error);
            console.error("[repairCalendar] OAuth token fetch failed:", msg);
            throw new ApiError(`Google OAuth not connected: ${msg}`, 500);
        }

        const dbSettings = await getDbSettings(c);
        let pushed = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const event of events) {
            try {
                const cat = event.category || "internal";
                const calendarId = (
                    cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                    cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                    cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                ) || dbSettings["CALENDAR_ID"] || "primary";

                const gcalId = await pushEventToGcal(
                    { id: event.id, title: event.title, dateStart: event.dateStart, dateEnd: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, coverImage: event.coverImage || undefined, gcalEventId: event.gcalEventId || undefined, meetingNotes: event.meetingNotes || undefined },
                    calendarId,
                    oauthToken
                );
                if (gcalId) {
                    if (gcalId !== event.gcalEventId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
                        console.debug(`[repairCalendar] Successfully pushed/re-created "${event.title}" on GCal (ID: ${gcalId})`);
                    } else {
                        console.debug(`[repairCalendar] Successfully updated "${event.title}" on GCal (ID: ${gcalId})`);
                    }
                    pushed++;
                } else {
                    const msg = `Google Calendar did not return an event ID`;
                    errors.push(`${event.title}: ${msg}`);
                    failed++;
                }
            } catch (pushErr) {
                const msg = pushErr instanceof Error ? pushErr.message : String(pushErr);
                console.error(`[repairCalendar] Failed to push "${event.title}":`, msg);
                errors.push(`${event.title}: ${msg}`);
                failed++;
            }
        }

        invalidateEventsCache(c);
        return {
            status: 200 as const,
            body: {
                success: true,
                pushed,
                failed,
                message: `Repaired ${pushed} events, ${failed} failed`,
                errors: errors.length > 0 ? errors : undefined
            }
        };
    },
};
