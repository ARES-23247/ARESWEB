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
      const db = c.get("db") as Kysely<DB>;
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
        
        const events = results.rows.map(e => ({
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
          .where((eb) => eb.or([
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
      const locationNames = [...new Set(results.map(e => e.location).filter(Boolean))] as string[];
      const locationMap: Record<string, string> = {};
      if (locationNames.length > 0) {
        try {
          const locs = await db.selectFrom("locations").select(["name", "address"]).where("name", "in", locationNames).execute();
          locs.forEach(l => { if (l.address) locationMap[l.name] = l.address; });
        } catch { /* locations table may not exist */ }
      }

      const events = results.map(e => ({
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
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("settings")
        .select(["key", "value"])
        .where("key", "in", ["CALENDAR_ID", "CALENDAR_ID_INTERNAL", "CALENDAR_ID_OUTREACH", "CALENDAR_ID_EXTERNAL"])
        .execute();

      const map = results.reduce<Record<string, string>>((acc, row) => ({ ...acc, [row.key ?? ""]: row.value ?? "" }), {});
      
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
      const db = c.get("db") as Kysely<DB>;
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
      const db = c.get("db") as Kysely<DB>;
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
      
      const events = results.map(e => ({
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
      const db = c.get("db") as Kysely<DB>;
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
      const db = c.get("db") as Kysely<DB>;

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
        const hasValidKey = ALLOWED_RRULE_KEYS.some(key => upperRule.includes(`${key}=`));
        if (!hasValidKey) {
          return { status: 400 as const, body: { error: "Invalid recurrence rule format" } };
        }

        try {
          const rule = rrulestr(body.rrule, { dtstart: new Date(dateStart) });
          const dates = rule.all((d, i) => i < 52); 
          
          const duration = dateEnd ? new Date(dateEnd).getTime() - new Date(dateStart).getTime() : 0;

          instances = dates.map((d, i) => {
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
      const db = c.get("db") as Kysely<DB>;
      const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes, recurrenceRule, parentEventId, originalStartTime } = body;

      if (!dateStart) {
        return { status: 400 as const, body: { error: "dateStart is required" } };
      }

      const cat = category || 'internal';

      const user = await getSessionUser(c);
      const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      if (user?.role !== "admin") {
        const revId = `${id}-rev-${Math.random().toString(36).substring(2, 6)}`;
        await db.insertInto("events")
          .values({
            id: revId, title: title || "", category: cat, date_start: dateStart, date_end: dateEnd || null,
            location: location || "", description: description || "", cover_image: coverImage || "",
            tba_event_key: tbaEventKey || null, status: 'pending',
            is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
            revision_of: id, published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
            zulip_stream: "events", zulip_topic: `Event: ${title || "Untitled"}`
          })
          .execute();
        return { status: 200 as const, body: { success: true, id: revId } };
      }

      const existing = await db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst();
      if (!existing) return { status: 404 as const, body: { error: "Event not found" } };

      if (body.updateMode === "following" && existing.recurring_group_id) {
        await db.deleteFrom("events")
          .where("recurring_group_id", "=", existing.recurring_group_id)
          .where("date_start", ">", existing.date_start)
          .where("recurring_exception", "=", 0)
          .execute();

        if (body.rrule) {
          try {
            const rule = rrulestr(body.rrule, { dtstart: new Date(dateStart) });
            const dates = rule.all((d, i) => i < 52); 
            const duration = dateEnd ? new Date(dateEnd).getTime() - new Date(dateStart).getTime() : 0;
            const instances = dates.slice(1).map((d) => {
              const instStart = d.toISOString();
              const instEnd = dateEnd ? new Date(d.getTime() + duration).toISOString() : null;
              return {
                id: crypto.randomUUID(),
                title: title || "", category: cat, date_start: instStart, date_end: instEnd,
                location: location || "", description: description || "", cover_image: coverImage || "",
                gcal_event_id: null, status,
                is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0, tba_event_key: tbaEventKey || null,
                published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
                recurring_group_id: existing.recurring_group_id, rrule: body.rrule, recurring_exception: 0
              };
            });
            if (instances.length > 0) {
              const CHUNK_SIZE = 5;
              for (let i = 0; i < instances.length; i += CHUNK_SIZE) {
                await db.insertInto("events").values(instances.slice(i, i + CHUNK_SIZE)).execute();
              }
            }
          } catch(e) { console.error("RRule update parse error", e); }
        }

        await db.updateTable("events")
          .set({
            title, category: cat, date_start: dateStart, date_end: dateEnd || null,
            location: location || "", description: description || "", cover_image: coverImage || "",
            tba_event_key: tbaEventKey || null, status, content_draft: null,
            is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
            published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
            updated_at: new Date().toISOString(),
            rrule: body.rrule || existing.rrule,
            recurrence_rule: recurrenceRule || body.rrule || existing.recurrence_rule,
            recurring_exception: 0
          })
          .where("id", "=", id)
          .execute();
      } else {
        await db.updateTable("events")
          .set({
            title, category: cat, date_start: dateStart, date_end: dateEnd || null,
            location: location || "", description: description || "", cover_image: coverImage || "",
            tba_event_key: tbaEventKey || null, status, content_draft: null,
            is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
            published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null,
            updated_at: new Date().toISOString(),
            recurring_exception: existing.recurring_group_id ? 1 : 0,
            original_start_time: existing.recurring_group_id && !existing.recurring_exception ? existing.date_start : (originalStartTime || existing.original_start_time)
          })
          .where("id", "=", id)
          .execute();
      }

      if (description) {
        c.executionCtx.waitUntil(
          db.insertInto("document_history")
            .values({
              room_id: `event_${id}`,
              content: description,
              created_by: user?.email || "anonymous",
              created_at: new Date().toISOString()
            })
            .execute()
        );
      }

      c.executionCtx.waitUntil((async () => {
        if (status === "published") {
          const socialConfig = await getSocialConfig(c);
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;
          
          if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
            try {
              const row = await db.selectFrom("events").select(["gcal_event_id", "original_start_time", "recurring_group_id"]).where("id", "=", id).executeTakeFirst();
              
              let parentGcalId = parentEventId;
              let origStart = originalStartTime || row?.original_start_time;

              if (existing.recurring_group_id && body.updateMode !== "following") {
                const parent = await db.selectFrom("events").select("gcal_event_id").where("recurring_group_id", "=", existing.recurring_group_id).where("recurring_exception", "=", 0).orderBy("date_start", "asc").executeTakeFirst();
                if (parent?.gcal_event_id) {
                  parentGcalId = parent.gcal_event_id;
                  origStart = origStart || existing.date_start;
                }
              }

              const gcalId = await pushEventToGcal(
                { id, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined, gcal_event_id: row?.gcal_event_id || undefined, meeting_notes: meetingNotes || undefined, recurrence_rule: recurrenceRule || body.rrule || existing.recurrence_rule || undefined, parent_gcal_id: parentGcalId || undefined, original_start_time: origStart || undefined },
                { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
              );
              if (gcalId && gcalId !== row?.gcal_event_id) {
                await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", id).execute();
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
    const { params, body } = input;
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const existing = await db.selectFrom("events").select(["recurring_group_id", "date_start", "recurrence_rule", "parent_event_id", "gcal_event_id", "category"]).where("id", "=", id).executeTakeFirst();
      
      let gcalAction = "delete";
      let updatedRrule = existing?.recurrence_rule;

      if (body?.deleteMode === "following" && existing?.recurring_group_id) {
        await db.updateTable("events")
          .set({ is_deleted: 1, updated_at: new Date().toISOString() })
          .where("recurring_group_id", "=", existing.recurring_group_id)
          .where("date_start", ">=", existing.date_start)
          .execute();
          
        if (existing.recurrence_rule && !existing.parent_event_id) {
          gcalAction = "update";
          const d = new Date(existing.date_start);
          const untilDate = d.toISOString().split("T")[0].replace(/-/g, "") + "T000000Z";
          updatedRrule = existing.recurrence_rule.includes("UNTIL=") 
              ? existing.recurrence_rule.replace(/UNTIL=[^;]+/, `UNTIL=${untilDate}`)
              : `${existing.recurrence_rule};UNTIL=${untilDate}`;
          
          await db.updateTable("events").set({ recurrence_rule: updatedRrule }).where("id", "=", id).execute();
        }
      } else {
        await db.updateTable("events").set({ is_deleted: 1, updated_at: new Date().toISOString() }).where("id", "=", id).execute();
      }

      c.executionCtx.waitUntil((async () => {
        if (existing && existing.gcal_event_id) {
          const socialConfig = await getSocialConfig(c);
          const cat = existing.category || "internal";
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;
          
          if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
            try {
              if (gcalAction === "update" && updatedRrule) {
                const fullRow = await db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst();
                if (fullRow) {
                  await pushEventToGcal(
                    { id: fullRow.id as string, title: fullRow.title, date_start: fullRow.date_start, date_end: fullRow.date_end || undefined, location: fullRow.location || undefined, description: fullRow.description || undefined, cover_image: fullRow.cover_image || undefined, gcal_event_id: fullRow.gcal_event_id || undefined, recurrence_rule: updatedRrule },
                    { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string, privateKey: socialConfig.GCAL_PRIVATE_KEY as string, calendarId: calId as string }
                  );
                }
              } else {
                await deleteEventFromGcal(existing.gcal_event_id, {
                  email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL as string,
                  privateKey: socialConfig.GCAL_PRIVATE_KEY as string,
                  calendarId: calId                });
              }
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
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("events").select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "tba_event_key", "status", "is_potluck", "is_volunteer", "season_id", "meeting_notes", "revision_of", "gcal_event_id"]).where("id", "=", id).executeTakeFirst();
      if (row && row.revision_of) {
        await db.updateTable("events")
          .set({ title: row.title, date_start: row.date_start, date_end: row.date_end, location: row.location, description: row.description, cover_image: row.cover_image, tba_event_key: row.tba_event_key, status: 'published', is_potluck: row.is_potluck, is_volunteer: row.is_volunteer, season_id: row.season_id, meeting_notes: row.meeting_notes })
          .where("id", "=", row.revision_of)
          .execute();
        await db.deleteFrom("events").where("id", "=", id).execute();
      } else {
        await db.updateTable("events").set({ status: 'published' }).where("id", "=", id).execute();
      }

      c.executionCtx.waitUntil((async () => {
        const targetId = row?.revision_of || id;
        const targetRow = await db.selectFrom("events").selectAll().where("id", "=", targetId).executeTakeFirst();
        if (!targetRow) return;
        
        const socialConfig = await getSocialConfig(c);
        const cat = targetRow.category || "internal";
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
        const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

        if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: targetRow.id as string, title: targetRow.title, date_start: targetRow.date_start, date_end: targetRow.date_end || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.cover_image || undefined, gcal_event_id: targetRow.gcal_event_id || undefined, meeting_notes: targetRow.meeting_notes || undefined },
              { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: socialConfig.GCAL_PRIVATE_KEY, calendarId: calId }
            );
            if (gcalId && gcalId !== targetRow.gcal_event_id) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", targetRow.id).execute();
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
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ status: 'rejected', updated_at: new Date().toISOString() }).where("id", "=", id).execute();
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
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ is_deleted: 0, updated_at: new Date().toISOString() }).where("id", "=", id).execute();

      c.executionCtx.waitUntil((async () => {
        const targetRow = await db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst();
        if (!targetRow || targetRow.status !== "published") return;
        
        const socialConfig = await getSocialConfig(c);
        const cat = targetRow.category || "internal";
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof SocialConfig;
        const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;

        if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: targetRow.id as string, title: targetRow.title, date_start: targetRow.date_start, date_end: targetRow.date_end || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.cover_image || undefined, gcal_event_id: targetRow.gcal_event_id || undefined, meeting_notes: targetRow.meeting_notes || undefined },
              { email: socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: socialConfig.GCAL_PRIVATE_KEY, calendarId: calId }
            );
            if (gcalId && gcalId !== targetRow.gcal_event_id) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", targetRow.id).execute();
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
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("events").select(["gcal_event_id", "category"]).where("id", "=", id).executeTakeFirst();
      await db.deleteFrom("events").where("id", "=", id).execute();

      c.executionCtx.waitUntil((async () => {
        if (row && row.gcal_event_id) {
          const socialConfig = await getSocialConfig(c);
          const cat = row.category || "internal";
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as Record<string, string | undefined>)[calKey] || socialConfig.CALENDAR_ID;
          
          if (socialConfig.GCAL_SERVICE_ACCOUNT_EMAIL && socialConfig.GCAL_PRIVATE_KEY && calId) {
            try {
              await deleteEventFromGcal(row.gcal_event_id, {
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
      const db = c.get("db") as Kysely<DB>;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];

      const calendars = [
        { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
        { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
        { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
      ].filter(cal => !!cal.id);

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
            const chunk = events.slice(i, i + CHUNK_SIZE).map(ev => ({
              id: crypto.randomUUID(),
              title: ev.title,
              date_start: ev.date_start,
              date_end: ev.date_end || null,
              location: ev.location,
              description: ev.description,
              gcal_event_id: ev.gcal_event_id,
              status: 'published' as const,
              category: cal.category,
              recurrence_rule: ev.recurrence_rule || null,
              parent_event_id: ev.parent_gcal_id || null,
              original_start_time: ev.original_start_time || null
            }));

            await db.insertInto("events")
              .values(chunk)
              .onConflict((oc) => oc.column("gcal_event_id").doUpdateSet({
                title: sql`excluded.title`,
                date_start: sql`excluded.date_start`,
                date_end: sql`excluded.date_end`,
                location: sql`excluded.location`,
                description: sql`excluded.description`,
                category: sql`excluded.category`,
                recurrence_rule: sql`excluded.recurrence_rule`,
                parent_event_id: sql`excluded.parent_event_id`,
                original_start_time: sql`excluded.original_start_time`
              }))
              .execute();
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
      const db = c.get("db") as Kysely<DB>;
      const isVerified = user && user.role !== "unverified";
      const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.member_type || ""));

      const results = await db.selectFrom("event_signups as s")
        .innerJoin("user_profiles as p", "s.user_id", "p.user_id")
        .innerJoin("user as u", "s.user_id", "u.id")
        .selectAll("s")
        .select(["p.nickname", "u.image as avatar", "p.dietary_restrictions"])
        .where("s.event_id", "=", eventId)
        .where("u.role", "!=", "unverified")
        .orderBy("s.created_at", "asc")
        .execute();

      const signups = isVerified ? results.map((rec) => ({
        user_id: rec.user_id,
        nickname: rec.nickname || null,
        bringing: rec.bringing || null,
        notes: (isManagement || (user && rec.user_id === user.id)) ? rec.notes : null,
        prep_hours: Number(rec.prep_hours || 0),
        attended: Number(rec.attended || 0),
        is_own: user ? rec.user_id === user.id : false,
      })) : [];

      const dietarySummary: Record<string, number> = {};
      results.forEach((r) => {
        if (r.dietary_restrictions) {
          const restrictions = r.dietary_restrictions.split(',').map((st: string) => st.trim());
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
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: user.id, bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 }))
        .execute();
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
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("event_signups").where("event_id", "=", params.id).where("user_id", "=", user.id).execute();
      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Events:DeleteSignup] Error", e);
      return { status: 500 as const, body: { success: false, error: "Delete failed" } };
    }
  },
  updateMyAttendance: async (input: HandlerInput<Pick<SignupBody, 'attended'>>, c: HonoContext) => {
    const { params, body } = input;
    try {
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: user.id, attended: body.attended ? 1 : 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
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
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: params.userId, attended: body.attended ? 1 : 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
        .execute();
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
    const db = c.get("db") as Kysely<DB>;
    try {
      const event = await db.selectFrom("events").selectAll().where("id", "=", params.id).executeTakeFirst();
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
          thumbnail: event.cover_image || undefined,
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
            { id: event.id as string, title: event.title, date_start: event.date_start, date_end: event.date_end || undefined, location: event.location || undefined, description: event.description || undefined, cover_image: event.cover_image || undefined, gcal_event_id: event.gcal_event_id || undefined, meeting_notes: event.meeting_notes || undefined },
            { email: social.GCAL_SERVICE_ACCOUNT_EMAIL, privateKey: social.GCAL_PRIVATE_KEY, calendarId: calId }
          );
          if (gcalId && gcalId !== event.gcal_event_id) {
            await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", event.id).execute();
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
      const db = c.get("db") as Kysely<DB>;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];

      if (!gcalEmail || !gcalKey) {
        return { status: 500 as const, body: { success: false, error: "GCal service account not configured" } };
      }

      const missing = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "gcal_event_id", "meeting_notes"])
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .where((eb) => eb.or([
          eb("gcal_event_id", "is", null),
          eb("gcal_event_id", "=", ""),
        ]))
        .execute();

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
              date_start: event.date_start,
              date_end: event.date_end || undefined,
              location: event.location || undefined,
              description: event.description || undefined,
              cover_image: event.cover_image || undefined,
              meeting_notes: event.meeting_notes || undefined,
            },
            {
              email: gcalEmail as string,
              privateKey: gcalKey as string,
              calendarId: calId as string,
            }
          );

          if (gcalId) {
            await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", event.id).execute();
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

