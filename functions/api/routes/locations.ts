import { Hono } from "hono";
import { AppEnv, ensureAdmin, parsePagination, logAuditAction, MAX_INPUT_LENGTHS  } from "../middleware";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const locationsRouter = new Hono<AppEnv>();
const adminLocationsRouter = new Hono<AppEnv>();

// ── GET / — list all locations ──────────────────────────
locationsRouter.get("/", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, address, maps_url FROM locations WHERE is_deleted = 0 ORDER BY name ASC"
    ).all();
    return c.json({ locations: results || [] });
  } catch (err) {
    console.error("D1 locations list error:", err);
    return c.json({ locations: [] });
  }
});

const locationSchema = z.object({
  name: z.string().min(1).max(MAX_INPUT_LENGTHS.name),
  address: z.string().min(1).max(MAX_INPUT_LENGTHS.address),
  maps_url: z.string().url().or(z.literal("")).optional(),
  is_deleted: z.boolean().optional()
});

// ── POST / — create new ─────────────────────────────────
adminLocationsRouter.post("/", ensureAdmin, zValidator("json", locationSchema), async (c) => {
  try {
    const { name, address, maps_url } = c.req.valid("json");
    const id = crypto.randomUUID();

    await c.env.DB.prepare(
      "INSERT INTO locations (id, name, address, maps_url) VALUES (?, ?, ?, ?)"
    ).bind(id, name, address, maps_url || null).run();

    await logAuditAction(c, "create_location", "locations", id, `Created location: ${name}`);
    return c.json({ success: true, id });
  } catch (err) {
    console.error("D1 admin location create error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── PUT /:id — update ──────────────────────────────────
adminLocationsRouter.put("/:id", ensureAdmin, zValidator("json", locationSchema), async (c) => {
  try {
    const id = (c.req.param("id") || "");
    const { name, address, maps_url, is_deleted } = c.req.valid("json");

    await c.env.DB.prepare(
      "UPDATE locations SET name = ?, address = ?, maps_url = ?, is_deleted = ? WHERE id = ?"
    ).bind(name, address, maps_url || null, is_deleted ? 1 : 0, id).run();

    await logAuditAction(c, "update_location", "locations", id, `Updated location: ${name}`);
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin location update error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── DELETE /:id — soft-delete ──────────────────────────
adminLocationsRouter.delete("/:id", ensureAdmin, async (c) => {
  try {
    const id = (c.req.param("id") || "");
    await c.env.DB.prepare("UPDATE locations SET is_deleted = 1 WHERE id = ?").bind(id).run();
    await logAuditAction(c, "delete_location", "locations", id, "Location soft-deleted");
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 admin location delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

export { locationsRouter, adminLocationsRouter };
