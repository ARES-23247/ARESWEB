import { Hono } from "hono";
import { AppEnv, ensureAuth, getSessionUser, rateLimitMiddleware } from "../middleware";

const notificationsRouter = new Hono<AppEnv>();

// ── GET /notifications — list user notifications ──────────────────────
notificationsRouter.get("/", ensureAuth, async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { results } = await c.env.DB.prepare(
      "SELECT id, title, message, link, priority, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(user.id).all();

    return c.json({ notifications: results || [] });
  } catch (err) {
    console.error("D1 notifications read error:", err);
    return c.json({ notifications: [] }, 500);
  }
});

// ── PUT /notifications/:id/read — mark as read ──────────────────────
notificationsRouter.put("/:id/read", ensureAuth, rateLimitMiddleware(20, 60), async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = (c.req.param("id") || "");
    await c.env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
    ).bind(id, user.id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 notification update error:", err);
    return c.json({ error: "Update failed" }, 500);
  }
});

// ── PUT /notifications/read-all — mark all as read ──────────────────────
notificationsRouter.put("/read-all", ensureAuth, rateLimitMiddleware(10, 60), async (c) => {
    try {
      const user = await getSessionUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);

      await c.env.DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ?"
      ).bind(user.id).run();

      return c.json({ success: true });
    } catch (err) {
      console.error("D1 notification bulk update error:", err);
      return c.json({ error: "Update failed" }, 500);
    }
});

export default notificationsRouter;
