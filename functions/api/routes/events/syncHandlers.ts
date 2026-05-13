/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — GCal Sync Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getDbSettings, getDb } from "../../middleware";
import { getSocialConfig } from "../../middleware";
import { pushEventToGcal, pullEventsFromGcal, type ARES_Event } from "../../../utils/gcalSync";
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
        const dbSettings = await getDbSettings(c);
        const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
        const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];

        const calendars = [
            { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
            { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
            { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
        ].filter((cal) => !!cal.id);

        if (!gcalEmail || !gcalKey || calendars.length === 0) {
            throw new ApiError("GCal config missing", 500);
        }

        let total = 0;
        const errors: string[] = [];

        for (const cal of calendars) {
            try {
                const events = await pullEventsFromGcal({ email: gcalEmail as string, privateKey: gcalKey as string, calendarId: cal.id as string });

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
                        category: cal.category,
                    }));

                    await db.insert(schema.events)
                        .values(chunk)
                        .onConflictDoUpdate({
                            target: schema.events.gcalEventId,
                            set: {
                                title: sql`excluded.title`,
                                dateStart: sql`excluded.dateStart`,
                                dateEnd: sql`excluded.dateEnd`,
                                location: sql`excluded.location`,
                                description: sql`excluded.description`,
                                category: sql`excluded.category`,
                            }
                        })
                        .run();
                }

                total += events.length;
            } catch (calErr) {
                const msg = calErr instanceof Error ? calErr.message : String(calErr);
                console.error(`SYNC_EVENTS: Calendar ${cal.category} (${cal.id}) failed:`, msg);
                errors.push(`${cal.category}: ${msg}`);
            }
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
                eq(schema.events.status, "published"),
                isNull(schema.events.gcalEventId)
            ))
            .all();

        if (events.length === 0) {
            return { status: 200 as const, body: { success: true, pushed: 0, failed: 0 } };
        }

        const socialConfig = await getSocialConfig(c);
        let pushed = 0;
        let failed = 0;
        const errors: string[] = [];

        for (const event of events) {
            const cat = event.category || "internal";
            const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
            const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

            if (!socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL || !socialConfig.GCAL_PRIVATE_KEY || !calId) {
                throw new ApiError("GCal config missing", 500);
            }

            const gcalId = await pushEventToGcal(
                { id: event.id, title: event.title, dateStart: event.dateStart, dateEnd: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, coverImage: event.coverImage || undefined, gcalEventId: undefined, meetingNotes: event.meetingNotes || undefined },
                { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
            );
            if (gcalId) {
                await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
                pushed++;
            } else {
                errors.push(`${event.title}: GCal returned no ID`);
                failed++;
            }
        }

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true, pushed, failed, errors: errors.length > 0 ? errors : undefined } };
    },
};
