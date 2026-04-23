import { Hono } from "hono";
import { AppEnv } from "../../middleware";

const seasonsRouter = new Hono<AppEnv>();

// ── GET / ── list all seasons ──────────
seasonsRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM seasons WHERE is_deleted = 0 AND status = 'published' ORDER BY start_date DESC"
    ).all();
    return c.json({ seasons: results || [] });
  } catch (err) {
    console.error("D1 seasons list error:", err);
    return c.json({ error: "Failed to fetch seasons" }, 500);
  }
});

// ── GET /:id ── get season details + related data ───────
seasonsRouter.get("/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    // Get season record
    const season = await c.env.DB.prepare(
      "SELECT * FROM seasons WHERE id = ? AND is_deleted = 0 AND status = 'published'"
    ).bind(id).first();

    if (!season) {
      return c.json({ error: "Season not found" }, 404);
    }

    // Get related records in a batch
    const [{ results: awards }, { results: events }, { results: posts }, { results: outreach }] = await c.env.DB.batch([
      c.env.DB.prepare("SELECT id, title, date as year, event_name, description, icon_type as image_url FROM awards WHERE season_id = ? AND is_deleted = 0").bind(id),
      c.env.DB.prepare("SELECT id, title, category, date_start, date_end, location, description, cover_image FROM events WHERE season_id = ? AND is_deleted = 0 AND status = 'published'").bind(id),
      c.env.DB.prepare("SELECT slug, title, date, snippet, thumbnail FROM posts WHERE season_id = ? AND is_deleted = 0 AND status = 'published'").bind(id),
      c.env.DB.prepare("SELECT id, title, date, location, hours, people_reached, students_count, impact_summary as description FROM outreach_logs WHERE season_id = ? AND is_deleted = 0").bind(id)
    ]);

    return c.json({
      season,
      awards: awards || [],
      events: events || [],
      posts: posts || [],
      outreach: outreach || []
    });
  } catch (err) {
    console.error("D1 season details error:", err);
    return c.json({ error: "Failed to fetch season details" }, 500);
  }
});

export default seasonsRouter;
