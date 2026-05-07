/* eslint-disable @typescript-eslint/no-explicit-any -- Event handlers work with dynamic external data (Gcal, rrule, Zulip, etc.) */
import { getSocialConfig, getSessionUser, getDbSettings, logAuditAction } from "../../middleware";
import { triggerBackgroundReindex } from "../ai/autoReindex";
import { pushEventToGcal, pullEventsFromGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { sql, Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { rrulestr } from 'rrule';
import type { HandlerInput, HonoContext } from "@shared/types/api";
import type { SelectableRow } from "@shared/types/database";

import { eq, or, and, ne, isNull } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";

import type { SocialConfig } from "../../middleware";

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 * Removes special characters that could be used to manipulate FTS queries.
 */
const sanitizeFtsQuery = (query: string): string => {
  // Remove double quotes, backslashes, and other FTS special chars
  return query.replace(/["\\^*-:]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
};

type EventSaveBody = {
  id?: string;
  title?: string;
  category?: string;
  dateStart?: string;
  dateEnd?: string;
  location?: string;
  description?: string;
  coverImage?: string;
  tbaEventKey?: string;
  socials?: Record<string, boolean>;
  isPotluck?: boolean;
  isVolunteer?: boolean;
  isDraft?: boolean;
  publishedAt?: string;
  seasonId?: number;
  meetingNotes?: string;
  recurrenceRule?: string;
  parentEventId?: string;
  originalStartTime?: string;
  rrule?: string;
  updateMode?: string;
  deleteMode?: string;
};



type SignupBody = {
  bringing?: string;
  notes?: string;
  prep_hours?: number;
  attended?: boolean;
};

type SocialsBody = {
  socials?: string[];  // repush uses array format
};

// Type for partial event results from fallback queries (older schema compatibility)
type PartialEvent = Pick<SelectableRow<"events">, "id" | "title" | "category" | "date_start" | "date_end" | "location" | "description" | "cover_image" | "season_id" | "is_deleted"> & {
  status?: string | null;
  meeting_notes?: string | null;
  zulip_stream?: string | null;
  zulip_topic?: string | null;
};

export const eventHandlers = {
  getEvents: async (input: HandlerInput, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as any;
      const { limit = 50, offset = 0, q } = query;

      if (q) {
        // Sanitize FTS query to prevent SQL injection via SQLite FTS syntax
        const cleanQ = sanitizeFtsQuery(String(q || ''));
        const results = await sql<{ id: string, title: string, category: string, date_start: string, date_end: string | null, location: string | null, description: string | null, cover_image: string | null, status: string, is_deleted: number, season_id: number | null, meeting_notes: string | null, tba_event_key: string | null, recurring_exception: number, is_potluck: number, is_volunteer: number }>`
          SELECT e.id, e.title, e.category, e.date_start, e.date_end, e.location, e.description, e.cover_image, e.status, e.is_deleted, e.season_id, e.meeting_notes, e.tba_event_key, e.recurring_exception, e.is_potluck, e.is_volunteer
           FROM events_fts f
           JOIN events e ON f.id = e.id
           WHERE e.is_deleted = 0 AND e.status = 'published' AND (e.published_at IS NULL OR datetime(e.published_at) <= datetime('now'))
           AND f.events_fts MATCH ${cleanQ}
           ORDER BY f.rank LIMIT ${Number(limit) || 50} OFFSET ${Number(offset) || 0}
        `.execute(db);
        
        const events = results.rows.map((e: any) => ({
          ...e,
          season_id: e.season_id ? Number(e.season_id) : null,
          is_deleted: Number(e.is_deleted || 0)
        }));

        return { status: 200 as const, body: { events } };
      }

      let results;
      try {
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes", "tba_event_key", "recurring_exception", "is_potluck", "is_volunteer"])
          .where("is_deleted", "=", 0)
          .where("status", "=", "published")
          .where((eb: any) => eb.or([
            eb("published_at", "is", null),
            eb("published_at", "<=", new Date().toISOString())
          ]))
          .orderBy("date_start", "desc")
          .limit(Number(limit) || 50)
          .offset(Number(offset) || 0)
          .execute();
      } catch (_errInner) {
        // Fallback for older schemas
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .where("is_deleted", "=", 0)
          .orderBy("date_start", "desc")
          .limit(Number(limit) || 50)
          .offset(Number(offset) || 0)
          .execute() as PartialEvent[];
      }

      // Resolve location addresses from the locations registry
      const locationNames = [...new Set(results.map((e: any) => e.location).filter(Boolean))] as string[];
      const locationMap: Record<string, string> = {};
      if (locationNames.length > 0) {
        try {
          const locs = await db.selectFrom("locations").select(["name", "address"]).where("name", "in", locationNames).execute();
          locs.forEach((l: any) => { if (l.address) locationMap[l.name] = l.address; });
        } catch { /* locations table may not exist */ }
      }

      const events = results.map((e: any) => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0),
        status: e.status ?? "published",
        category: e.category ?? "internal",
        meeting_notes: e.meeting_notes ?? null,
        location_address: e.location ? (locationMap[e.location] || null) : null
      }));

      return { status: 200 as const, body: { events } };
    } catch (e) {
      console.error("[Events:List] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch events" } };
    }
  },
  getCalendarSettings: async (_input: HandlerInput, c: any) => {
    try {
      const db = c.get("db") as any;
      const results = await db.selectFrom("settings")
        .select(["key", "value"])
        .where("key", "in", ["CALENDAR_ID", "CALENDAR_ID_INTERNAL", "CALENDAR_ID_OUTREACH", "CALENDAR_ID_EXTERNAL"])
        .execute();

      const map = results.reduce((acc: any, row: any) => ({ ...acc, [row.key ?? ""]: row.value ?? "" }), {});
      
      return { status: 200 as const, body: { 
        calendarIdInternal: map["CALENDAR_ID_INTERNAL"] || map["CALENDAR_ID"] || "",
        calendarIdOutreach: map["CALENDAR_ID_OUTREACH"] || "",
        calendarIdExternal: map["CALENDAR_ID_EXTERNAL"] || "",
      } };
    } catch (e) {
      console.error("[Events:CalendarSettings] Error", e);
      return { status: 500 as const, body: {} };
    }
  },
  getEvent: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      const user = await getSessionUser(c);

      const row = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes", "zulip_stream", "zulip_topic", "tba_event_key", "recurring_exception", "is_potluck", "is_volunteer"])
        .where("id", "=", id)
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!row) return { status: 404 as const, body: { error: "Event not found" } };

      // Resolve location address from locations registry
      let locationAddress: string | null = null;
      if (row.location) {
        try {
          const loc = await db.selectFrom("locations").select("address").where("name", "=", row.location).executeTakeFirst();
          locationAddress = loc?.address || null;
        } catch { /* locations table may not exist */ }
      }

      return { 
        status: 200 as const, 
        body: { 
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0),
            meeting_notes: (user && user.role !== "unverified") ? row.meeting_notes : null,
            location_address: locationAddress
          },
          is_editor: user?.role === "admin"
        }
      };
    } catch (e) {
      console.error("[Events:Detail] Error", e);
      return { status: 404 as const, body: { error: "Database error" } };
    }
  },
  getAdminEvents: async (input: HandlerInput, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as any;
      const { limit = 100, cursor } = query;
      
      let baseQuery = db.selectFrom("events").orderBy("date_start", "desc").limit(Number(limit) || 100);
      
      if (cursor) {
        baseQuery = baseQuery.where("date_start", "<", cursor);
      }
      
      let results;
      try {
        results = await baseQuery
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes", "zulip_stream", "zulip_topic", "tba_event_key", "recurring_exception", "is_potluck", "is_volunteer"])
          .execute();
      } catch {
        results = await baseQuery
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .execute() as PartialEvent[];
      }
      
      const lastSyncRow = await db.selectFrom("settings").select("value").where("key", "=", "LAST_CALENDAR_SYNC").executeTakeFirst();
      
      const events = results.map((e: any) => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0),
        status: e.status ?? "published",
        category: e.category ?? "internal",
        meeting_notes: e.meeting_notes ?? null
      }));

      const nextCursor = results.length === (Number(limit) || 100) ? results[results.length - 1].date_start : null;

      return { status: 200 as const, body: { events, lastSyncedAt: lastSyncRow?.value || null, nextCursor } };
    } catch (e) {
      console.error("[Events:AdminList] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch events" } };
    }
  },
  adminDetail: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      let row;
      try {
        row = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes", "tba_event_key", "recurring_exception", "is_potluck", "is_volunteer"])
          .where("id", "=", id)
          .executeTakeFirst();
      } catch {
        row = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .where("id", "=", id)
          .executeTakeFirst() as PartialEvent | undefined;
      }

      if (!row) return { status: 404 as const, body: { error: "Event not found" } };

      return { 
        status: 200 as const, 
        body: {
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0),
            status: row.status ?? "published",
            category: row.category ?? "internal",
            meeting_notes: row.meeting_notes ?? null
          }
        }
      };
    } catch (e) {
      console.error("[Events:AdminDetail] Error", e);
      return { status: 500 as const, body: { error: "Database error" } };
    }
  },
  saveEvent: async (input: HandlerInput<EventSaveBody>, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as any;

      if (body.id) {
        const existing = await db.selectFrom("events").select("id").where("id", "=", body.id).executeTakeFirst();
        if (existing) {
          return eventHandlers.updateEvent({ params: { id: body.id }, body, query: {} }, c);
        }
      }

      const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes, recurrenceRule, parentEventId, originalStartTime } = body;

      if (!dateStart) {
        return { status: 400 as const, body: { success: false, error: "dateStart is required" } };
      }

      const recent = await db.selectFrom("events")
        .select("id")
        .where("title", "=", title || "")
        .where("date_start", "=", dateStart)
        .where("is_deleted", "=", 0)
        .executeTakeFirst();
      
      if (recent) {
        return { status: 200 as const, body: { success: true, id: recent.id, warning: "Double-submission prevented" } };
      }

      const cat = category || 'internal';
      const genId = crypto.randomUUID();

      const socialConfig = await getSocialConfig(c);
      const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
      const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { success: false, error: "Authentication required" } };
      const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      const recurringGroupId = body.rrule ? crypto.randomUUID() : null;

      const MAX_RRULE_LENGTH = 200;
      const ALLOWED_RRULE_KEYS = ['FREQ', 'INTERVAL', 'UNTIL', 'COUNT', 'BYDAY', 'BYMONTHDAY', 'BYMONTH', 'BYSETPOS'];

      let instances: Array<{
        id: string;
        title: string;
        category: string;
        date_start: string;
        date_end: string | null;
        location: string;
        description: string;
        cover_image: string;
        gcal_event_id: string | null;
        status: string;
        is_potluck: number;
        is_volunteer: number;
        tba_event_key: string | null;
        published_at: string | null;
        season_id: number | null;
        meeting_notes: string | null;
        recurring_group_id: string | null;
        rrule: string | null;
        recurring_exception: number;
        recurrence_rule: string | null;
        parent_event_id: string | null;
        original_start_time: string | null;
        zulip_stream: string;
        zulip_topic: string;
      }> = [];
      if (body.rrule) {
        if (typeof body.rrule !== 'string' || body.rrule.length > MAX_RRULE_LENGTH) {
          return { status: 400 as const, body: { error: "Invalid recurrence rule: exceeds maximum length" } };
        }

        const upperRule = body.rrule.toUpperCase();
        const hasValidKey = ALLOWED_RRULE_KEYS.some((key: any) => upperRule.includes(`${key}=`));
        if (!hasValidKey) {
          return { status: 400 as const, body: { error: "Invalid recurrence rule format" } };
        }

        try {
          const rule = rrulestr(body.rrule, { dtstart: new Date(dateStart) });
          const dates = rule.all((d: any, i: any) => i < 52); 
          
          const duration = dateEnd ? new Date(dateEnd).getTime() - new Date(dateStart).getTime() : 0;

          instances = dates.map((d: any, i: any) => {
             const instStart = d.toISOString();
             const instEnd = dateEnd ? new Date(d.getTime() + duration).toISOString() : null;
             return {
                id: i === 0 ? genId : crypto.randomUUID(),
                title: title || "", category: cat, date_start: instStart, date_end: instEnd,
                location: location || "", description: description || "", cover_image: coverImage || "",
                gcal_event_id: null, status,
                is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0, tba_event_key: tbaEventKey || null,
                published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
                recurring_group_id: recurringGroupId, rrule: body.rrule || null, recurring_exception: 0,
                recurrence_rule: recurrenceRule || body.rrule || null, parent_event_id: parentEventId || null, original_start_time: originalStartTime || null,
                zulip_stream: "events", zulip_topic: `Event: ${title || "Untitled"}`
             };
          });
        } catch(e) {
          console.error("Invalid rrule", e);
        }
      }

      if (instances.length === 0) {
        instances.push({
            id: genId, title: title || "", category: cat, date_start: dateStart, date_end: dateEnd || null,
            location: location || "", description: description || "", cover_image: coverImage || "",
            gcal_event_id: null, status,
            is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0, tba_event_key: tbaEventKey || null,
            published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
            recurring_group_id: null, rrule: null, recurring_exception: 0,
            recurrence_rule: recurrenceRule || body.rrule || null, parent_event_id: parentEventId || null, original_start_time: originalStartTime || null,
            zulip_stream: "events", zulip_topic: `Event: ${title || "Untitled"}`
        });
      }

      const CHUNK_SIZE = 5;
      for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
        await db.insertInto("events").values(instances.slice(i, i + CHUNK_SIZE)).execute();
      }

      if (description) {
        c.executionCtx.waitUntil(
          db.insertInto("document_history")
            .values({
              room_id: `event_${genId}`,
              content: description,
              created_by: user?.email || "anonymous_admin",
              created_at: new Date().toISOString()
            })
            .execute()
        );
      }

      c.executionCtx.waitUntil((async () => {
        if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: genId, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined, meeting_notes: meetingNotes || undefined, recurrence_rule: recurrenceRule || body.rrule || undefined, parent_gcal_id: parentEventId || undefined, original_start_time: originalStartTime || undefined },
              { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
            );
            if (gcalId) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", genId).execute();
            }
          } catch (e) { console.error("GCAL_SAVE_FAIL", e); }
        }

        if (status === "published") {
          const baseUrl = new URL(c.req.url).origin;
          if (socials) {
          await dispatchSocials(db, { title: title || "", url: `${baseUrl}/events`, snippet: "New event scheduled!", thumbnail: coverImage || "/gallery_1.png", baseUrl }, socialConfig, socials).catch(() => {});
          }
          const eventTopic = `Event: ${title}`;
          const eventContent = `📅 **New Event Scheduled**\n\n**Title:** ${title}\n**Location:** ${location || "TBD"}\n\n[View Event](${baseUrl}/events)`;
          await sendZulipMessage(socialConfig, "events", eventTopic, eventContent).catch(() => {});
        }
      })());

      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_EVENT", "events", genId, `Created event: ${title} (${status})`));
      triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);

      return { status: 200 as const, body: { success: true, id: genId } };
    } catch (e) {
      console.error("[Events:Save] Error", e);
      const errorMessage = e instanceof Error ? e.message : "Write failed";
      return { status: 500 as const, body: { success: false, error: errorMessage } };
    }
  },
  updateEvent: async (input: HandlerInput<EventSaveBody>, c: any) => {
    const { params, body } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes } = body;

      if (!dateStart) {
        return { status: 400 as const, body: { error: "dateStart is required" } };
      }

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
      if (!existing) return { status: 404 as const, body: { error: "Event not found" } };

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
                { id, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined, gcal_event_id: row?.gcalEventId || undefined, meeting_notes: meetingNotes || undefined },
                { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
              );
              if (gcalId && gcalId !== row?.gcalEventId) {
                await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, id)).run();
              }
            } catch (e) { console.error("GCAL_UPDATE_FAIL", e); }
          }
        }
      })());

      triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);
      return { status: 200 as const, body: { success: true, id } };
    } catch (e) {
      console.error("[Events:Update] Error", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } };
    }
  },
  deleteEvent: async (input: HandlerInput<Pick<EventSaveBody, 'deleteMode'>>, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      const existing = await db.select({
        gcalEventId: schema.events.gcalEventId,
        category: schema.events.category
      }).from(schema.events).where(eq(schema.events.id, id)).get();
      
      await db.update(schema.events).set({ isDeleted: 1 }).where(eq(schema.events.id, id)).run();

      c.executionCtx.waitUntil((async () => {
        if (existing && existing.gcalEventId) {
          const socialConfig = await getSocialConfig(c);
          const cat = existing.category || "internal";
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;
          
          if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
            try {
              await deleteEventFromGcal(existing.gcalEventId, {
                email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string,
                privateKey: socialConfig.GCAL_PRIVATE_KEY as string,
                calendarId: calId              });
            } catch { /* ignore GCal failure */ }
          }
        }
      })());

      triggerBackgroundReindex(c.executionCtx, c.get("db"), c.env.AI, c.env.VECTORIZE_DB);
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:Delete] Error", e);
      return { status: 500 as const, body: { success: false, error: "Delete failed" } };
    }
  },
  approveEvent: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      const row = await db.select({
        id: schema.events.id,
        title: schema.events.title,
        category: schema.events.category,
        dateStart: schema.events.dateStart,
        dateEnd: schema.events.dateEnd,
        location: schema.events.location,
        description: schema.events.description,
        coverImage: schema.events.coverImage,
        tbaEventKey: schema.events.tbaEventKey,
        status: schema.events.status,
        isPotluck: schema.events.isPotluck,
        isVolunteer: schema.events.isVolunteer,
        seasonId: schema.events.seasonId,
        meetingNotes: schema.events.meetingNotes,
        revisionOf: schema.events.revisionOf,
        gcalEventId: schema.events.gcalEventId
      }).from(schema.events).where(eq(schema.events.id, id)).get();
      
      if (row && row.revisionOf) {
        await db.update(schema.events)
          .set({ title: row.title, dateStart: row.dateStart, dateEnd: row.dateEnd, location: row.location, description: row.description, coverImage: row.coverImage, tbaEventKey: row.tbaEventKey, status: 'published', isPotluck: row.isPotluck, isVolunteer: row.isVolunteer, seasonId: row.seasonId, meetingNotes: row.meetingNotes })
          .where(eq(schema.events.id, row.revisionOf))
          .run();
        await db.delete(schema.events).where(eq(schema.events.id, id)).run();
      } else {
        await db.update(schema.events).set({ status: 'published' }).where(eq(schema.events.id, id)).run();
      }

      c.executionCtx.waitUntil((async () => {
        const targetId = row?.revisionOf || id;
        const targetRow = await db.select().from(schema.events).where(eq(schema.events.id, targetId)).get();
        if (!targetRow) return;
        
        const socialConfig = await getSocialConfig(c);
        const cat = targetRow.category || "internal";
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
        const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

        if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: targetRow.id as string, title: targetRow.title, date_start: targetRow.dateStart, date_end: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.coverImage || undefined, gcal_event_id: targetRow.gcalEventId || undefined, meeting_notes: targetRow.meetingNotes || undefined },
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
        await sendZulipMessage(socialConfig, "events", eventTopic, eventContent).catch(() => {});
      })());

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:Approve] Error", e);
      return { status: 500 as const, body: { success: false, error: "Approval failed" } };
    }
  },
  rejectEvent: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
      await db.update(schema.events).set({ status: 'rejected' }).where(eq(schema.events.id, id)).run();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:Reject] Error", e);
      return { status: 500 as const, body: { success: false, error: "Rejection failed" } };
    }
  },
  undeleteEvent: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
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
              { id: targetRow.id as string, title: targetRow.title, date_start: targetRow.dateStart, date_end: targetRow.dateEnd || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.coverImage || undefined, gcal_event_id: targetRow.gcalEventId || undefined, meeting_notes: targetRow.meetingNotes || undefined },
              { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: socialConfig.GCAL_PRIVATE_KEY, calendarId: calId }
            );
            if (gcalId && gcalId !== targetRow.gcalEventId) {
              await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, targetRow.id)).run();
            }
          } catch (e) { console.error("GCAL_UNDELETE_FAIL", e); }
        }
      })());

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:Undelete] Error", e);
      return { status: 500 as const, body: { success: false, error: "Restore failed" } };
    }
  },
  purgeEvent: async (input: HandlerInput, c: any) => {
    const { params } = input;
    const { id } = params;
    try {
      const db = c.get("db") as any;
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
                calendarId: calId              });
            } catch { /* ignore GCal failure */ }
          }
        }
      })());

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:Purge] Error", e);
      return { status: 500 as const, body: { success: false, error: "Purge failed" } };
    }
  },
  syncEvents: async (_input: HandlerInput, c: HonoContext) => {
    try {
      const db = c.get("db") as any;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];

      const calendars = [
        { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
        { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
        { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
      ].filter((cal: any) => !!cal.id);

      if (!gcalEmail || !gcalKey || calendars.length === 0) {
        return { status: 500 as const, body: { success: false, error: "GCal config missing" } };
      }

      let total = 0;
      const errors: string[] = [];

      for (const cal of calendars) {
        try {
          const events = await pullEventsFromGcal({ email: gcalEmail as string, privateKey: gcalKey as string, calendarId: cal.id as string });
          
          const CHUNK_SIZE = 20;
          for (let i = 0; i < events.length; i += CHUNK_SIZE) {
            const chunk = events.slice(i, i + CHUNK_SIZE).map((ev: any) => ({
              id: crypto.randomUUID(),
              title: ev.title,
              dateStart: ev.date_start,
              dateEnd: ev.date_end || null,
              location: ev.location,
              description: ev.description,
              gcalEventId: ev.gcal_event_id,
              status: 'published' as const,
              category: cal.category,
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
          
          total += events.length;
        } catch (calErr) {
          const msg = calErr instanceof Error ? calErr.message : String(calErr);
          console.error(`SYNC_EVENTS: Calendar ${cal.category} (${cal.id}) failed:`, msg);
          errors.push(`${cal.category}: ${msg}`);
        }
      }

      return { status: 200 as const, body: { success: true, count: total } };
    } catch (e) {
      console.error("[Events:Sync] Error", e);
      return { status: 500 as const, body: { success: false, error: "Sync failed" } };
    }
  },
  getSignups: async (input: HandlerInput, c: HonoContext) => {
    try {
      const { params } = input;
      const eventId = params.id;
      const user = await getSessionUser(c);
      const db = c.get("db") as any;
      const isVerified = user && user.role !== "unverified";
      const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.member_type || ""));

      const results = await db.select({
        userId: schema.eventSignups.userId,
        nickname: schema.userProfiles.nickname,
        avatar: schema.user.image,
        dietaryRestrictions: schema.userProfiles.dietaryRestrictions,
        bringing: schema.eventSignups.bringing,
        notes: schema.eventSignups.notes,
        prepHours: schema.eventSignups.prepHours,
        attended: schema.eventSignups.attended,
      }).from(schema.eventSignups)
        .innerJoin(schema.userProfiles, eq(schema.eventSignups.userId, schema.userProfiles.userId))
        .innerJoin(schema.user, eq(schema.eventSignups.userId, schema.user.id))
        .where(and(
          eq(schema.eventSignups.eventId, eventId),
          ne(schema.user.role, "unverified")
        ))
        .all();

      const signups = isVerified ? results.map((rec: any) => ({
        user_id: rec.userId,
        nickname: rec.nickname || null,
        bringing: rec.bringing || null,
        notes: (isManagement || (user && rec.userId === user.id)) ? rec.notes : null,
        prep_hours: Number(rec.prepHours || 0),
        attended: Number(rec.attended || 0),
        is_own: user ? rec.userId === user.id : false,
      })) : [];

      const dietarySummary: Record<string, number> = {};
      results.forEach((r: any) => {
        if (r.dietaryRestrictions) {
          const restrictions = r.dietaryRestrictions.split(',').map((st: string) => st.trim());
          restrictions.forEach((res: string) => {
            if (res) dietarySummary[res] = (dietarySummary[res] || 0) + 1;
          });
        }
      });

      return { status: 200 as const, body: { 
        signups, 
        dietary_summary: dietarySummary, 
        team_dietary_summary: {}, 
        authenticated: !!user, 
        role: user?.role || null, 
        member_type: user?.member_type || null, 
        can_manage: !!isManagement 
      } };
    } catch (e) {
      console.error("[Events:Signups] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch signups" } };
    }
  },
  submitSignup: async (input: HandlerInput<SignupBody>, c: HonoContext) => {
    const { params, body } = input;
    try {
      const user = await getSessionUser(c);
      if (!user || user.role === "unverified") return { status: 403 as const, body: { error: "Forbidden" } };
      const db = c.get("db") as any;
      await db.insert(schema.eventSignups)
        .values({ eventId: params.id, userId: user.id, bringing: body.bringing || "", notes: body.notes || "", prepHours: body.prep_hours || 0 })
        .onConflictDoUpdate({
          target: [schema.eventSignups.eventId, schema.eventSignups.userId],
          set: { bringing: sql`excluded.bringing`, notes: sql`excluded.notes`, prepHours: sql`excluded.prep_hours` }
        })
        .run();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:SubmitSignup] Error", e);
      return { status: 500 as const, body: { success: false, error: "Signup failed" } };
    }
  },
  deleteMySignup: async (input: HandlerInput, c: HonoContext) => {
    const { params } = input;
    try {
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };
      const db = c.get("db") as any;
      await db.delete(schema.eventSignups).where(and(eq(schema.eventSignups.eventId, params.id), eq(schema.eventSignups.userId, user.id))).run();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:DeleteSignup] Error", e);
      return { status: 500 as const, body: { success: false, error: "Failed to remove signup" } };
    }
  },
  updateMyAttendance: async (input: HandlerInput<Pick<SignupBody, 'attended'>>, c: HonoContext) => {
    const { params, body } = input;
    try {
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };
      const db = c.get("db") as any;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: user.id, attended: body.attended ? 1 : 0 })
        .onConflict((oc: any) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
        .execute();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:UpdateMyAttendance] Error", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } };
    }
  },
  updateUserAttendance: async (input: HandlerInput<Pick<SignupBody, 'attended'>>, c: HonoContext) => {
    const { params, body } = input;
    try {
      const user = await getSessionUser(c);
      if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.member_type || "")) return { status: 401 as const, body: { error: "Unauthorized" } };
      const db = c.get("db") as any;
      await db.insert(schema.eventSignups)
        .values({ eventId: params.id, userId: params.userId, attended: body.attended ? 1 : 0 })
        .onConflictDoUpdate({
          target: [schema.eventSignups.eventId, schema.eventSignups.userId],
          set: { attended: body.attended ? 1 : 0 }
        })
        .run();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:UpdateUserAttendance] Error", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } };
    }
  },
  repushEvent: async (input: HandlerInput<SocialsBody>, c: HonoContext) => {
    const { params, body } = input;
    const user = await getSessionUser(c);
    if (user?.role !== "admin" && user?.role !== "author") return { status: 401 as const, body: { error: "Unauthorized" } };
    const db = c.get("db") as any;
    try {
      const event = await db.select().from(schema.events).where(eq(schema.events.id, params.id)).get();
      if (!event) return { status: 404 as const, body: { error: "Event not found" } };

      const social = await getSocialConfig(c);
      const baseUrl = new URL(c.req.url).origin;
      const socialsFilter: Record<string, boolean> = {};
      if (body.socials) {
        for (const s of body.socials) socialsFilter[s] = true;
      }

      await dispatchSocials(
        db,
        {
          title: event.title,
          url: `${baseUrl}/events/${event.id}`,
          snippet: event.description || "",
          thumbnail: event.coverImage || undefined,
        },
        social,
        socialsFilter
      );

      const cat = event.category || "internal";
      const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
      const calId = (social as Record<string, string | undefined>)[calKey] || social.CALENDAR_ID;

      if (social.GCAL_SERVICE_ACCOUNT_EMAIL && social.GCAL_PRIVATE_KEY && calId) {
        try {
          const gcalId = await pushEventToGcal(
            { id: event.id as string, title: event.title, date_start: event.dateStart, date_end: event.dateEnd || undefined, location: event.location || undefined, description: event.description || undefined, cover_image: event.coverImage || undefined, gcal_event_id: event.gcalEventId || undefined, meeting_notes: event.meetingNotes || undefined },
            { email: social.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: social.GCAL_PRIVATE_KEY, calendarId: calId }
          );
          if (gcalId && gcalId !== event.gcalEventId) {
            await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
          }
        } catch (e) {
          console.error("REPUSH_EVENT_GCAL ERROR", e);
        }
      }

      return { status: 200 as const, body: { success: true } };
    } catch (err) {
      console.error("[Events:Repush] Error", err);
      return { status: 502 as const, body: { error: String(err) } };
    }
  },
  repairCalendar: async (_input: HandlerInput, c: HonoContext) => {
    try {
      const db = c.get("db") as any;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];

      if (!gcalEmail || !gcalKey) {
        return { status: 500 as const, body: { success: false, error: "GCal service account not configured" } };
      }

      const missing = await db.select({
        id: schema.events.id,
        title: schema.events.title,
        category: schema.events.category,
        dateStart: schema.events.dateStart,
        dateEnd: schema.events.dateEnd,
        location: schema.events.location,
        description: schema.events.description,
        coverImage: schema.events.coverImage,
        gcalEventId: schema.events.gcalEventId,
        meetingNotes: schema.events.meetingNotes
      })
      .from(schema.events)
      .where(and(
        eq(schema.events.isDeleted, 0),
        eq(schema.events.status, "published"),
        or(
          isNull(schema.events.gcalEventId),
          eq(schema.events.gcalEventId, "")
        )
      ))
      .all();

      console.log(`[Events:RepairCalendar] Found ${missing.length} events missing from GCal`);

      let pushed = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const event of missing) {
        const cat = event.category || "internal";
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}`;
        const calId = dbSettings[calKey] || dbSettings["CALENDAR_ID"];

        if (!calId) {
          errors.push(`${event.title}: No calendar ID configured for category "${cat}"`);
          failed++;
          continue;
        }

        try {
          const gcalId = await pushEventToGcal(
            {
              id: event.id as string,
              title: event.title,
              date_start: event.dateStart,
              date_end: event.dateEnd || undefined,
              location: event.location || undefined,
              description: event.description || undefined,
              cover_image: event.coverImage || undefined,
              meeting_notes: event.meetingNotes || undefined,
            },
            {
              email: gcalEmail as string,
              privateKey: gcalKey as string,
              calendarId: calId as string,
            }
          );

          if (gcalId) {
            await db.update(schema.events).set({ gcalEventId: gcalId }).where(eq(schema.events.id, event.id)).run();
            pushed++;
          } else {
            errors.push(`${event.title}: GCal returned no ID`);
            failed++;
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error(`[Events:RepairCalendar] Failed to push "${event.title}":`, msg);
          errors.push(`${event.title}: ${msg}`);
          failed++;
        }
      }

      console.log(`[Events:RepairCalendar] Complete — pushed: ${pushed}, failed: ${failed}`);
      return { status: 200 as const, body: { success: true, pushed, failed, errors: errors.length > 0 ? errors : undefined } };
    } catch (e) {
      console.error("[Events:RepairCalendar] Error", e);
      return { status: 500 as const, body: { success: false, error: "Repair failed" } };
    }
  },
};

