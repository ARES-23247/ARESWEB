import { ApiError } from "../../middleware/errorHandler";
import { getSocialConfig, getSessionUser, getDbSettings, getDb } from "../../middleware";
import { triggerBackgroundReindex } from "../ai/autoReindex";
import { pushEventToGcal, pullEventsFromGcal, deleteEventFromGcal, type ARES_Event } from "../../../utils/gcalSync";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { sql } from "drizzle-orm";
import { rrulestr } from 'rrule';
import type { HandlerInput, HonoContext, ApiResponse } from "@shared/types/api";

import { eq, or, and, isNull, inArray, desc, lte } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { EventCategoryEnum } from "../../../../shared/schemas/eventSchema";

import type { SocialConfig } from "../../middleware";
import { queryHelpers, transactionHelpers } from "@/db/query-helpers";

import {
    eventResponseSchema,
    getEventsRoute,
    getAdminEventsRoute,
    getAdminEventRoute,
    getEventRoute,
    saveEventRoute,
    updateEventRoute,
    deleteEventRoute,
    syncEventsRoute,
    repairCalendarRoute,
    approveEventRoute,
    rejectEventRoute,
    undeleteEventRoute,
    purgeEventRoute,
    repushEventRoute,
    getCalendarSettingsRoute,
    getSignupsRoute,
    submitSignupRoute,
    deleteMySignupRoute,
    updateMyAttendanceRoute,
    updateUserAttendanceRoute,
    getEventHistoryRoute,
    restoreEventHistoryRoute
} from "../../../../shared/routes/events";
import { z } from "zod";
import { requireAuth } from "../../middleware/auth";

type FormattedEvent = z.infer<typeof eventResponseSchema>;

// Cloudflare Cache API type for edge cache invalidation
type CloudflareCachesWithDefault = CacheStorage & {
    default?: Cache;
};

// Type for Hono context with ARES environment
type AresContext = HonoContext;

/**
 * Invalidate Cloudflare edge cache for public events endpoints.
 */
function invalidateEventsCache(c: AresContext): void {
    if (typeof caches === 'undefined' || !c.executionCtx) return;
    const cfCaches = caches as unknown as CloudflareCachesWithDefault;
    const cache = cfCaches.default;
    if (!cache) return;

    const baseUrl = new URL(c.req.url).origin;
    const cacheKeys = [
        new Request(new URL("/api/events", baseUrl).href, { method: "GET" }),
        new Request(new URL("/api/events/calendar-settings", baseUrl).href, { method: "GET" }),
    ];

    c.executionCtx.waitUntil(
        Promise.all(cacheKeys.map(key => cache.delete(key)))
    );
}

/**
 * Normalize category to a valid EventCategoryEnum value.
 */
function normalizeCategory(category: string | null | undefined): "internal" | "outreach" | "external" | null {
    if (!category) return null;
    const result = EventCategoryEnum.safeParse(category);
    return result.success ? result.data : "internal";
}

/**
 * Normalize a date string from D1 to timezone-naive local time.
 */
function normalizeDateTime(dt: string | null | undefined): string | null {
    if (!dt) return null;
    let normalized = dt.replace(" ", "T");
    if (normalized.endsWith("Z")) {
        normalized = normalized.slice(0, -1);
    }
    normalized = normalized.replace(/[+-]\d{2}:?\d{2}$/, "");
    return normalized;
}

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 */
const sanitizeFtsQuery = (query: string): string => {
    return query.replace(/["\\^*-:]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
};

// Explicit type for event save/update body — matches the eventSchema from shared/schemas/eventSchema.ts
// Defined explicitly to avoid TypeScript inference issues with the dynamic extendSchema builder pattern
interface EventSaveBody {
    id?: string;
    title: string;
    category?: string;
    dateStart: string;
    dateEnd?: string | null;
    location?: string | null;
    description?: string | null;
    coverImage?: string | null;
    tbaEventKey?: string | null;
    socials?: Record<string, boolean>;
    isPotluck?: boolean;
    isVolunteer?: boolean;
    isDraft?: boolean;
    publishedAt?: string | null;
    seasonId?: number | null;
    meetingNotes?: string | null;
    rrule?: string | null;
    recurrenceRule?: string | null;
    parentEventId?: string | null;
    originalStartTime?: string | null;
    recurringGroupId?: string | null;
    recurringException?: boolean | null;
    updateMode?: "single" | "following";
    deleteMode?: "single" | "following";
    status?: string;
}

/**
 * Maps a database event row to the standard API response format.
 */
function mapToEventResponse(e: Record<string, unknown>, locationMap: Record<string, string> = {}): FormattedEvent {
    return {
        id: String(e.id),
        title: String(e.title || ""),
        category: normalizeCategory(e.category as string) ?? "internal",
        dateStart: normalizeDateTime(e.dateStart as string) ?? "",
        dateEnd: normalizeDateTime(e.dateEnd as string),
        location: (e.location as string) ?? null,
        locationAddress: e.location ? (locationMap[e.location as string] || null) : null,
        description: (e.description as string) ?? null,
        coverImage: (e.coverImage as string) ?? null,
        status: (e.status ?? "published") as FormattedEvent["status"],
        isDeleted: Number(e.isDeleted || 0),
        seasonId: e.seasonId ? Number(e.seasonId) : null,
        meetingNotes: (e.meetingNotes as string) ?? null,
        tbaEventKey: (e.tbaEventKey as string) ?? null,
        isPotluck: Number(e.isPotluck || 0),
        isVolunteer: Number(e.isVolunteer || 0),
        recurringGroupId: (e.recurringGroupId as string) ?? null,
        rrule: (e.rrule as string) ?? null,
        zulipStream: (e.zulipStream as string) ?? null,
        zulipTopic: (e.zulipTopic as string) ?? null,
        recurringException: e.recurringException ? Number(e.recurringException) : null,
        contentDraft: (e.contentDraft as string) ?? null,
        gcalEventId: (e.gcalEventId as string) ?? null,
        updatedAt: (e.updatedAt as string) ?? null,
        revisionOf: (e.revisionOf as string) ?? null,
        publishedAt: (e.publishedAt as string) ?? null,
    };
}

export const eventHandlers = {
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
        const db = getDb(c);
        const results = await db.select({
            key: schema.settings.key,
            value: schema.settings.value,
        })
            .from(schema.settings)
            .where(inArray(schema.settings.key, ["CALENDAR_ID", "CALENDAR_ID_INTERNAL", "CALENDAR_ID_OUTREACH", "CALENDAR_ID_EXTERNAL"]))
            .all();

        const map = results.reduce<Record<string, string>>((acc, row) => ({ ...acc, [row.key ?? ""]: row.value ?? "" }), {});

        return {
            status: 200 as const,
            body: {
                calendarIdInternal: map["CALENDAR_ID_INTERNAL"] || map["CALENDAR_ID"] || "",
                calendarIdOutreach: map["CALENDAR_ID_OUTREACH"] || "",
                calendarIdExternal: map["CALENDAR_ID_EXTERNAL"] || "",
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

    saveEvent: async (input: HandlerInput<EventSaveBody>, c: AresContext): Promise<ApiResponse<typeof saveEventRoute>> => {
        const { body } = input;
        const db = getDb(c);

        if (body.id) {
            const idStr = String(body.id);
            const existing = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.id, idStr)).get();
            if (existing) {
                return eventHandlers.updateEvent({ params: { id: body.id }, body, query: {} }, c);
            }
        }

        const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes, rrule } = body;

        if (!dateStart) throw new ApiError("dateStart is required", 400);

        const recent = await db.select({ id: schema.events.id })
            .from(schema.events)
            .where(and(
                eq(schema.events.title, title || ""),
                eq(schema.events.dateStart, dateStart),
                eq(schema.events.isDeleted, 0)
            ))
            .get();

        if (recent) {
            return { status: 200 as const, body: { success: true, id: recent.id, warning: "Double-submission prevented" } };
        }

        const cat = category || 'internal';
        const genId = crypto.randomUUID();

        const socialConfig = await getSocialConfig(c);
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
        const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

        const user = await requireAuth(c);
        const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

        let instances: (typeof schema.events.$inferInsert)[] = [];

        if (rrule) {
            try {
                const rule = rrulestr(rrule, { dtstart: new Date(dateStart) });
                const dates = rule.all((d: Date, i: number) => i < 52);
                const duration = dateEnd ? new Date(dateEnd).getTime() - new Date(dateStart).getTime() : 0;

                const formatLocal = (d: Date) => {
                    const year = d.getFullYear();
                    const month = String(d.getMonth() + 1).padStart(2, '0');
                    const day = String(d.getDate()).padStart(2, '0');
                    const hours = String(d.getHours()).padStart(2, '0');
                    const minutes = String(d.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}:00`;
                };

                instances = dates.map((d: Date, i: number) => {
                    const instStart = formatLocal(d);
                    const instEnd = dateEnd ? formatLocal(new Date(d.getTime() + duration)) : null;
                    return {
                        id: i === 0 ? genId : crypto.randomUUID(),
                        title: title || "", category: cat, dateStart: instStart, dateEnd: instEnd,
                        location: location || "", description: description || "", coverImage: coverImage || "",
                        gcalEventId: null, status,
                        isPotluck: isPotluck ? 1 : 0, isVolunteer: isVolunteer ? 1 : 0, tbaEventKey: tbaEventKey || null,
                        publishedAt: publishedAt || null, seasonId: seasonId || null, meetingNotes: meetingNotes || null,
                    };
                });
            } catch (e) {
                console.error("Invalid rrule", e);
            }
        }

        if (instances.length === 0) {
            instances.push({
                id: genId, title: title || "", category: cat, dateStart: dateStart, dateEnd: dateEnd || null,
                location: location || "", description: description || "", coverImage: coverImage || "",
                gcalEventId: null, status,
                isPotluck: isPotluck ? 1 : 0, isVolunteer: isVolunteer ? 1 : 0, tbaEventKey: tbaEventKey || null,
                publishedAt: publishedAt || null, seasonId: seasonId || null, meetingNotes: meetingNotes || null,
            });
        }

        const CHUNK_SIZE = 5;
        for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
            await db.insert(schema.events).values(instances.slice(i, i + CHUNK_SIZE)).run();
        }

        if (description) {
            c.executionCtx.waitUntil(
                db.insert(schema.documentHistory)
                    .values({
                        roomId: `event_${genId}`,
                        content: description,
                        createdBy: user?.email || "anonymous_admin",
                    })
                    .run()
            );
        }

        c.executionCtx.waitUntil((async () => {
            if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                try {
                    const gcalId = await pushEventToGcal(
                        { id: genId, title: title || "", dateStart: dateStart, dateEnd: dateEnd || undefined, location: location || undefined, description: description || undefined, coverImage: coverImage || undefined, meetingNotes: meetingNotes || undefined, recurrenceRule: rrule || undefined },
                        { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
                    );
                    if (gcalId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, genId)).run();
                    }
                } catch (e) { console.error("GCAL_SAVE_FAIL", e); }
            }

            if (status === "published") {
                const baseUrl = new URL(c.req.url).origin;
                if (socials) {
                    await dispatchSocials(
                        db,
                        {
                            title: title || "",
                            url: `${baseUrl}/events/${genId}`,
                            snippet: description || "",
                            thumbnail: coverImage || undefined,
                        },
                        socialConfig,
                        socials
                    ).catch((err) => {
                        console.error("Failed to dispatch socials for new event:", err);
                    });
                }

                const eventTopic = `Event: ${title}`;
                const eventContent = `📅 **New Event Scheduled**\n\n**Title:** ${title}\n**Location:** ${location || "TBD"}\n\n[View Event](${baseUrl}/events)`;
                await sendZulipMessage(socialConfig, "events", eventTopic, eventContent).catch((err) => {
                    console.error("Failed to send Zulip message for new event:", err);
                });
            }
        })());

        triggerBackgroundReindex(c.executionCtx, getDb(c), c.env.AI, c.env.VECTORIZE_DB);
        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true, id: genId } };
    },

    updateEvent: async (input: HandlerInput<Partial<EventSaveBody>>, c: AresContext): Promise<ApiResponse<typeof updateEventRoute>> => {
        const { params, body } = input;
        const { id } = params;
        const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes } = body;
        const db = getDb(c);

        if (!dateStart) throw new ApiError("dateStart is required", 400);

        const cat = category || 'internal';
        const user = await getSessionUser(c);
        const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

        if (user?.role !== "admin") {
            const revId = `${id}-rev-${Math.random().toString(36).substring(2, 6)}`;
            await db.insert(schema.events)
                .values({
                    id: revId, title: title || "", category: cat, dateStart: dateStart, dateEnd: dateEnd || null,
                    location: location || "", description: description || "", coverImage: coverImage || "",
                    tbaEventKey: tbaEventKey || null, status: 'pending',
                    isPotluck: isPotluck ? 1 : 0, isVolunteer: isVolunteer ? 1 : 0,
                    revisionOf: id, publishedAt: publishedAt || null, seasonId: seasonId || null, meetingNotes: meetingNotes || null
                })
                .run();
            return { status: 200 as const, body: { success: true, id: revId } };
        }

        const existing = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
        if (!existing) throw new ApiError("Event not found", 404);

        await db.update(schema.events)
            .set({
                title: title || existing.title, category: cat, dateStart: dateStart, dateEnd: dateEnd || null,
                location: location || "", description: description || "", coverImage: coverImage || "",
                tbaEventKey: tbaEventKey || null, status, contentDraft: null,
                isPotluck: isPotluck ? 1 : 0, isVolunteer: isVolunteer ? 1 : 0,
                publishedAt: publishedAt || null, seasonId: seasonId || null, meetingNotes: meetingNotes || null
            })
            .where(eq(schema.events.id, id))
            .run();

        if (description) {
            c.executionCtx.waitUntil(
                db.insert(schema.documentHistory)
                    .values({
                        roomId: `event_${id}`,
                        content: description,
                        createdBy: user?.email || "anonymous",
                    })
                    .run()
            );
        }

        c.executionCtx.waitUntil((async () => {
            if (status === "published") {
                const socialConfig = await getSocialConfig(c);
                const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
                const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

                if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                    try {
                        const row = await db.select({
                            gcalEventId: schema.events.gcalEventId,
                        }).from(schema.events).where(eq(schema.events.id, id)).get();

                        const gcalId = await pushEventToGcal(
                            { id, title: title || "", dateStart: dateStart, dateEnd: dateEnd || undefined, location: location || undefined, description: description || undefined, coverImage: coverImage || undefined, gcalEventId: row?.gcalEventId || undefined, meetingNotes: meetingNotes || undefined },
                            { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
                        );
                        if (gcalId && gcalId !== row?.gcalEventId) {
                            await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, id)).run();
                        }
                    } catch (e) { console.error("GCAL_UPDATE_FAIL", e); }
                }
            }
        })());

        triggerBackgroundReindex(c.executionCtx, getDb(c), c.env.AI, c.env.VECTORIZE_DB);
        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true, id } };
    },

    deleteEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof deleteEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        const existing = await db.select({
            gcalEventId: schema.events.gcalEventId,
            category: schema.events.category
        }).from(schema.events).where(eq(schema.events.id, id)).get();

        if (!existing) throw new ApiError("Event not found", 404);

        await db.update(schema.events).set({ isDeleted: 1 }).where(eq(schema.events.id, id)).run();

        c.executionCtx.waitUntil((async () => {
            if (existing.gcalEventId) {
                const socialConfig = await getSocialConfig(c);
                const cat = existing.category || "internal";
                const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
                const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

                if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                    try {
                        await deleteEventFromGcal(existing.gcalEventId, {
                            email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string,
                            privateKey: socialConfig.GCAL_PRIVATE_KEY as string,
                            calendarId: calId
                        });
                    } catch { /* ignore GCal failure */ }
                }
            }
        })());

        triggerBackgroundReindex(c.executionCtx, getDb(c), c.env.AI, c.env.VECTORIZE_DB);
        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

    approveEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof approveEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        const row = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();

        if (!row) throw new ApiError("Event not found", 404);

        if (row.revisionOf) {
            await db.update(schema.events)
                .set({ title: row.title, dateStart: row.dateStart, dateEnd: row.dateEnd, location: row.location, description: row.description, coverImage: row.coverImage, tbaEventKey: row.tbaEventKey, status: 'published', isPotluck: row.isPotluck, isVolunteer: row.isVolunteer, seasonId: row.seasonId, meetingNotes: row.meetingNotes })
                .where(eq(schema.events.id, row.revisionOf))
                .run();
            await db.delete(schema.events).where(eq(schema.events.id, id)).run();
        } else {
            await db.update(schema.events).set({ status: 'published' }).where(eq(schema.events.id, id)).run();
        }

        c.executionCtx.waitUntil((async () => {
            const targetId = row.revisionOf || id;
            const targetRow = await db.select().from(schema.events).where(eq(schema.events.id, targetId)).get();
            if (!targetRow) return;

            const socialConfig = await getSocialConfig(c);
            const cat = targetRow.category || "internal";
            const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
            const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

            if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                try {
                    const gcalId = await pushEventToGcal(
                        { id: targetRow.id as string, title: targetRow.title, dateStart: targetRow.dateStart, dateEnd: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, coverImage: targetRow.coverImage || undefined, gcalEventId: targetRow.gcalEventId || undefined, meetingNotes: targetRow.meetingNotes || undefined },
                        { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: socialConfig.GCAL_PRIVATE_KEY, calendarId: calId }
                    );
                    if (gcalId && gcalId !== targetRow.gcalEventId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, targetRow.id)).run();
                    }
                } catch (e) { console.error("GCAL_APPROVE_FAIL", e); }
            }

            const baseUrl = new URL(c.req.url).origin;
            const eventTopic = `Event: ${targetRow.title}`;
            const eventContent = `📅 **Event Approved & Scheduled**\n\n**Title:** ${targetRow.title}\n**Location:** ${targetRow.location || "TBD"}\n\n[View Event](${baseUrl}/events)`;
            await sendZulipMessage(socialConfig, "events", eventTopic, eventContent).catch((err) => {
                console.error("Failed to send Zulip message for approved event:", err);
            });
        })());

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

    rejectEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof rejectEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        await db.update(schema.events).set({ status: 'rejected' }).where(eq(schema.events.id, id)).run();
        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

    undeleteEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof undeleteEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        await db.update(schema.events).set({ isDeleted: 0 }).where(eq(schema.events.id, id)).run();

        c.executionCtx.waitUntil((async () => {
            const targetRow = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
            if (!targetRow || targetRow.status !== "published") return;

            const socialConfig = await getSocialConfig(c);
            const cat = targetRow.category || "internal";
            const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
            const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

            if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                try {
                    const gcalId = await pushEventToGcal(
                        { id: targetRow.id as string, title: targetRow.title, dateStart: targetRow.dateStart, dateEnd: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, coverImage: targetRow.coverImage || undefined, gcalEventId: targetRow.gcalEventId || undefined, meetingNotes: targetRow.meetingNotes || undefined },
                        { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: socialConfig.GCAL_PRIVATE_KEY, calendarId: calId }
                    );
                    if (gcalId && gcalId !== targetRow.gcalEventId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, targetRow.id)).run();
                    }
                } catch (e) { console.error("GCAL_UNDELETE_FAIL", e); }
            }
        })());

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

    purgeEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof purgeEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);
        const row = await db.select({ gcalEventId: schema.events.gcalEventId, category: schema.events.category }).from(schema.events).where(eq(schema.events.id, id)).get();
        await db.delete(schema.events).where(eq(schema.events.id, id)).run();

        c.executionCtx.waitUntil((async () => {
            if (row && row.gcalEventId) {
                const socialConfig = await getSocialConfig(c);
                const cat = row.category || "internal";
                const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
                const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

                if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                    try {
                        await deleteEventFromGcal(row.gcalEventId, {
                            email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string,
                            privateKey: socialConfig.GCAL_PRIVATE_KEY as string,
                            calendarId: calId
                        });
                    } catch { /* ignore GCal failure */ }
                }
            }
        })());

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

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

    getSignups: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof getSignupsRoute>> => {
        const { params } = input;
        const eventId = params.id;
        const user = await getSessionUser(c);
        const db = getDb(c);
        const isVerified = user && user.role !== "unverified";
        const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.memberType || ""));

        const { eventSignups: results } = await queryHelpers.getEventSignups(db, eventId);

        const signups = isVerified ? results.map((rec: Record<string, unknown>) => ({
            userId: rec.userId,
            nickname: rec.profileNickname || null,
            bringing: rec.bringing || null,
            notes: (isManagement || (user && rec.userId === user.id)) ? rec.notes : null,
            prepHours: Number(rec.prepHours || 0),
            attended: Number(rec.attended || 0),
            isOwn: user ? rec.userId === user.id : false,
        })) : [];

        const dietarySummary: Record<string, number> = {};
        results.forEach((r: Record<string, unknown>) => {
            if (r.dietaryRestrictions) {
                const restrictions = (r.dietaryRestrictions as string).split(',').map((st: string) => st.trim());
                restrictions.forEach((res: string) => {
                    if (res) dietarySummary[res] = (dietarySummary[res] || 0) + 1;
                });
            }
        });

        return {
            status: 200 as const,
            body: {
                signups: signups as any, // eslint-disable-line @typescript-eslint/no-explicit-any -- Handler projects subset of signup schema fields
                dietarySummary,
                teamDietarySummary: {},
                authenticated: !!user,
                role: user?.role || null,
                memberType: user?.memberType || null,
                canManage: !!isManagement
            }
        };
    },

    submitSignup: async (input: HandlerInput<{ bringing?: string; notes?: string; prepHours?: number }>, c: AresContext): Promise<ApiResponse<typeof submitSignupRoute>> => {
        const { params, body } = input;
        const user = await getSessionUser(c);
        if (!user || user.role === "unverified") throw new ApiError("Forbidden", 403);
        const db = getDb(c);

        await transactionHelpers.createEventSignup(db, {
            eventId: params.id,
            userId: user.id,
            bringing: body.bringing || "",
            notes: body.notes || "",
            prepHours: body.prepHours || 0,
        });

        return { status: 200 as const, body: { success: true } };
    },

    deleteMySignup: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof deleteMySignupRoute>> => {
        const { params } = input;
        const user = await requireAuth(c);
        const db = getDb(c);
        await db.delete(schema.eventSignups).where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, user.id))).run();
        return { status: 200 as const, body: { success: true } };
    },

    updateMyAttendance: async (input: HandlerInput<{ attended: boolean }>, c: AresContext): Promise<ApiResponse<typeof updateMyAttendanceRoute>> => {
        const { params, body } = input;
        const user = await requireAuth(c);
        const db = getDb(c);

        const existing = await db.select({ id: schema.eventSignups.id })
            .from(schema.eventSignups)
            .where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, user.id)))
            .get();

        if (existing) {
            await db.update(schema.eventSignups)
                .set({ attended: body.attended ? 1 : 0 })
                .where(eq(schema.eventSignups.id, existing.id))
                .run();
        } else {
            await db.insert(schema.eventSignups)
                .values({ eventId: params.id, userId: user.id, attended: body.attended ? 1 : 0 })
                .run();
        }
        return { status: 200 as const, body: { success: true } };
    },

    updateUserAttendance: async (input: HandlerInput<{ attended: boolean }>, c: AresContext): Promise<ApiResponse<typeof updateUserAttendanceRoute>> => {
        const { params, body } = input;
        const user = await getSessionUser(c);
        if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.memberType || "")) throw new ApiError("Unauthorized", 401);
        const db = getDb(c);

        const existing = await db.select({ id: schema.eventSignups.id })
            .from(schema.eventSignups)
            .where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, params.userId)))
            .get();

        if (existing) {
            await db.update(schema.eventSignups)
                .set({ attended: body.attended ? 1 : 0 })
                .where(eq(schema.eventSignups.id, existing.id))
                .run();
        } else {
            await db.insert(schema.eventSignups)
                .values({ eventId: params.id, userId: params.userId, attended: body.attended ? 1 : 0 })
                .run();
        }
        return { status: 200 as const, body: { success: true } };
    },

    repushEvent: async (input: HandlerInput<{ socials?: string[] }>, c: AresContext): Promise<ApiResponse<typeof repushEventRoute>> => {
        const { params, body } = input;
        const { id } = params;
        const db = getDb(c);
        const event = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
        if (!event) throw new ApiError("Event not found", 404);

        const socialConfig = await getSocialConfig(c);
        const baseUrl = new URL(c.req.url).origin;

        if (body.socials) {
            const socialsFilter: Record<string, boolean> = {};
            body.socials.forEach(s => socialsFilter[s] = true);

            await dispatchSocials(
                db,
                {
                    title: event.title,
                    url: `${baseUrl}/events/${event.id}`,
                    snippet: event.description || "",
                    thumbnail: event.coverImage || undefined,
                },
                socialConfig,
                socialsFilter
            );
        }

        // Also sync to GCal if published
        if (event.status === "published") {
            const cat = event.category || "internal";
            const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
            const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

            if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
                try {
                    const gcalId = await pushEventToGcal(
                        { id: event.id, title: event.title, dateStart: event.dateStart, dateEnd: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, coverImage: event.coverImage || undefined, gcalEventId: event.gcalEventId || undefined, meetingNotes: event.meetingNotes || undefined },
                        { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
                    );
                    if (gcalId && gcalId !== event.gcalEventId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
                    }
                } catch (e) {
                    console.error("REPUSH_EVENT_GCAL ERROR", e);
                }
            }
        }

        return { status: 200 as const, body: { success: true } };
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

    getEventHistory: async (_input: HandlerInput, _c: AresContext): Promise<ApiResponse<typeof getEventHistoryRoute>> => {
        return { status: 200 as const, body: { history: [] } };
    },

    restoreEventHistory: async (_input: HandlerInput, _c: AresContext): Promise<ApiResponse<typeof restoreEventHistoryRoute>> => {
        throw new ApiError("Event history feature not yet implemented", 501);
        return { status: 200 as const, body: { success: true } };
    },
};
