/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — Read Handlers (Public + Admin GET routes)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getSessionUser, getDb } from "../../middleware";
import { eq, or, and, isNull, desc, lte, sql } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import type { HandlerInput, ApiResponse } from "@shared/types/api";
import { queryHelpers } from "@/db/query-helpers";

import {
    getEventsRoute,
    getAdminEventsRoute,
    getAdminEventRoute,
    getEventRoute,
    getCalendarSettingsRoute,
    getEventHistoryRoute,
    restoreEventHistoryRoute,
} from "../../../../shared/routes/events";

import {
    type AresContext,
    mapToEventResponse,
    sanitizeFtsQuery,
    getCalendarSettingsFromDb,
} from "./eventHelpers";

export const readHandlers = {
    getEvents: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getEventsRoute>> => {
        const { query } = input;
        const db = getDb(c);
        const { limit = 50, offset = 0, q } = query;
        const nowIso = new Date().toISOString();

        if (q) {
            const cleanQ = sanitizeFtsQuery(String(q || ''));
            const results = await db.all<Record<string, unknown>>(sql`
        SELECT e.* FROM events_fts f
        JOIN events e ON f.id = e.id
        WHERE e.isDeleted = 0 AND e.status = 'published' AND (e.publishedAt IS NULL OR datetime(e.publishedAt) <= datetime('now'))
        AND f.events_fts MATCH ${cleanQ}
        ORDER BY f.rank LIMIT ${Number(limit) || 50} OFFSET ${Number(offset) || 0}
      `);

            const events = results.map((e) => mapToEventResponse(e));
            return { status: 200 as const, body: { events } };
        }

        const results = await db.select()
            .from(schema.events)
            .where(and(
                eq(schema.events.isDeleted, 0),
                eq(schema.events.status, "published"),
                or(
                    isNull(schema.events.publishedAt),
                    lte(schema.events.publishedAt, nowIso)
                )
            ))
            .orderBy(desc(schema.events.dateStart))
            .limit(Number(limit) || 50)
            .offset(Number(offset) || 0)
            .all();

        const locationNames = [...new Set(results.map((e) => e.location).filter(Boolean))] as string[];
        const locationMap = await queryHelpers.getLocationAddresses(db, locationNames);

        const events = results.map((e) => mapToEventResponse(e, locationMap));
        return { status: 200 as const, body: { events } };
    },

    getCalendarSettings: async (_input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getCalendarSettingsRoute>> => {
        const settings = await getCalendarSettingsFromDb(c);
        return {
            status: 200 as const,
            body: {
                calendarIdInternal: settings.CALENDAR_ID_INTERNAL || "primary",
                calendarIdOutreach: settings.CALENDAR_ID_OUTREACH || "primary",
                calendarIdExternal: settings.CALENDAR_ID_EXTERNAL || "primary",
            }
        };
    },

    getEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        const user = await getSessionUser(c);

        const row = await db.select()
            .from(schema.events)
            .where(and(
                eq(schema.events.id, id),
                eq(schema.events.isDeleted, 0),
                eq(schema.events.status, "published")
            ))
            .get();

        if (!row) throw new ApiError("Event not found", 404);

        let locationAddress: string | null = null;
        if (row.location) {
            const loc = await db.select({
                address: schema.locations.address,
            })
                .from(schema.locations)
                .where(eq(schema.locations.name, row.location))
                .get();
            locationAddress = loc?.address || null;
        }

        const event = mapToEventResponse(row, row.location ? { [row.location]: locationAddress ?? "" } : {});

        if (!user || user.role === "unverified") {
            event.meetingNotes = null;
        }

        return {
            status: 200 as const,
            body: {
                event,
                isEditor: user?.role === "admin"
            }
        };
    },

    getAdminEvents: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getAdminEventsRoute>> => {
        const { query } = input;
        const db = getDb(c);
        const { limit = 100, cursor } = query;

        const baseQuery = db.select()
            .from(schema.events)
            .orderBy(desc(schema.events.dateStart))
            .limit(Number(limit) || 100);

        let results: Record<string, unknown>[];
        if (cursor) {
            results = await baseQuery.where(sql`${schema.events.dateStart} < ${cursor}`).all();
        } else {
            results = await baseQuery.all();
        }

        const lastSyncRow = await db.select({
            value: schema.settings.value,
        })
            .from(schema.settings)
            .where(eq(schema.settings.key, "LAST_CALENDAR_SYNC"))
            .get();

        const events = results.map((e) => mapToEventResponse(e));
        const nextCursor = results.length === (Number(limit) || 100) ? (results[results.length - 1].dateStart as string) : null;

        return {
            status: 200 as const,
            body: {
                events,
                lastSyncedAt: lastSyncRow?.value || null,
                nextCursor
            }
        };
    },

    adminDetail: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getAdminEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        const row = await db.select()
            .from(schema.events)
            .where(eq(schema.events.id, id))
            .get();

        if (!row) throw new ApiError("Event not found", 404);

        return {
            status: 200 as const,
            body: {
                event: mapToEventResponse(row)
            }
        };
    },

    getEventHistory: async (_input: HandlerInput, _c: AresContext): Promise<ApiResponse<typeof getEventHistoryRoute>> => {
        return { status: 200 as const, body: { history: [] } };
    },

    restoreEventHistory: async (_input: HandlerInput, _c: AresContext): Promise<ApiResponse<typeof restoreEventHistoryRoute>> => {
        throw new ApiError("Event history feature not yet implemented", 501);
        return { status: 200 as const, body: { success: true } };
    },
};
