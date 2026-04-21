import { Hono } from "hono";
import { Bindings, getSessionUser, validateLength, MAX_INPUT_LENGTHS, UserRole, ensureAdmin, parsePagination } from "./_shared";

const locationsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /locations — public facing list ───────────────────────────────
locationsRouter.get("/locations", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, address, maps_url FROM locations WHERE is_deleted = 0 ORDER BY name ASC"
    ).all();
    return c.json({ locations: results ?? [] });
  } catch (err) {
    console.error("D1 list error (locations):", err);
    return c.json({ locations: [] });
  }
});

// ── GET /admin/locations — all for manager ─────────────────────────────
locationsRouter.get("/admin/locations", ensureAdmin, async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, address, maps_url, is_deleted FROM locations ORDER BY is_deleted ASC, name ASC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ locations: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (locations):", err);
    return c.json({ locations: [] });
  }
});

// ── POST /admin/locations — create new ─────────────────────────────────
locationsRouter.post("/admin/locations", ensureAdmin, async (c) => {
  try {
    
    const body: { name?: string; address?: string; maps_url?: string } = await c.req.json();
    
    // SEC-04: Input length validation
    const nameErr = validateLength(body.name, MAX_INPUT_LENGTHS.name, "Name");
    const addrErr = validateLength(body.address, MAX_INPUT_LENGTHS.address, "Address");
    if (nameErr) return c.json({ error: nameErr }, 400);
    if (addrErr) return c.json({ error: addrErr }, 400);

    const id = crypto.randomUUID();
    const name = body.name?.trim() || "Unnamed Location";
    const address = body.address?.trim() || "";
    const maps_url = body.maps_url?.trim() || null;

    await c.env.DB.prepare(
      "INSERT INTO locations (id, name, address, maps_url) VALUES (?, ?, ?, ?)"
    ).bind(id, name, address, maps_url).run();

    return c.json({ success: true, id });
  } catch (err) {
    console.error("D1 write error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── PUT /admin/locations/:id — update ──────────────────────────────────
locationsRouter.put("/admin/locations/:id", ensureAdmin, async (c) => {
  try {

    const id = c.req.param("id");
    const body: { name?: string; address?: string; maps_url?: string; is_deleted?: boolean } = await c.req.json();
    
    // SEC-04: Input length validation
    const nameErr = validateLength(body.name, MAX_INPUT_LENGTHS.name, "Name");
    const addrErr = validateLength(body.address, MAX_INPUT_LENGTHS.address, "Address");
    if (nameErr) return c.json({ error: nameErr }, 400);
    if (addrErr) return c.json({ error: addrErr }, 400);

    const name = body.name?.trim() || "";
    const address = body.address?.trim() || "";
    const maps_url = body.maps_url?.trim() || null;
    const is_deleted = body.is_deleted ? 1 : 0;

    await c.env.DB.prepare(
      "UPDATE locations SET name = ?, address = ?, maps_url = ?, is_deleted = ? WHERE id = ?"
    ).bind(name, address, maps_url, is_deleted, id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 update error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── DELETE /admin/locations/:id — soft delete ──────────────────────────
locationsRouter.delete("/admin/locations/:id", ensureAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare(
      "UPDATE locations SET is_deleted = 1 WHERE id = ?"
    ).bind(id).run();
    
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 delete error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

export { locationsRouter };
