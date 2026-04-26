import { getDbSettings, AppEnv } from "../../middleware";
import { pushEventToGcal, pullEventsFromGcal } from "../../../utils/gcalSync";
import { sql, Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { Context } from "hono";

/**
 * REF-F02: Extracted sync-related handlers from handlers.ts
 * Handles Google Calendar bidirectional synchronization.
 */
export const eventSyncHandlers = {
  syncEvents: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const dbSettings = await getDbSettings(c);
      const gcalEmail = c.env.GCAL_SERVICE_ACCOUNT_EMAIL || dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
      const gcalKey = c.env.GCAL_PRIVATE_KEY || dbSettings["GCAL_PRIVATE_KEY"];

      const calendars = [
        { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
        { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
        { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
      ].filter(cal => !!cal.id);

      if (!gcalEmail || !gcalKey || calendars.length === 0) {
        return { status: 400 as const, body: { success: false, error: "GCal config missing" } as any };
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

  /** Push a single event to Google Calendar (utility, called from CRUD handlers) */
  pushToGcal: async (
    event: { id: string; title: string; date_start: string; date_end?: string; location?: string; description?: string; cover_image?: string },
    socialConfig: Record<string, string | undefined>,
    calId: string,
    db: Kysely<DB>
  ) => {
    try {
      const gcalId = await pushEventToGcal(event, {
        email: socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"] as string,
        privateKey: socialConfig["GCAL_PRIVATE_KEY"] as string,
        calendarId: calId
      });
      if (gcalId) {
        await db.updateTable("events").set({ gcal_event_id: gcalId }).where("id", "=", event.id).execute();
      }
    } catch { /* ignore GCal failure */ }
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
};
