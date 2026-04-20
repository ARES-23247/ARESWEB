import { Hono } from "hono";
import { Bindings } from "../_shared";
import signupsRouter from "./signups";
import syncRouter from "./sync";
import adminRouter from "./admin";

const eventsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /events — list all events ──────────────────────────────────────
eventsRouter.get("/", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
    const offset = Number(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, category, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_potluck, is_volunteer FROM events WHERE is_deleted = 0 AND status = 'published' ORDER BY date_start ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ events: results ?? [] });
  } catch (err) {
    console.error("D1 list error (events):", err);
    return c.json({ events: [] });
  }
});

// ── GET /calendar — public calendar configuration ──────────────────────
// Mounted at /events/calendar
eventsRouter.get("/calendar", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT key, value FROM settings WHERE key IN ('CALENDAR_ID', 'CALENDAR_ID_INTERNAL', 'CALENDAR_ID_OUTREACH', 'CALENDAR_ID_EXTERNAL')"
    ).all<{key: string, value: string}>();
    const map = (results || []).reduce((acc, row) => ({ ...acc, [row.key]: row.value }), {} as Record<string, string>);
    return c.json({ 
      calendarIdInternal: map['CALENDAR_ID_INTERNAL'] || map['CALENDAR_ID'] || "",
      calendarIdOutreach: map['CALENDAR_ID_OUTREACH'] || "",
      calendarIdExternal: map['CALENDAR_ID_EXTERNAL'] || "",
    });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /events/:id — single event ─────────────────────────────────────
eventsRouter.get("/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(
      `SELECT e.id, e.title, e.category, e.date_start, e.date_end, e.location, e.description, e.cover_image, e.gcal_event_id, e.cf_email, e.is_potluck, e.is_volunteer,
              p.nickname as author_nickname, u.image as author_avatar
       FROM events e
       LEFT JOIN user u ON e.cf_email = u.email
       LEFT JOIN user_profiles p ON u.id = p.user_id
       WHERE e.id = ? AND e.is_deleted = 0 AND e.status = 'published'`
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── Mount Sub-Routers ────────────────────────────────────────────────
eventsRouter.route("/", signupsRouter); // handles /:id/signups etc.

export { default as adminEventsRouter } from "./admin";
export { default as syncEventsRouter } from "./sync";

export default eventsRouter;
