import { Hono } from "hono";
import { AppEnv, getSessionUser, getDbSettings  } from "../_shared";
import { pullEventsFromGcal } from "../../../utils/gcalSync";

const syncRouter = new Hono<AppEnv>();

// ── POST /sync — Google Calendar Sync (admin) ──────────────
syncRouter.post("/", async (c) => {
  try {
    const dbSettings = await getDbSettings(c);
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const sessionUser = await getSessionUser(c);
    const email = sessionUser?.email || "sync";

    const calendars = [
      { id: dbSettings["CALENDAR_ID_INTERNAL"] || dbSettings["CALENDAR_ID"], category: "internal" },
      { id: dbSettings["CALENDAR_ID_OUTREACH"], category: "outreach" },
      { id: dbSettings["CALENDAR_ID_EXTERNAL"], category: "external" }
    ].filter(cal => !!cal.id);

    if (!gcalEmail || !gcalKey || calendars.length === 0) {
      throw new Error("Google Calendar integration is not fully configured.");
    }

    let totalNew = 0;
    let totalUpdated = 0;

    // EFF-06: Batch lookup — fetch all existing gcal_event_ids in one query
    const { results: existingRows } = await c.env.DB.prepare(
      "SELECT id, gcal_event_id FROM events WHERE gcal_event_id IS NOT NULL"
    ).all();
    const existingMap = new Map<string, string>();
    for (const r of (existingRows || []) as { id: string; gcal_event_id: string }[]) {
      existingMap.set(r.gcal_event_id, r.id);
    }

    const stmts: D1PreparedStatement[] = [];

    for (const cal of calendars) {
      try {
        const events = await pullEventsFromGcal({
          email: gcalEmail,
          privateKey: gcalKey,
          calendarId: cal.id!
        });

        for (const ev of events) {
          if (existingMap.has(ev.gcal_event_id!)) {
            stmts.push(
              c.env.DB.prepare(
                "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, category = ? WHERE gcal_event_id = ?"
              ).bind(ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, cal.category, ev.gcal_event_id)
            );
            totalUpdated++;
          } else {
            const genId = crypto.randomUUID();
            stmts.push(
              c.env.DB.prepare(
                "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?)"
              ).bind(genId, ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id, email, null, cal.category)
            );
            totalNew++;
          }
        }
      } catch (calErr) {
        console.error(`Failed to sync calendar ${cal.category} (${cal.id}):`, calErr);
        // Continue to other calendars
      }
    }

    // Process batch updates
    const BATCH_SIZE = 50;
    for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
      await c.env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
    }

    // Update Last Sync Timestamp
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, ?)"
    ).bind("LAST_CALENDAR_SYNC", now, now).run();

    return c.json({ 
      success: true, 
      synced: totalNew + totalUpdated, 
      newEvents: totalNew, 
      updatedEvents: totalUpdated,
      lastSyncedAt: now
    });

  } catch (err: unknown) {
    console.error("GCal sync error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Calendar sync failed" }, 500);
  }
});

export default syncRouter;
