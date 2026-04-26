import { getSocialConfig, getSessionUser, getDbSettings, logAuditAction, AppEnv } from "../../middleware";
import { pushEventToGcal, pullEventsFromGcal, deleteEventFromGcal } from "../../../utils/gcalSync";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { sql, Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { Context } from "hono";

export const eventHandlers = {
  getEvents: async ({ query }: { query: any }, c: Context<AppEnv>) => {
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

        return { status: 200 as const, body: { events } as any };
      }

      let results;
      try {
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id"])
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
      } catch (_e) {
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .where("is_deleted", "=", 0)
          .orderBy("date_start", "desc")
          .limit(Number(limit) || 50)
          .offset(Number(offset) || 0)
          .execute() as any[];
      }

      const events = results.map(e => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0)
      }));

      return { status: 200 as const, body: { events } as any };
    } catch (e) {
      console.error("GET_EVENTS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch events" } as any };
    }
  },
  getCalendarSettings: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("settings")
        .select(["key", "value"])
        .where("key", "in", ["CALENDAR_ID", "CALENDAR_ID_INTERNAL", "CALENDAR_ID_OUTREACH", "CALENDAR_ID_EXTERNAL"])
        .execute();
            
      const map: any = results.reduce((acc, row) => ({ ...acc, [(row.key as any)]: row.value || "" }), {});
      
      return { status: 200 as const, body: { 
        calendarIdInternal: map["CALENDAR_ID_INTERNAL"] || map["CALENDAR_ID"] || "",
        calendarIdOutreach: map["CALENDAR_ID_OUTREACH"] || "",
        calendarIdExternal: map["CALENDAR_ID_EXTERNAL"] || "",
      } as any };
    } catch (e) {
      console.error("GET_CALENDAR_SETTINGS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch calendar settings" } as any };
    }
  },
  getEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);

      const row = await db.selectFrom("events")
        .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes"])
        .where("id", "=", id)
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .executeTakeFirst();

      if (!row) return { status: 404 as const, body: { error: "Event not found" } as any };

      return { 
        status: 200 as const, 
        body: { 
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0),
            meeting_notes: (user && user.role !== "unverified") ? row.meeting_notes : null
          },
          is_editor: user?.role === "admin"
        } as any
      };
    } catch (e) {
      console.error("GET_EVENT ERROR", e);
      return { status: 404 as const, body: { error: "Database error" } as any };
    }
  },
  getAdminEvents: async ({ query }: { query: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { limit = 100, offset = 0 } = query;
      let results;
      try {
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes"])
          .orderBy("date_start", "desc")
          .limit(Number(limit) || 100)
          .offset(Number(offset) || 0)
          .execute();
      } catch (_e) {
        results = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .orderBy("date_start", "desc")
          .limit(Number(limit) || 100)
          .offset(Number(offset) || 0)
          .execute() as any[];
      }
      
      const lastSyncRow = await db.selectFrom("settings").select("value").where("key", "=", "LAST_CALENDAR_SYNC").executeTakeFirst();
      
      const events = results.map(e => ({
        ...e,
        season_id: e.season_id ? Number(e.season_id) : null,
        is_deleted: Number(e.is_deleted || 0)
      }));

      return { status: 200 as const, body: { events, lastSyncedAt: lastSyncRow?.value || null } as any };
    } catch (e) {
      console.error("GET_ADMIN_EVENTS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch events" } as any };
    }
  },
  adminDetail: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      let row;
      try {
        row = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image", "status", "is_deleted", "season_id", "meeting_notes"])
          .where("id", "=", id)
          .executeTakeFirst();
      } catch (_e) {
        row = await db.selectFrom("events")
          .select(["id", "title", "category", "date_start", "date_end", "location", "description", "cover_image"])
          .where("id", "=", id)
          .executeTakeFirst() as any;
      }

      if (!row) return { status: 404 as const, body: { error: "Event not found" } as any };

      return { 
        status: 200 as const, 
        body: { 
          event: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted || 0)
          }
        } as any
      };
    } catch (e) {
      console.error("ADMIN_EVENT_DETAIL ERROR", e);
      return { status: 500 as const, body: { error: "Database error" } as any };
    }
  },
  saveEvent: async ({ body }: { body: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;

      // FIX: Handle upsert if ID is provided (prevents double-creation on subsequent saves)
      if (body.id) {
        const existing = await db.selectFrom("events").select("id").where("id", "=", body.id).executeTakeFirst();
        if (existing) {
          return eventHandlers.updateEvent({ params: { id: body.id }, body }, c);
        }
      }

      const { title, category, dateStart, dateEnd, location, description, coverImage, socials, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes } = body;

      // FIX: Prevent double-click creation of duplicate events with same title/date
      const recent = await db.selectFrom("events")
        .select("id")
        .where("title", "=", title || "")
        .where("date_start", "=", dateStart)
        .where("is_deleted", "=", 0)
        .executeTakeFirst();
      
      if (recent) {
        return { status: 200 as const, body: { success: true, id: recent.id, warning: "Double-submission prevented" } as any };
      }

      const cat = category || 'internal';
      const genId = crypto.randomUUID();
      
      const socialConfig = await getSocialConfig(c);
      const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
      const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
      
      const user = await getSessionUser(c);
      const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      await db.insertInto("events")
        .values({
          id: genId, title: title || "", category: cat, date_start: dateStart, date_end: dateEnd || null,
          location: location || "", description: description || "", cover_image: coverImage || "",
          gcal_event_id: null, cf_email: user?.email || "anonymous_admin", status,
          is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
          published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null
        })
        .execute();

      c.executionCtx.waitUntil((async () => {
        if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: genId, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined },
              { email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
            );
            if (gcalId) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", genId).execute();
            }
          } catch { /* ignore GCal failure */ }
        }

        if (status === "published") {
          const baseUrl = new URL(c.req.url).origin;
          if (socials) {
            await dispatchSocials(c.env.DB, { title: title || "", url: `${baseUrl}/events`, snippet: "New event scheduled!", coverImageUrl: coverImage || "/gallery_1.png", baseUrl }, socialConfig, socials).catch(() => {});
          }
          await sendZulipMessage(c.env, "announcements", "Calendar", `📅 **New Event:** ${title}\n📍 ${location || "TBD"}\n[View](${baseUrl}/events)`).catch(() => {});
        }
      })());

      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_EVENT", "events", genId, `Created event: ${title} (${status})`));

      return { status: 200 as const, body: { success: true, id: genId } as any };
    } catch (e) {
      console.error("CREATE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Write failed" } as any };
    }
  },
  updateEvent: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const { title, category, dateStart, dateEnd, location, description, coverImage, tbaEventKey, isPotluck, isVolunteer, isDraft, publishedAt, seasonId, meetingNotes } = body;
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
            revision_of: id, published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null
          })
          .execute();
        return { status: 200 as const, body: { success: true, id: revId } as any };
      }

      await db.updateTable("events")
        .set({
          title, category: cat, date_start: dateStart, date_end: dateEnd || null,
          location: location || "", description: description || "", cover_image: coverImage || "",
          tba_event_key: tbaEventKey || null, status,
          is_potluck: isPotluck ? 1 : 0, is_volunteer: isVolunteer ? 1 : 0,
          published_at: publishedAt || null, season_id: seasonId || null, meeting_notes: meetingNotes || null
        })
        .where("id", "=", id)
        .execute();

      c.executionCtx.waitUntil((async () => {
        if (status === "published") {
          const socialConfig = await getSocialConfig(c);
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
          
          if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
            try {
              const row = await db.selectFrom("events").select("gcal_event_id").where("id", "=", id).executeTakeFirst();
              const gcalId = await pushEventToGcal(
                { id, title: title || "", date_start: dateStart, date_end: dateEnd || undefined, location: location || undefined, description: description || undefined, cover_image: coverImage || undefined, gcal_event_id: row?.gcal_event_id || undefined },
                { email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
              );
              if (gcalId && gcalId !== row?.gcal_event_id) {
                await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", id).execute();
              }
            } catch { /* ignore GCal failure */ }
          }
        }
      })());

      return { status: 200 as const, body: { success: true, id } as any };
    } catch (e) {
      console.error("UPDATE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } as any };
    }
  },
  deleteEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ is_deleted: 1 }).where("id", "=", id).execute();

      c.executionCtx.waitUntil((async () => {
        const row = await db.selectFrom("events").select(["gcal_event_id", "category"]).where("id", "=", id).executeTakeFirst();
        if (row && row.gcal_event_id) {
          const socialConfig = await getSocialConfig(c);
          const cat = row.category || "internal";
          const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
          const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
          
          if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
            try {
              await deleteEventFromGcal(row.gcal_event_id, {
                email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string,
                privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string,
                calendarId: calId as string
              });
            } catch { /* ignore GCal failure */ }
          }
        }
      })());

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("DELETE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Delete failed" } as any };
    }
  },
  approveEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
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
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
        const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
        
        if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: targetRow.id, title: targetRow.title, date_start: targetRow.date_start, date_end: targetRow.date_end || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.cover_image || undefined, gcal_event_id: targetRow.gcal_event_id || undefined },
              { email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
            );
            if (gcalId && gcalId !== targetRow.gcal_event_id) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", targetRow.id).execute();
            }
          } catch { /* ignore GCal failure */ }
        }
      })());

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("APPROVE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Approval failed" } as any };
    }
  },
  rejectEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ status: 'rejected' }).where("id", "=", id).execute();
      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("REJECT_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Rejection failed" } as any };
    }
  },
  undeleteEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    const { id } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("events").set({ is_deleted: 0 }).where("id", "=", id).execute();

      c.executionCtx.waitUntil((async () => {
        const targetRow = await db.selectFrom("events").selectAll().where("id", "=", id).executeTakeFirst();
        if (!targetRow || targetRow.status !== "published") return;
        
        const socialConfig = await getSocialConfig(c);
        const cat = targetRow.category || "internal";
        const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof socialConfig;
        const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
        
        if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
          try {
            const gcalId = await pushEventToGcal(
              { id: targetRow.id, title: targetRow.title, date_start: targetRow.date_start, date_end: targetRow.date_end || undefined, location: targetRow.location || undefined, description: targetRow.description || undefined, cover_image: targetRow.cover_image || undefined, gcal_event_id: targetRow.gcal_event_id || undefined },
              { email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
            );
            if (gcalId && gcalId !== targetRow.gcal_event_id) {
              await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", targetRow.id).execute();
            }
          } catch { /* ignore GCal failure */ }
        }
      })());

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("UNDELETE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Restore failed" } as any };
    }
  },
  purgeEvent: async ({ params }: { params: any }, c: Context<AppEnv>) => {
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
          const calId = (socialConfig as any)[calKey] || (socialConfig as any)["CALENDAR_ID"];
          
          if (socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] && socialConfig["GCAL_PRIVATE_KEY"] && calId) {
            try {
              await deleteEventFromGcal(row.gcal_event_id, {
                email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string,
                privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string,
                calendarId: calId as string
              });
            } catch { /* ignore GCal failure */ }
          }
        }
      })());

      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("PURGE_EVENT ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Purge failed" } as any };
    }
  },
  syncEvents: async (_: any, c: Context<AppEnv>) => {
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
        return { status: 400 as const, body: { success: false, error: "GCal config missing: need GCAL_SERVICE_ACCOUNT_EMAIL, GCAL_PRIVATE_KEY, and at least one CALENDAR_ID" } as any };
      }

      let total = 0;
      const errors: string[] = [];

      for (const cal of calendars) {
        try {
          const events = await pullEventsFromGcal({ email: gcalEmail as string, privateKey: gcalKey as string, calendarId: cal.id as string });
          
          // D1 has a variable binding limit (~100 per query).
          // With ~10 columns per event, chunk at 20 events per INSERT to stay safe.
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
              category: cal.category
            }));

            await db.insertInto("events")
              .values(chunk)
              .onConflict((oc) => oc.column("gcal_event_id").doUpdateSet({
                title: sql`excluded.title`,
                date_start: sql`excluded.date_start`,
                date_end: sql`excluded.date_end`,
                location: sql`excluded.location`,
                description: sql`excluded.description`,
                category: sql`excluded.category`
              }))
              .execute();
          }
          
          total += events.length;
        } catch (calErr) {
          // Isolate per-calendar failures so one bad calendar doesn't kill the whole sync
          const msg = calErr instanceof Error ? calErr.message : String(calErr);
          console.error(`SYNC_EVENTS: Calendar ${cal.category} (${cal.id}) failed:`, msg);
          errors.push(`${cal.category}: ${msg}`);
        }
      }

      return { status: 200 as const, body: { success: true, count: total, errors: errors.length > 0 ? errors : undefined } as any };
    } catch (e) {
      console.error("SYNC_EVENTS ERROR", e);
      return { status: 500 as const, body: { success: false, error: e instanceof Error ? e.message : "Sync failed" } as any };
    }
  },
  getSignups: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
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
      } as any };
    } catch (e) {
      console.error("GET_SIGNUPS ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch signups" } as any };
    }
  },
  submitSignup: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      const user = await getSessionUser(c);
      if (!user || user.role === "unverified") return { status: 403 as const, body: { error: "Forbidden" } as any };
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: user.id, bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ bringing: body.bringing || "", notes: body.notes || "", prep_hours: body.prep_hours || 0 }))
        .execute();
      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("SUBMIT_SIGNUP ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Signup failed" } as any };
    }
  },
  deleteMySignup: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("event_signups").where("event_id", "=", params.id).where("user_id", "=", user.id).execute();
      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("DELETE_SIGNUP ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Delete failed" } as any };
    }
  },
  updateMyAttendance: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: user.id, attended: body.attended ? 1 : 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
        .execute();
      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("UPDATE_MY_ATTENDANCE ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } as any };
    }
  },
  updateUserAttendance: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    try {
      const user = await getSessionUser(c);
      if (user?.role !== "admin" && !["coach", "mentor"].includes(user?.member_type || "")) return { status: 401 as const, body: { error: "Unauthorized" } as any };
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("event_signups")
        .values({ event_id: params.id, user_id: params.userId, attended: body.attended ? 1 : 0 })
        .onConflict((oc) => oc.columns(["event_id", "user_id"]).doUpdateSet({ attended: body.attended ? 1 : 0 }))
        .execute();
      return { status: 200 as const, body: { success: true } as any };
    } catch (e) {
      console.error("UPDATE_USER_ATTENDANCE ERROR", e);
      return { status: 500 as const, body: { success: false, error: "Update failed" } as any };
    }
  },
  repushEvent: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
    const user = await getSessionUser(c);
    if (user?.role !== "admin" && user?.role !== "author") return { status: 401 as const, body: { error: "Unauthorized" } as any };
    const db = c.get("db") as Kysely<DB>;
    const event = await db.selectFrom("events").selectAll().where("id", "=", params.id).executeTakeFirst();
    if (!event) return { status: 404 as const, body: { error: "Event not found" } as any };

    try {
      const social = await getSocialConfig(c);
      const baseUrl = new URL(c.req.url).origin;
      const socialsFilter: Record<string, boolean> = {};
      if (body.socials) {
        for (const s of body.socials) socialsFilter[s] = true;
      }

      await dispatchSocials(
        c.env.DB,
        {
          title: event.title,
          url: `${baseUrl}/events/${event.id}`,
          snippet: event.description || "",
          coverImageUrl: event.cover_image || undefined,
        },
        social as any,
        socialsFilter
      );

      // Force push to Google Calendar
      const cat = event.category || "internal";
      const calKey = `CALENDAR_ID_${cat.toUpperCase()}` as keyof typeof social;
      const calId = (social as any)[calKey] || (social as any)["CALENDAR_ID"];
      
      if (social["GCAL_SERVICE_ACCOUNT_EMAIL"] && social["GCAL_PRIVATE_KEY"] && calId) {
        try {
          const gcalId = await pushEventToGcal(
            { id: event.id, title: event.title, date_start: event.date_start, date_end: event.date_end || undefined, location: event.location || undefined, description: event.description || undefined, cover_image: event.cover_image || undefined, gcal_event_id: event.gcal_event_id || undefined },
            { email: social["GCAL_SERVICE_ACCOUNT_EMAIL"] as string, privateKey: social["GCAL_PRIVATE_KEY"] as string, calendarId: calId as string }
          );
          if (gcalId && gcalId !== event.gcal_event_id) {
            await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", event.id).execute();
          }
        } catch (e) {
          console.error("REPUSH_EVENT_GCAL ERROR", e);
        }
      }

      return { status: 200 as const, body: { success: true } as any };
    } catch (err) {
      console.error("REPUSH_EVENT ERROR", err);
      return { status: 502 as const, body: { error: String(err) } as any };
    }
  },
};
