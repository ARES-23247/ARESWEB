/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — GCal Sync Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getDb } from "../../middleware";

import { pushEventToGcal, pullEventsFromGcal, type ARES_Event } from "../../../utils/gcalSync";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { eq, and, isNull, sql } from "drizzle-orm";
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
        const calendarId = "primary";
        let oauthToken: string;
        try {
            oauthToken = await getUnifiedOAuthToken(c.env, db);
        } catch (_error) {
            throw new ApiError("Google OAuth not connected. Please connect your Google account in Settings.", 500);
        }

        let total: number;
        try {
            const events = await pullEventsFromGcal(calendarId, oauthToken);

            const CHUNK_SIZE = 20;
            for (let i = 0; i < events.length; i += CHUNK_SIZE) {
                const chunk = events.slice(i, i + CHUNK_SIZE).map((ev: ARES_Event) => ({
                    id: crypto.randomUUID(),
                    title: ev.title,
                    dateStart: ev.dateStart,
                    dateEnd: ev.dateEnd || null,
                    location: ev.location,
                    description: ev.description,
                    gcalEventId: ev.gcalEventId,
                    status: 'published' as const,
                    category: 'internal' as const,
                }));

                await db.insert(schema.events)
                    .values(chunk)
                    .onConflictDoUpdate({
                        target: schema.events.gcalEventId,
                        set: {
                            title: sql`excluded.title`,
                            dateStart: sql`excluded.date_start`,
                            dateEnd: sql`excluded.date_end`,
                            location: sql`excluded.location`,
                            description: sql`excluded.description`,
                            category: sql`excluded.category`,
                        }
                    })
                    .run();
            }

            total = events.length;
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
        const calendarId = "primary";
        const events = await db.select()
            .from(schema.events)
            .where(and(
                eq(schema.events.isDeleted, 0),
                eq(schema.events.status, "published"),
                isNull(schema.events.gcalEventId)
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

        let pushed = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const event of events) {
            try {
                const gcalId = await pushEventToGcal(
                    { id: event.id, title: event.title, dateStart: event.dateStart, dateEnd: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, coverImage: event.coverImage || undefined, gcalEventId: undefined, meetingNotes: event.meetingNotes || undefined },
                    calendarId,
                    oauthToken
                );
                if (gcalId) {
                    await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
                    pushed++;
                    console.log(`[repairCalendar] Successfully pushed "${event.title}" to GCal (ID: ${gcalId})`);
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
