import { Hono } from "hono";
import { Bindings, getSessionUser, getDbSettings } from "../_shared";
import { pullEventsFromGcal } from "../../../utils/gcalSync";

const syncRouter = new Hono<{ Bindings: Bindings }>();

// ── POST /sync — Google Calendar Sync (admin) ──────────────
syncRouter.post("/", async (c) => {
  try {
    const dbSettings = await getDbSettings(c);
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const CALENDAR_ID = dbSettings["CALENDAR_ID"] || "af2d297c3425adaeafc13ddd48a582056404cbf16a6156d3925bb8f3b4affaa0@group.calendar.google.com";
    const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
    const email = (await getSessionUser(c))?.email || "sync";

    let newCount = 0;
    let upCount = 0;

    // Use fast realtime REST API if Authenticated
    if (gcalEmail && gcalKey && CALENDAR_ID) {
      const events = await pullEventsFromGcal({
        email: gcalEmail,
        privateKey: gcalKey,
        calendarId: CALENDAR_ID
      });

      // EFF-06: Batch lookup — fetch all existing gcal_event_ids in one query
      const { results: existingRows } = await c.env.DB.prepare(
        "SELECT id, gcal_event_id FROM events WHERE gcal_event_id IS NOT NULL"
      ).all();
      const existingMap = new Map<string, string>();
      for (const r of (existingRows || []) as { id: string; gcal_event_id: string }[]) {
        existingMap.set(r.gcal_event_id, r.id);
      }

      // Build batch statements
      const BATCH_SIZE = 50;
      const stmts: D1PreparedStatement[] = [];
      for (const ev of events) {
        if (existingMap.has(ev.gcal_event_id)) {
          stmts.push(
            c.env.DB.prepare(
              "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
            ).bind(ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id)
          );
          upCount++;
        } else {
          const genId = crypto.randomUUID();
          stmts.push(
            c.env.DB.prepare(
              "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')"
            ).bind(genId, ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id, email, null)
          );
          newCount++;
        }
      }

      for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
        await c.env.DB.batch(stmts.slice(i, i + BATCH_SIZE));
      }
    } else {
      // Fallback: Public ICS polling
      const icsResponse = await fetch(ICS_URL);
      if (!icsResponse.ok) throw new Error("Failed to fetch Google Calendar ICS");
      const icsText = await icsResponse.text();

      const parseICSDate = (icsDate: string) => {
        if (!icsDate) return null;
        const clean = icsDate.replace(/[^0-9TZ]/g, "");
        if (clean.length === 8) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T00:00:00Z`;
        }
        if (clean.length >= 15) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T${clean.substring(9,11)}:${clean.substring(11,13)}:${clean.substring(13,15)}Z`;
        }
        return null;
      };

      const extractField = (block: string, field: string) => {
        const regex = new RegExp(`^${field}(?:;[^:]+)?:(.*)$`, "m");
        const match = block.match(regex);
        return match ? match[1].trim().replace(/\\,/g, ",").replace(/\\n/g, "\n") : null;
      };

      const blocks = icsText.split("BEGIN:VEVENT");
      blocks.shift();

      for (const block of blocks) {
        const uid = extractField(block, "UID");
        if (!uid) continue;

        const title = extractField(block, "SUMMARY") || "Untitled Event";
        const start = extractField(block, "DTSTART");
        const end = extractField(block, "DTEND");
        const location = extractField(block, "LOCATION") || "";
        const description = extractField(block, "DESCRIPTION") || "";

        const parsedStart = parseICSDate(start || "");
        const parsedEnd = parseICSDate(end || "");

        if (!parsedStart) continue;

        const existing = await c.env.DB.prepare("SELECT id FROM events WHERE gcal_event_id = ?").bind(uid).first();
        if (existing) {
          await c.env.DB.prepare(
            "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
          ).bind(title, parsedStart, parsedEnd, location, description, uid).run();
          upCount++;
        } else {
          const genId = crypto.randomUUID();
          await c.env.DB.prepare(
            "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'published')"
          ).bind(genId, title, parsedStart, parsedEnd, location, description, uid, email, null).run();
          newCount++;
        }
      }
    }

    return c.json({ success: true, synced: newCount + upCount, newEvents: newCount, updatedEvents: upCount });
  } catch (err: unknown) {
    console.error("GCal sync error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Calendar sync failed" }, 500);
  }
});

export default syncRouter;
