import { Hono } from "hono";
import { AppEnv, ensureAdmin, parsePagination  } from "./_shared";

const outreachRouter = new Hono<AppEnv>();

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

// ── GET / ── list all outreach logs ──────────
outreachRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const { results: logs } = await c.env.DB.prepare(
        "SELECT id, title, date, location, COALESCE(hours, 0) as hours_logged, COALESCE(people_reached, 0) as reach_count, COALESCE(students_count, 0) as students_count, impact_summary as description FROM outreach_logs ORDER BY date DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    
    const volunteerEvents = await fetchVolunteerEvents(c.env.DB);
    return c.json({ logs: mergeAndSort((logs || []) as Record<string, unknown>[], volunteerEvents) });
  } catch (err) {
    console.error("D1 outreach list error:", err);
    return c.json({ logs: [] });
  }
});

// ── POST / ── create or update an outreach log ───────────
outreachRouter.post("/", ensureAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, date, location, hours_logged, reach_count, students_count, description } = body;

    if (!title || !date) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    let exists = false;
    if (id) {
      const row = await c.env.DB.prepare("SELECT id FROM outreach_logs WHERE id = ?").bind(id).first();
      if (row) exists = true;
    }

    if (exists) {
      await c.env.DB.prepare(
        "UPDATE outreach_logs SET title = ?, date = ?, location = ?, hours = ?, people_reached = ?, students_count = ?, impact_summary = ? WHERE id = ?"
      ).bind(title, date, location || null, hours_logged || 0, reach_count || 0, students_count || 0, description || null, id).run();
    } else {
      await c.env.DB.prepare(
        "INSERT INTO outreach_logs (title, date, location, hours, people_reached, students_count, impact_summary) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(title, date, location || null, hours_logged || 0, reach_count || 0, students_count || 0, description || null).run();
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /:id ── remove an outreach log ────────────────
outreachRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("DELETE FROM outreach_logs WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default outreachRouter;
