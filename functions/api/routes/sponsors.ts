import { Hono } from "hono";
import { Bindings } from "./_shared";

const sponsorsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /sponsors — list active sponsors for public display ───────────
sponsorsRouter.get("/sponsors", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, name, tier, logo_url, website_url FROM sponsors WHERE is_active = 1 ORDER BY CASE tier WHEN 'Titanium' THEN 1 WHEN 'Gold' THEN 2 WHEN 'Silver' THEN 3 ELSE 4 END"
    ).all();
    return c.json({ sponsors: results || [] });
  } catch (err) {
    console.error("D1 sponsors list error:", err);
    return c.json({ sponsors: [] });
  }
});

sponsorsRouter.get("/admin/sponsors", async (c) => {
  try {
    const limit = Math.min(Number(c.req.query("limit") || "50"), 200);
    const offset = Number(c.req.query("offset") || "0");
    const { results } = await c.env.DB.prepare("SELECT id, name, tier, logo_url, website_url, is_active, created_at FROM sponsors ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    return c.json({ sponsors: results || [] });
  } catch (err) {
    console.error("D1 admin sponsors list error:", err);
    return c.json({ sponsors: [] });
  }
});

// ── POST /admin/sponsors — create or update a sponsor (admin) ──────
sponsorsRouter.post("/admin/sponsors", async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, tier, logo_url, website_url, is_active } = body;
    
    if (!id || !name || !tier) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO sponsors (id, name, tier, logo_url, website_url, is_active) VALUES (?, ?, ?, ?, ?, ?) " +
      "ON CONFLICT(id) DO UPDATE SET name=excluded.name, tier=excluded.tier, logo_url=excluded.logo_url, website_url=excluded.website_url, is_active=excluded.is_active"
    ).bind(id, name, tier, logo_url || null, website_url || null, is_active ?? 1).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 sponsor save error:", err);
    return c.json({ error: "Save failed" }, 500);
  }
});

// ── DELETE /admin/sponsors/:id — remove a sponsor (admin) ─────────
sponsorsRouter.delete("/admin/sponsors/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM sponsors WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 sponsor delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── GET /sponsors/roi/:token — Public (hidden) Sponsor Dashboard ────
sponsorsRouter.get("/sponsors/roi/:token", async (c) => {
  try {
    const token = c.req.param("token");
    const { results: tokens } = await c.env.DB.prepare(
      "SELECT sponsor_id FROM sponsor_tokens WHERE token = ?"
    ).bind(token).all();

    if (!tokens || tokens.length === 0) {
      return c.json({ error: "Invalid token" }, 403);
    }

    const sponsor_id = tokens[0].sponsor_id;

    // Fetch sponsor details
    const sponsorResult = await c.env.DB.prepare(
      "SELECT id, name, tier, logo_url, website_url FROM sponsors WHERE id = ?"
    ).bind(sponsor_id).all();

    // Fetch metrics
    const metricsResult = await c.env.DB.prepare(
      "SELECT year_month, impressions, clicks FROM sponsor_metrics WHERE sponsor_id = ? ORDER BY year_month ASC"
    ).bind(sponsor_id).all();

    return c.json({ 
      sponsor: sponsorResult.results?.[0], 
      metrics: metricsResult.results || [] 
    });
  } catch (err) {
    console.error("D1 sponsor ROI error:", err);
    return c.json({ error: "Failed to fetch ROI" }, 500);
  }
});

// ── GET /admin/sponsors/tokens — Get Tokens for Admins ──────
sponsorsRouter.get("/admin/sponsors/tokens", async (c) => {
  try {
    // Only admins (protected by middleware on routes ideally, or here)
    const { results } = await c.env.DB.prepare(
      "SELECT t.token, t.sponsor_id, s.name as sponsor_name, t.created_at FROM sponsor_tokens t JOIN sponsors s ON t.sponsor_id = s.id ORDER BY t.created_at DESC"
    ).all();
    return c.json({ tokens: results || [] });
  } catch {
    return c.json({ tokens: [] }, 500);
  }
});

// ── POST /admin/sponsors/tokens — Generate Token ──────
sponsorsRouter.post("/admin/sponsors/tokens", async (c) => {
  try {
    const { sponsor_id } = await c.req.json();
    if (!sponsor_id) return c.json({ error: "Missing sponsor_id"}, 400);
    const token = crypto.randomUUID();
    await c.env.DB.prepare(
      "INSERT INTO sponsor_tokens (token, sponsor_id) VALUES (?, ?)"
    ).bind(token, sponsor_id).run();
    return c.json({ success: true, token });
  } catch {
    return c.json({ error: "Failed to generate" }, 500);
  }
});

export default sponsorsRouter;
