import { Hono } from "hono";
import { AppEnv, ensureAdmin, parsePagination, logAuditAction, rateLimitMiddleware  } from "../middleware";

const outreachRouter = new Hono<AppEnv>();

// EFF-02: Shared volunteer event query
async function fetchVolunteerEvents(db: D1Database) {
  try {
    const { results } = await db.prepare(
      "SELECT id, title, date_start as date, location, 'volunteer' as type, season_id FROM events WHERE is_volunteer = 1 AND is_deleted = 0 AND status = 'published' ORDER BY date_start DESC"
    ).all();
    return (results || []) as Record<string, unknown>[];
  } catch (err) {
    console.error("D1 volunteer fetch error:", err);
    return [];
  }
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
        "SELECT id, title, date, location, COALESCE(hours, 0) as hours_logged, COALESCE(people_reached, 0) as reach_count, COALESCE(students_count, 0) as students_count, impact_summary as description, season_id FROM outreach_logs WHERE is_deleted = 0 ORDER BY date DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    
    const volunteerEvents = await fetchVolunteerEvents(c.env.DB);
    return c.json({ logs: mergeAndSort((logs || []) as Record<string, unknown>[], volunteerEvents) });
  } catch (err) {
    console.error("D1 outreach list error:", err);
    return c.json({ error: "Failed to fetch outreach logs", details: (err as Error).message }, 500);
  }
});

// ── POST / ── create or update an outreach log ───────────
outreachRouter.post("/", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, date, location, hours_logged, reach_count, students_count, description, season_id } = body;

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
        "UPDATE outreach_logs SET title = ?, date = ?, location = ?, hours = ?, people_reached = ?, students_count = ?, impact_summary = ?, season_id = ? WHERE id = ?"
      ).bind(title, date, location || null, hours_logged || 0, reach_count || 0, students_count || 0, description || null, season_id || null, id).run();
    } else {
      const newId = id || crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO outreach_logs (id, title, date, location, hours, people_reached, students_count, impact_summary, season_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
      ).bind(newId, title, date, location || null, hours_logged || 0, reach_count || 0, students_count || 0, description || null, season_id || null).run();
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /:id ── soft-delete an outreach log ────────────────
outreachRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("UPDATE outreach_logs SET is_deleted = 1 WHERE id = ?").bind(id).run();
    await logAuditAction(c, "outreach_deleted", "outreach_logs", id, "Outreach log soft-deleted");
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 outreach delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default outreachRouter;
