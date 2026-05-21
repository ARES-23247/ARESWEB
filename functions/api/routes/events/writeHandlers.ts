/**
 * ─────────────────────────────────────────────────────────────────────────────
 * EVENTS — Write Handlers (Create, Update, Delete, Lifecycle)
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { ApiError } from "../../middleware/errorHandler";
import { getDbSettings, getSessionUser, getDb } from "../../middleware";
import { triggerBackgroundReindex } from "../ai/autoReindex";
import { pushEventToGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { eq, and, ne, inArray, sql } from "drizzle-orm";
import * as rrulePkg from 'rrule';
const rrulestr = (
    typeof rrulePkg.rrulestr === 'function'
        ? rrulePkg.rrulestr
        : (rrulePkg as unknown as { default?: { rrulestr: typeof import('rrule').rrulestr } }).default?.rrulestr ||
          (rrulePkg as unknown as { default?: typeof import('rrule').rrulestr }).default
) as typeof import('rrule').rrulestr;
import type { HandlerInput, ApiResponse } from "@shared/types/api";
import * as schema from "../../../../src/db/schema";
import { requireAuth } from "../../middleware/auth";

import {
    saveEventRoute,
    updateEventRoute,
    deleteEventRoute,
    approveEventRoute,
    rejectEventRoute,
    undeleteEventRoute,
    purgeEventRoute,
    repushEventRoute,
} from "../../../../shared/routes/events";

import {
    type AresContext,
    type EventSaveBody,
    invalidateEventsCache,
} from "./eventHelpers";

// Forward reference for saveEvent → updateEvent delegation
// eslint-disable-next-line prefer-const
let writeHandlersRef: typeof writeHandlers;

export const writeHandlers = {
    saveEvent: async (input: HandlerInput<EventSaveBody>, c: AresContext): Promise<ApiResponse<typeof saveEventRoute>> => {
        const { body } = input;
        const db = getDb(c);

        try {
            if (body.id) {
                const idStr = String(body.id);
                const existing = await db.select({ id: schema.events.id }).from(schema.events).where(eq(schema.events.id, idStr)).get();
                if (existing) {
                    return writeHandlersRef.updateEvent({ params: { id: body.id }, body, query: {} }, c);
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
                        recurringGroupId: genId,
                        rrule: rrule || null,
                        recurringException: 0,
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
            if (status === "published") {
                try {
                    const dbSettings = await getDbSettings(c);
                    const calendarId = (
                        cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                        cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                        cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                    ) || dbSettings["CALENDAR_ID"] || "primary";

                    if (calendarId) {
                        const oauthToken = await getUnifiedOAuthToken(c.env, db);
                        const gcalId = await pushEventToGcal(
                            { id: genId, title: title || "", dateStart: dateStart, dateEnd: dateEnd || undefined, location: location || undefined, description: description || undefined, coverImage: coverImage || undefined, meetingNotes: meetingNotes || undefined, recurrenceRule: rrule || undefined },
                            calendarId,
                            oauthToken
                        );
                        if (gcalId) {
                            await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, genId)).run();
                        }
                    }
                } catch (e) { console.error("GCAL_SAVE_FAIL", e); }
            }

            if (status === "published") {
                const socialConfig = await getDbSettings(c);
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
        } catch (error) {
            console.error("Failed to save event:", error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(
                `Failed to save event: ${error instanceof Error ? error.message : "Unknown database error"}`,
                500,
                "EVENT_SAVE_FAILED"
            );
        }
    },

    updateEvent: async (input: HandlerInput<Partial<EventSaveBody>>, c: AresContext): Promise<ApiResponse<typeof updateEventRoute>> => {
        const { params, body } = input;
        const { id } = params;
        const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes, rrule, updateMode } = body;
        const db = getDb(c);

        try {
            if (!dateStart) throw new ApiError("dateStart is required", 400);

            const cat = category || 'internal';
            const user = await getSessionUser(c);
            const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

            if (user?.role !== "admin") {
                const revId = `${id}-rev-${crypto.randomUUID().split('-')[0].substring(0, 4)}`;
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

        const finalRrule = rrule !== undefined ? rrule : existing.rrule;
        const finalUpdateMode = updateMode || "single";

        // Series update or transition from single to repeating
        if (finalUpdateMode === "following" || (finalRrule && !existing.rrule)) {
            const groupId = existing.recurringGroupId || existing.id;

            // 1. Fetch all future instances starting from the current instance's original date
            const futureInstances = await db.select({
                id: schema.events.id,
                gcalEventId: schema.events.gcalEventId,
            })
            .from(schema.events)
            .where(and(
                eq(schema.events.recurringGroupId, groupId),
                ne(schema.events.id, id),
                sql`${schema.events.dateStart} >= ${existing.dateStart}`
            ))
            .all();

            // 2. Delete them from Google Calendar (async wait)
            if (futureInstances.length > 0) {
                c.executionCtx.waitUntil((async () => {
                    const dbSettings = await getDbSettings(c);
                    const oauthToken = await getUnifiedOAuthToken(c.env, db);
                    const calendarId = (
                        cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                        cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                        cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                    ) || dbSettings["CALENDAR_ID"] || "primary";

                    for (const inst of futureInstances) {
                        if (inst.gcalEventId) {
                            try {
                                await deleteEventFromGcal(inst.gcalEventId, calendarId, oauthToken);
                            } catch (gcalErr) {
                                console.error(`[updateEvent] Failed to delete instance ${inst.id} from GCal:`, gcalErr);
                            }
                        }
                    }
                })());

                // 3. Delete future instances from D1 database
                const futureIds = futureInstances.map(x => x.id);
                const CHUNK_SIZE = 20;
                for (let i = 0; i < futureIds.length; i += CHUNK_SIZE) {
                    const chunk = futureIds.slice(i, i + CHUNK_SIZE);
                    await db.delete(schema.events).where(inArray(schema.events.id, chunk)).run();
                }
            }

            // 4. Generate new instances from the new dateStart
            let instances: (typeof schema.events.$inferInsert)[] = [];
            if (finalRrule) {
                try {
                    const rule = rrulestr(finalRrule, { dtstart: new Date(dateStart) });
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

                    instances = dates.slice(1).map((d: Date) => {
                        const instStart = formatLocal(d);
                        const instEnd = dateEnd ? formatLocal(new Date(d.getTime() + duration)) : null;
                        return {
                            id: crypto.randomUUID(),
                            title: title || existing.title,
                            category: cat,
                            dateStart: instStart,
                            dateEnd: instEnd,
                            location: location || "",
                            description: description || "",
                            coverImage: coverImage || "",
                            gcalEventId: null,
                            status,
                            isPotluck: isPotluck ? 1 : 0,
                            isVolunteer: isVolunteer ? 1 : 0,
                            tbaEventKey: tbaEventKey || null,
                            publishedAt: publishedAt || null,
                            seasonId: seasonId || null,
                            meetingNotes: meetingNotes || null,
                            recurringGroupId: groupId,
                            rrule: finalRrule,
                            recurringException: 0,
                        };
                    });
                } catch (e) {
                    console.error("Invalid rrule on update", e);
                }
            }

            // 5. Insert new instances into D1 database
            if (instances.length > 0) {
                const CHUNK_SIZE = 5;
                for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
                    await db.insert(schema.events).values(instances.slice(i, i + CHUNK_SIZE)).run();
                }
            }

            // 6. Update the parent event itself
            await db.update(schema.events)
                .set({
                    title: title || existing.title,
                    category: cat,
                    dateStart,
                    dateEnd: dateEnd || null,
                    location: location || "",
                    description: description || "",
                    coverImage: coverImage || "",
                    tbaEventKey: tbaEventKey || null,
                    status,
                    contentDraft: null,
                    isPotluck: isPotluck ? 1 : 0,
                    isVolunteer: isVolunteer ? 1 : 0,
                    publishedAt: publishedAt || null,
                    seasonId: seasonId || null,
                    meetingNotes: meetingNotes || null,
                    rrule: finalRrule || null,
                    recurringGroupId: finalRrule ? groupId : null,
                    recurringException: 0,
                })
                .where(eq(schema.events.id, id))
                .run();

        } else {
            // Single instance update
            const isException = existing.recurringGroupId ? 1 : 0;
            await db.update(schema.events)
                .set({
                    title: title || existing.title,
                    category: cat,
                    dateStart,
                    dateEnd: dateEnd || null,
                    location: location || "",
                    description: description || "",
                    coverImage: coverImage || "",
                    tbaEventKey: tbaEventKey || null,
                    status,
                    contentDraft: null,
                    isPotluck: isPotluck ? 1 : 0,
                    isVolunteer: isVolunteer ? 1 : 0,
                    publishedAt: publishedAt || null,
                    seasonId: seasonId || null,
                    meetingNotes: meetingNotes || null,
                    rrule: finalRrule || null,
                    recurringGroupId: finalRrule ? (existing.recurringGroupId || id) : null,
                    recurringException: isException,
                })
                .where(eq(schema.events.id, id))
                .run();
        }

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
                const dbSettings = await getDbSettings(c);
                const calendarId = (
                    cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                    cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                    cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                ) || dbSettings["CALENDAR_ID"] || "primary";

                if (calendarId) {
                    try {
                        const oauthToken = await getUnifiedOAuthToken(c.env, db);
                        const row = await db.select({
                            gcalEventId: schema.events.gcalEventId,
                        }).from(schema.events).where(eq(schema.events.id, id)).get();

                        const gcalId = await pushEventToGcal(
                            { id, title: title || "", dateStart: dateStart, dateEnd: dateEnd || undefined, location: location || undefined, description: description || undefined, coverImage: coverImage || undefined, gcalEventId: row?.gcalEventId || undefined, meetingNotes: meetingNotes || undefined },
                            calendarId,
                            oauthToken
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
        } catch (error) {
            console.error("Failed to update event:", error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(
                `Failed to update event: ${error instanceof Error ? error.message : "Unknown database error"}`,
                500,
                "EVENT_UPDATE_FAILED"
            );
        }
    },

    deleteEvent: async (input: HandlerInput, c: AresContext): Promise<ApiResponse<typeof deleteEventRoute>> => {
        const { params } = input;
        const { id } = params;
        const db = getDb(c);

        try {
            const existing = await db.select({
                gcalEventId: schema.events.gcalEventId,
                category: schema.events.category,
                recurringGroupId: schema.events.recurringGroupId,
                dateStart: schema.events.dateStart
            }).from(schema.events).where(eq(schema.events.id, id)).get();

            if (!existing) throw new ApiError("Event not found", 404);

            let deleteMode: "single" | "following" = "single";
            try {
                const body = await c.req.json() as { deleteMode?: "single" | "following" };
                if (body && body.deleteMode) {
                    deleteMode = body.deleteMode;
                }
            } catch (_) {
                // Ignore JSON parse errors for GET or empty DELETE requests
            }

            if (deleteMode === "following" && existing.recurringGroupId) {
                const followingEvents = await db.select({
                    id: schema.events.id,
                    gcalEventId: schema.events.gcalEventId
                })
                .from(schema.events)
                .where(and(
                    eq(schema.events.recurringGroupId, existing.recurringGroupId),
                    sql`${schema.events.dateStart} >= ${existing.dateStart}`
                ))
                .all();

                const followingIds = followingEvents.map(x => x.id);
                if (followingIds.length > 0) {
                    const CHUNK_SIZE = 20;
                    for (let i = 0; i < followingIds.length; i += CHUNK_SIZE) {
                        const chunk = followingIds.slice(i, i + CHUNK_SIZE);
                        await db.update(schema.events)
                            .set({ isDeleted: 1 })
                            .where(inArray(schema.events.id, chunk))
                            .run();
                    }
                }

                c.executionCtx.waitUntil((async () => {
                    const dbSettings = await getDbSettings(c);
                    const cat = existing.category || "internal";
                    const calendarId = (
                        cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                        cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                        cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                    ) || dbSettings["CALENDAR_ID"] || "primary";

                    if (calendarId) {
                        try {
                            const oauthToken = await getUnifiedOAuthToken(c.env, db);
                            for (const ev of followingEvents) {
                                if (ev.gcalEventId) {
                                    try {
                                        await deleteEventFromGcal(ev.gcalEventId, calendarId, oauthToken);
                                    } catch (err) {
                                        console.error("[Events:Delete] GCal delete failed for event:", ev.gcalEventId, err);
                                    }
                                }
                            }
                        } catch (err) {
                            console.error("[Events:Delete] Failed to get OAuth token or run cascading GCal delete:", err);
                        }
                    }
                })());

            } else {
                await db.update(schema.events).set({ isDeleted: 1 }).where(eq(schema.events.id, id)).run();

                c.executionCtx.waitUntil((async () => {
                    if (existing.gcalEventId) {
                        const dbSettings = await getDbSettings(c);
                        const cat = existing.category || "internal";
                        const calendarId = (
                            cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                            cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                            cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                        ) || dbSettings["CALENDAR_ID"] || "primary";

                        if (calendarId) {
                            try {
                                const oauthToken = await getUnifiedOAuthToken(c.env, db);
                                await deleteEventFromGcal(existing.gcalEventId, calendarId, oauthToken);
                            } catch (err) {
                                console.error("[Events:Delete] GCal delete failed for event:", existing.gcalEventId, err);
                            }
                        }
                    }
                })());
            }

            triggerBackgroundReindex(c.executionCtx, getDb(c), c.env.AI, c.env.VECTORIZE_DB);
            invalidateEventsCache(c);
            return { status: 200 as const, body: { success: true } };
        } catch (error) {
            console.error("Failed to delete event:", error);
            if (error instanceof ApiError) throw error;
            throw new ApiError(
                `Failed to delete event: ${error instanceof Error ? error.message : "Unknown database error"}`,
                500,
                "EVENT_DELETE_FAILED"
            );
        }
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

            const dbSettings = await getDbSettings(c);
            const cat = targetRow.category || "internal";
            const calendarId = (
                cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
            ) || dbSettings["CALENDAR_ID"] || "primary";

            if (calendarId) {
                try {
                    const oauthToken = await getUnifiedOAuthToken(c.env, db);
                    const gcalId = await pushEventToGcal(
                        { id: targetRow.id as string, title: targetRow.title, dateStart: targetRow.dateStart, dateEnd: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, coverImage: targetRow.coverImage || undefined, gcalEventId: targetRow.gcalEventId || undefined, meetingNotes: targetRow.meetingNotes || undefined },
                        calendarId,
                        oauthToken
                    );
                    if (gcalId && gcalId !== targetRow.gcalEventId) {
                        await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, targetRow.id)).run();
                    }
                } catch (e) { console.error("GCAL_APPROVE_FAIL", e); }
            }

            const socialConfig = await getDbSettings(c);
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

            const dbSettings = await getDbSettings(c);
            const cat = targetRow.category || "internal";
            const calendarId = (
                cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
            ) || dbSettings["CALENDAR_ID"] || "primary";

            if (calendarId) {
                try {
                    const oauthToken = await getUnifiedOAuthToken(c.env, db);
                    const gcalId = await pushEventToGcal(
                        { id: targetRow.id as string, title: targetRow.title, dateStart: targetRow.dateStart, dateEnd: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, coverImage: targetRow.coverImage || undefined, gcalEventId: targetRow.gcalEventId || undefined, meetingNotes: targetRow.meetingNotes || undefined },
                        calendarId,
                        oauthToken
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
                const dbSettings = await getDbSettings(c);
                const cat = row.category || "internal";
                const calendarId = (
                    cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                    cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                    cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
                ) || dbSettings["CALENDAR_ID"] || "primary";

                if (calendarId) {
                    try {
                        const oauthToken = await getUnifiedOAuthToken(c.env, db);
                        await deleteEventFromGcal(row.gcalEventId, calendarId, oauthToken);
                    } catch (err) {
                        console.error("[Events:HardDelete] GCal delete failed for event:", row.gcalEventId, err);
                    }
                }
            }
        })());

        invalidateEventsCache(c);
        return { status: 200 as const, body: { success: true } };
    },

    repushEvent: async (input: HandlerInput<{ socials?: string[] }>, c: AresContext): Promise<ApiResponse<typeof repushEventRoute>> => {
        const { params, body } = input;
        const { id } = params;
        const db = getDb(c);
        const event = await db.select().from(schema.events).where(eq(schema.events.id, id)).get();
        if (!event) throw new ApiError("Event not found", 404);

        const socialConfig = await getDbSettings(c);
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
            const dbSettings = await getDbSettings(c);
            const cat = event.category || "internal";
            const calendarId = (
                cat === "internal" ? dbSettings["CALENDAR_ID_INTERNAL"] :
                cat === "outreach" ? dbSettings["CALENDAR_ID_OUTREACH"] :
                cat === "external" ? dbSettings["CALENDAR_ID_EXTERNAL"] : null
            ) || dbSettings["CALENDAR_ID"] || "primary";

            if (calendarId) {
                try {
                    const oauthToken = await getUnifiedOAuthToken(c.env, db);
                    const gcalId = await pushEventToGcal(
                        { id: event.id, title: event.title, dateStart: event.dateStart, dateEnd: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, coverImage: event.coverImage || undefined, gcalEventId: event.gcalEventId || undefined, meetingNotes: event.meetingNotes || undefined },
                        calendarId,
                        oauthToken
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
};

// Set forward reference for self-delegation
writeHandlersRef = writeHandlers;
