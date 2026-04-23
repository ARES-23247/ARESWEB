import { Hono } from "hono";
import { AppEnv, ensureAdmin, parsePagination, logAuditAction, MAX_INPUT_LENGTHS  } from "../middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const awardsRouter = new Hono<AppEnv>();

// ── GET / ── list all awards ──────────
awardsRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 100);
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date as year, event_name, description, icon_type as image_url, season_id FROM awards WHERE is_deleted = 0 ORDER BY date DESC, title ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ awards: results || [] });
  } catch (err) {
    console.error("D1 awards list error:", err);
    return c.json({ error: "Failed to fetch awards", details: (err as Error).message }, 500);
  }
});

// ── POST / ── create or update an award ───────────
const awardSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1).max(MAX_INPUT_LENGTHS.name),
  year: z.union([z.number(), z.string()]),
  event_name: z.string().max(MAX_INPUT_LENGTHS.name).optional(),
  description: z.string().max(MAX_INPUT_LENGTHS.generic).optional(),
  image_url: z.string().optional(),
  season_id: z.string().optional()
});

awardsRouter.post("/", ensureAdmin, zValidator("json", awardSchema), async (c) => {
  try {
    const { id, title, year, event_name, description, image_url, season_id } = c.req.valid("json");

    let exists = false;
    if (id) {
      const row = await c.env.DB.prepare("SELECT id FROM awards WHERE id = ?").bind(id).first();
      if (row) exists = true;
    }

    if (exists) {
      // Update existing
      await c.env.DB.prepare(
        "UPDATE awards SET title = ?, date = ?, event_name = ?, description = ?, icon_type = ?, season_id = ? WHERE id = ?"
      ).bind(title, String(year), event_name || "", description || null, image_url || "trophy", season_id || null, id).run();
      await logAuditAction(c, "award_updated", "awards", id, `Award "${title}" (${year}) updated`);
    } else {
      // Insert new
      const newId = id || crypto.randomUUID();
      await c.env.DB.prepare(
        "INSERT INTO awards (id, title, date, event_name, description, icon_type, season_id) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).bind(newId, title, String(year), event_name || "", description || null, image_url || "trophy", season_id || null).run();
      await logAuditAction(c, "award_created", "awards", newId, `Award "${title}" (${year}) created`);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 awards save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /:id ── soft-delete an award ────────────────
awardsRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("UPDATE awards SET is_deleted = 1 WHERE id = ?").bind(id).run();
    await logAuditAction(c, "award_deleted", "awards", id, "Award soft-deleted");
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 awards delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export default awardsRouter;