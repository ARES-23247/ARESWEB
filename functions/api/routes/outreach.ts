import { Hono } from "hono";
import { Bindings, ensureAdmin, parsePagination } from "./_shared";

const outreachRouter = new Hono<{ Bindings: Bindings }>();

// EFF-02: Shared volunteer event query
async function fetchVolunteerEvents(db: D1Database) {
  const { results } = await db.prepare(
    `SELECT e.id, e.title, e.date_start as date, e.location, e.description,
            (SELECT count(*) FROM event_signups s WHERE s.event_id = e.id AND s.attended = 1) as students_count,
            (COALESCE((strftime('%s', e.date_end) - strftime('%s', e.date_start)) / 3600.0, 0) * 
             (SELECT count(*) FROM event_signups s WHERE s.event_id = e.id AND s.attended = 1)) 
             + COALESCE((SELECT sum(prep_hours) FROM event_signups s WHERE s.event_id = e.id AND s.attended = 1), 0) as hours_logged
     FROM events e
     WHERE e.is_volunteer = 1 AND e.is_deleted = 0 AND e.status = 'published'`
  ).all();
  return (results || []).map((e: Record<string, unknown>) => ({
    ...e,
    reach_count: 0,
    is_dynamic: true,
  }));
}

function mergeAndSort(logs: Record<string, unknown>[], volunteerEvents: Record<string, unknown>[]) {
  return [...logs, ...volunteerEvents].sort(
    (a, b) => new Date(String(b.date)).getTime() - new Date(String(a.date)).getTime()
  );
}

// ── GET / — list all outreach logs (public or admin) ───────
outreachRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const { results: logs } = await c.env.DB.prepare("SELECT id, title, date, location, students_count, hours_logged, reach_count, description FROM outreach_logs ORDER BY date DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    const volunteerEvents = await fetchVolunteerEvents(c.env.DB);
    return c.json({ logs: mergeAndSort((logs || []) as Record<string, unknown>[], volunteerEvents) });
  } catch (err) {
    console.error("D1 outreach list error:", err);
    return c.json({ logs: [] });
  }
});

// ── POST / — create or update an outreach log ───────────
outreachRouter.post("/", ensureAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, date, location, students_count, hours_logged, reach_count, description } = body;
    
    if (!id || !title || !date) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO outreach_logs (id, title, date, location, students_count, hours_logged, reach_count, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET title=excluded.title, date=excluded.date, location=excluded.location, students_count=excluded.students_count, hours_logged=excluded.hours_logged, reach_count=excluded.reach_count, description=excluded.description"
    ).bind(id, title, date, location || null, students_count || 0, hours_logged || 0, reach_count || 0, description || null).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /:id — remove an outreach log ────────────────
outreachRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM outreach_logs WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default outreachRouter;
