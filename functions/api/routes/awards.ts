import { Hono } from "hono";
import { Bindings, ensureAdmin, parsePagination } from "./_shared";

const awardsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET / — list all awards ──────────
awardsRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 100);
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date as year, event_name as event, '' as team, description, '' as media_url FROM awards ORDER BY year DESC, title ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ awards: results || [] });
  } catch (err) {
    console.error("D1 awards list error:", err);
    return c.json({ awards: [] });
  }
});

// ── POST / — create or update an award ───────────
awardsRouter.post("/", ensureAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { id, title, year, event, team, description, media_url } = body;
    
    if (!id || !title || !year) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO awards (title, date, event_name, description) VALUES (?, ?, ?, ?) " +
      ""
    ).bind(title, year, event || null, description || null).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 awards save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /:id — remove an award ────────────────
awardsRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM awards WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 awards delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default awardsRouter;
