import { getSocialConfig, getSessionUser, getDbSettings, logAuditAction, AppEnv } from "../../middleware";
import { pushEventToGcal, pullEventsFromGcal } from "../../../utils/gcalSync";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { eventContract } from "../../../../src/schemas/contracts/eventContract";
import { initServer } from "ts-rest-hono";
import { sql, Kysely } from "kysely";
import { DB } from "../../../../src/schemas/database";

const s = initServer<AppEnv>();

export const eventHandlers = s.router(eventContract, {
  getEvents: async ({ query }: { query: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit = 50, offset = 0, q } = query;

      if (q) {
        const results = await sql<{ id: string, title: string, category: string, date_start: string, date_end: string | null, location: string | null, description: string | null, cover_image: string | null, status: string, is_deleted: number, season_id: number | null }>`
          SELECT e.id, e.title, e.category, e.date_start, e.date_end, e.location, e.description, e.cover_image, e.status, e.is_deleted, e.season_id
           FROM events_fts f
           JOIN events e ON f.id = e.id
           WHERE e.is_deleted = 0 AND e.status = 'published' AND (e.published_at IS NULL OR datetime(e.published_at) <= datetime('now'))
           AND f.events_fts MATCH ${q}
           ORDER BY f.rank LIMIT ${limit} OFFSET ${offset}
        `.execute(db);
        
        const events = results.rows.map(e => ({
          ...e,
          season_id: e.season_id ? Number(e.season_id) : null,
          is_deleted: Number(e.is_deleted || 0)
        }));

        return { status: 200, body: { events: events as any[] } };
      }

      const results = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id"])
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .where((eb) => eb.or([
          eb("published_at", "is", null),
          eb("published_at", "<=", new Date().toISOString())
        ]))
        .orderBy("date_start", "desc")
        .limit(limit || 50)
        .offset(offset || 0)
        .execute();

      const events = results.map(e => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0)
      }));

      return { status: 200, body: { events: events as any[] } };
    } catch (_err) {
      return { status: 200, body: { events: [] } };
    }
  },
  getCalendarSettings: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("settings")
        .select(["key", "value"])
        .where("key", "in", ["CALENDAR_ID", "CALENDAR_ID_INTERNAL", "CALENDAR_ID_OUTREACH", "CALENDAR_ID_EXTERNAL"])
        .execute();
      
      const map = results.reduce((acc: Record<string, string>, row) => ({ ...acc, [row.key]: row.value }), {});
      
      return { status: 200, body: { 
        calendarIdInternal: map['CALENDAR_ID_INTERNAL'] || map['CALENDAR_ID'] || "",
        calendarIdOutreach: map['CALENDAR_ID_OUTREACH'] || "",
        calendarIdExternal: map['CALENDAR_ID_EXTERNAL'] || "",
      }};
    } catch (_err) {
      return { status: 200, body: { calendarIdInternal: "", calendarIdOutreach: "", calendarIdExternal: "" } };
    }
  },
  getEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);

      const row = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id"])
        .where("id", "=", id)
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!row) return { status: 404, body: { error: "Event not found" } };

      return { 
        status: 200, 
        body: { 
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0)
          },
          is_editor: user?.role === "admin"
        } as any
      };
    } catch (_err) {
      return { status: 404, body: { error: "Database error" } };
    }
  },
  getAdminEvents: async ({ query }: { query: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit = 100, offset = 0 } = query;
      const results = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id"])
        .orderBy("date_start", "desc")
        .limit(limit || 100)
        .offset(offset || 0)
        .execute();
      
      const lastSyncRow = await db.selectFrom("settings").select("value").where("key", "=", "LAST_CALENDAR_SYNC").executeTakeFirst();
      
      const events = results.map(e => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0)
      }));

      return { status: 200, body: { events: events as any[], lastSyncedAt: lastSyncRow?.value || null } };
    } catch (_err) {
      return { status: 500, body: { error: "Failed to fetch events" } };
    }
  },
  adminDetail: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id"])
        .where("id", "=", id)
        .executeTakeFirst();

      if (!row) return { status: 404, body: { error: "Event not found" } };

      return { 
        status: 200, 
        body: { 
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0)
          }
        } as any
      };
    } catch (_err) {
      return { status: 500, body: { error: "Database error" } };
    }
  },
  saveEvent: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { title, category, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId } = body;
      const cat = category || 'internal';
      const genId = crypto.randomUUID();
      
      const socialConfig = await getSocialConfig(c);
      const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
      const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
      
      let gcalId = null;
      if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
        try {
          gcalId = await pushEventToGcal(
            { id: genId, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined },
            { email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
          );
        } catch (_err) { /* ignore GCal failure */ }
      }

      const user = await getSessionUser(c);
      const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      await db.insertInto("events")
        .values({
          id: genId, title: title || "", category: cat, date_start: dateStart, date_end: dateEnd || null,
          location: location || "", description: description || "", cover_image: coverImage || "",
          gcal_event_id: gcalId || null, cf_email: user?.email || "anonymous_admin", status,
          is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
          published_at: publishedAt || null, season_id: seasonId || null
        })
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_EVENT", "events", genId, `Created event: ${title} (${status})`));

      if (status === "published") {
        const baseUrl = new URL(c.req.url).origin;
        if (socials) {
          c.executionCtx.waitUntil(dispatchSocials(c.env.DB, { title: title || "", url: `${baseUrl}/events`, snippet: "New event scheduled!", coverImageUrl: coverImage || "/gallery_1.png", baseUrl }, socialConfig, socials));
        }
        c.executionCtx.waitUntil(sendZulipMessage(c.env, "announcements", "Calendar", `📅 **New Event:** ${title}\n📍 ${location || "TBD"}\n[View](${baseUrl}/events)`));
      }

      return { status: 200, body: { success: true, id: genId } };
    } catch (_err) {
      return { status: 200, body: { success: false, error: "Write failed" } };
    }
  },
  updateEvent: async ({ params, body }: { params: any, body: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId } = body;
      const cat = category || 'internal';
      
      const user = await getSessionUser(c);
      const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      if (user?.role !== "admin") {
        const revId = `${id}-rev-${Math.random().toString(36).substring(2, 6)}`;
        await db.insertInto("events")
          .values({
            id: revId, title: title || "", category: cat, date_start: dateStart!, date_end: dateEnd || null,
            location: location || "", description: description || "", cover_image: coverImage || "",
            tba_event_key: tbaEventKey || null, status: 'pending',
            is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
            revision_of: id, published_at: publishedAt || null, season_id: seasonId || null
          })
          .execute();
        return { status: 200, body: { success: true, id: revId } };
      }

      await db.updateTable("events")
        .set({
          title, category: cat, date_start: dateStart, date_end: dateEnd || null,
          location: location || "", description: description || "", cover_image: coverImage || "",
          tba_event_key: tbaEventKey || null, status,
          is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
          published_at: publishedAt || null, season_id: seasonId || null
        })
        .where("id", "=", id)
        .execute();

      return { status: 200, body: { success: true, id } };
    } catch (_err) {
      return { status: 200, body: { success: false, error: "Update failed" } };
    }
  },
  deleteEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ is_deleted: 1 }).where("id", "=", id).execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  approveEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst();
      if (row && row.revision_of) {
        await db.updateTable("events")
          .set({ title: row.title, date_start: row.date_start, date_end: row.date_end, location: row.location, description: row.description, cover_image: row.cover_image, tba_event_key: row.tba_event_key, status: 'published', is_potluck: row.is_potluck, is_volunteer: row.is_volunteer, season_id: row.season_id })
          .where("id", "=", row.revision_of)
          .execute();
        await db.deleteFrom("events").where("id", "=", id).execute();
      } else {
        await db.updateTable("events").set({ status: 'published' }).where("id", "=", id).execute();
      }
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  rejectEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ status: 'rejected' }).where("id", "=", id).execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  undeleteEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ is_deleted: 0 }).where("id", "=", id).execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  purgeEvent: async ({ params }: { params: any }, c: any) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("events").where("id", "=", id).execute();
      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  syncEvents: async (_: any, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
      const user = await getSessionUser(c);

      const calendars = [
        { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
        { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
        { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
      ].filter(cal => !!cal.id);

      if (!gcalEmail || !gcalKey || calendars.length === 0) throw new Error("Config missing");

      let total = 0;
      for (const cal of calendars) {
        const events = await pullEventsFromGcal({ email: gcalEmail as string, privateKey: gcalKey as string, calendarId: cal.id as string });
        for (const ev of events) {
          await db.insertInto("events")
            .values({ id: crypto.randomUUID(), title: ev.title, date_start: ev.date_start, date_end: ev.date_end || null, location: ev.location, description: ev.description, gcal_event_id: ev.gcal_event_id, cf_email: user?.email || "sync", status: 'published', category: cal.category })
            .onConflict((oc) => oc.column("gcal_event_id").doUpdateSet({ title: ev.title, date_start: ev.date_start, date_end: ev.date_end || null, location: ev.location, description: ev.description, category: cal.category }))
            .execute();
          total++;
        }
      }
      return { status: 200, body: { success: true, count: total } };
    } catch (_err) {
      return { status: 200, body: { success: false } };
    }
  },
  getSignups: async ({ params }: { params: any }, c: any) => {
    const eventId = params.id;
    const user = await getSessionUser(c);
    const db = c.get("db") as Kysely<DB>;
    const isVerified = user && user.role !== "unverified";
    const isManagement = user && (user.role === "admin" || ["coach", "mentor"].includes(user.member_type || ""));

    const results = await db.selectFrom("event_signups as s")
      .join("user_profiles as p", "s.user_id", "p.user_id")
      .join("user as u", "s.user_id", "u.id")
      .selectAll("s")
      .select(["p.nickname", "u.image as avatar", "p.dietary_restrictions"])
      .where("s.event_id", "=", eventId)
      .where("u.role", "!=", "unverified")
      .orderBy("s.created_at", "asc")
      .execute();

    const signups = isVerified ? results.map((rec) => ({
      user_id: rec.user_id,
      nickname: rec.nickname,
      bringing: rec.bringing,
      notes: (isManagement || (user && rec.user_id === user.id)) ? rec.notes : null,
      prep_hours: Number(rec.prep_hours),
      attended: Number(rec.attended),
      is_own: user ? rec.user_id === user.id : false,
    })) : [];

    const dietarySummary: Record<string, number> = {};
    results.forEach(r => {
      if (r.dietary_restrictions) {
        const restrictions = r.dietary_restrictions.split(',').map(st => st.trim());
        restrictions.forEach(res => {
          if (res) dietarySummary[res] = (dietarySummary[res] || 0) + 1;
        });
      }
    });

    return { status: 200, body: { 
      signups, 
      dietary_summary: dietarySummary, 
      team_dietary_summary: {}, 
      authenticated: !!user, 
      role: user?.role || null, 
      member_type: user?.member_type || null, 
      can_manage: !!isManagement 
    } as any };
  },
  submitSignup: async ({ params, body }: { params: any, body: any }, c: any) => {
    const user = await getSessionUser(c);
    if (!user || user.role === "unverified") return { status: 403, body: { error: "Forbidden" } };
    const db = c.get("db") as Kysely<DB>;
    await db.insertInto("event_signups")
      .values({ event_id: params.id, user_id: user.id, bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 })
      .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 }))
      .execute();
    return { status: 200, body: { success: true } };
  },
  deleteMySignup: async ({ params }: { params: any }, c: any) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 401, body: { error: "Unauthorized" } };
    const db = c.get("db") as Kysely<DB>;
    await db.deleteFrom("event_signups").where("event_id", "=", params.id).where("user_id", "=", user.id).execute();
    return { status: 200, body: { success: true } };
  },
  updateMyAttendance: async ({ params, body }: { params: any, body: any }, c: any) => {
    const user = await getSessionUser(c);
    if (!user) return { status: 401, body: { error: "Unauthorized" } };
    const db = c.get("db") as Kysely<DB>;
    await db.insertInto("event_signups")
      .values({ event_id: params.id, user_id: user.id, attended: body.attended ? 1 : 0 })
      .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
      .execute();
    return { status: 200, body: { success: true } };
  },
  updateUserAttendance: async ({ params, body }: { params: any, body: any }, c: any) => {
    const user = await getSessionUser(c);
    if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.member_type || "")) return { status: 401, body: { error: "Unauthorized" } };
    const db = c.get("db") as Kysely<DB>;
    await db.insertInto("event_signups")
      .values({ event_id: params.id, user_id: params.userId, attended: body.attended ? 1 : 0 })
      .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
      .execute();
    return { status: 200, body: { success: true } };
  },
});
