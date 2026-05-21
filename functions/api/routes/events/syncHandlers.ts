/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — GCal Sync Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getDb, getDbSettings } from "../../middleware";

import { pushEventToGcal, pullEventsFromGcal, type ARES_Event } from "../../../utils/gcalSync";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { eq, and, inArray, isNotNull, gte } from "drizzle-orm";
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

        let total: number;
        try {
            const dbSettings = await getDbSettings(c);
            const internalId = dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"] || "primary";
            const outreachId = dbSettings["CALENDAR_ID_OUTREACH"] || dbSettings["CALENDAR_ID"] || "primary";
            const externalId = dbSettings["CALENDAR_ID_EXTERNAL"] || dbSettings["CALENDAR_ID"] || "primary";

            const uniqueCalendars = Array.from(new Set([internalId, outreachId, externalId]));
            const allFetchedEvents: { ev: ARES_Event; category: "internal" | "outreach" | "external" }[] = [];

            for (const calId of uniqueCalendars) {
                let cat: "internal" | "outreach" | "external" = "internal";
                if (calId === outreachId) {
                    cat = "outreach";
                } else if (calId === externalId) {
                    cat = "external";
                } else if (calId === internalId) {
                    cat = "internal";
                }

                try {
                    const gcalEvents = await pullEventsFromGcal(calId, oauthToken);
                    for (const ev of gcalEvents) {
                        allFetchedEvents.push({ ev, category: cat });
                    }
                } catch (calErr) {
                    console.error(`SYNC_EVENTS: Failed to pull from calendar "${calId}":`, calErr);
                    if (calId === "primary" || uniqueCalendars.length === 1) {
                        throw calErr;
                    }
                }
            }

            const CHUNK_SIZE = 20;
            for (let i = 0; i < allFetchedEvents.length; i += CHUNK_SIZE) {
                const chunk = allFetchedEvents.slice(i, i + CHUNK_SIZE).map(({ ev, category }) => ({
                    id: crypto.randomUUID(),
                    title: ev.title,
                    dateStart: ev.dateStart,
                    dateEnd: ev.dateEnd || null,
                    location: ev.location,
                    description: ev.description,
                    gcalEventId: ev.gcalEventId,
                    status: 'published' as const,
                    category: category,
                }));

                const gcalIds = chunk.map(c => c.gcalEventId).filter(Boolean) as string[];
                const existingEvents = gcalIds.length > 0
                    ? await db.select({ gcalEventId: schema.events.gcalEventId })
                        .from(schema.events)
                        .where(inArray(schema.events.gcalEventId, gcalIds))
                        .all()
                    : [];

                const existingGcalIds = new Set(existingEvents.map(e => e.gcalEventId));
                const toInsert = [];

                for (const ev of chunk) {
                    if (ev.gcalEventId && existingGcalIds.has(ev.gcalEventId)) {
                        await db.update(schema.events)
                            .set({
                                title: ev.title,
                                dateStart: ev.dateStart,
                                dateEnd: ev.dateEnd,
                                location: ev.location,
                                description: ev.description,
                                category: ev.category,
                            })
                            .where(eq(schema.events.gcalEventId, ev.gcalEventId))
                            .run();
                    } else {
                        toInsert.push(ev);
                    }
                }

                if (toInsert.length > 0) {
                    await db.insert(schema.events).values(toInsert).run();
                }
            }

            // --- Deletion Pass ---
            // Remove any local events (synced from GCal) from the last 2 years that are NO LONGER in the active events list.
            const activeGcalIds = allFetchedEvents.map(({ ev }) => ev.gcalEventId).filter(Boolean) as string[];
            
            const twoYearsAgo = new Date();
            twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
            const timeMinStr = twoYearsAgo.toISOString().substring(0, 10); // 'YYYY-MM-DD'

            const localGcalEvents = await db.select({ id: schema.events.id, gcalEventId: schema.events.gcalEventId })
                .from(schema.events)
                .where(
                    and(
                        isNotNull(schema.events.gcalEventId),
                        gte(schema.events.dateStart, timeMinStr)
                    )
                )
                .all();

            const activeSet = new Set(activeGcalIds);
            const toDeleteIds = localGcalEvents
                .filter(e => e.gcalEventId && !activeSet.has(e.gcalEventId))
                .map(e => e.id);

            if (toDeleteIds.length > 0) {
                for (let i = 0; i < toDeleteIds.length; i += 50) {
                    const chunk = toDeleteIds.slice(i, i + 50);
                    await db.delete(schema.events)
                        .where(inArray(schema.events.id, chunk))
                        .run();
                }
            }

            total = allFetchedEvents.length;
        } catch (calErr) {
            const msg = calErr instanceof Error ? calErr.message : String(calErr);
            console.error(`SYNC_EVENTS: Calendar sync failed:`, msg);
            throw new ApiError(`Calendar sync failed: ${msg}`, 500);
        }

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true, count: total } };
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
