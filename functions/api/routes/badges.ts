import { Hono } from "hono";
import { Bindings, ensureAdmin } from "./_shared";

const badgesRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /badges — list ALL available badges ────────────────────────
badgesRouter.get("/badges", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT * FROM badges ORDER BY created_at ASC"
    ).all();
    return c.json({ badges: results || [] });
  } catch (err) {
    console.error("Failed to fetch badges", err);
    return c.json({ badges: [] }, 500);
  }
});

// ── POST /admin/badges — Create a badge class ────────────────────────
badgesRouter.post("/admin/badges", ensureAdmin, async (c) => {
  try {
    const body = await c.req.json();
    const { id, name, description, icon, color_theme } = body;
    
    if (!id || !name) return c.json({ error: "Missing id or name" }, 400);

    await c.env.DB.prepare(
      "INSERT INTO badges (id, name, description, icon, color_theme) VALUES (?, ?, ?, ?, ?)"
    ).bind(
      id, name, description || "", icon || "Award", color_theme || "ares-gold"
    ).run();

    return c.json({ success: true, id });
  } catch (err) {
    console.error("Failed to create badge", err);
    return c.json({ error: "Failed to create badge" }, 500);
  }
});

// ── POST /admin/users/:userId/badges — Award a badge ──────────────────
badgesRouter.post("/admin/users/:userId/badges", ensureAdmin, async (c) => {
  try {
    const userId = c.req.param("userId");
    const { badge_id } = await c.req.json();
    const sessionId = (c.get as any)("user")?.id || "system";

    await c.env.DB.prepare(
      "INSERT INTO user_badges (user_id, badge_id, awarded_by) VALUES (?, ?, ?)"
    ).bind(userId, badge_id, sessionId).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to award badge", err);
    return c.json({ error: "Failed to award badge (maybe already awarded?)" }, 500);
  }
});

// ── DELETE /admin/users/:userId/badges/:badgeId — Revoke a badge ──────
badgesRouter.delete("/admin/users/:userId/badges/:badgeId", ensureAdmin, async (c) => {
  try {
    const userId = c.req.param("userId");
    const badgeId = c.req.param("badgeId");

    await c.env.DB.prepare(
      "DELETE FROM user_badges WHERE user_id = ? AND badge_id = ?"
    ).bind(userId, badgeId).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("Failed to revoke badge", err);
    return c.json({ error: "Failed to revoke badge" }, 500);
  }
});

export default badgesRouter;
