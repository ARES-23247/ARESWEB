import { Hono } from "hono";
import { AppEnv, getSessionUser, ensureAuth, parsePagination } from "./_shared";

const notificationsRouter = new Hono<AppEnv>();

// ── GET /notifications — list user notifications ──────────────────────
notificationsRouter.get("/", ensureAuth, async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) return c.json({ notifications: [] }, 401);

    const { limit } = parsePagination(c, 20, 50);
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, message, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(user.id, limit).all();

    return c.json({ notifications: results ?? [] });
  } catch (err) {
    console.error("D1 notifications list error:", err);
    return c.json({ notifications: [] }, 500);
  }
});

// ── PUT /notifications/:id/read — mark as read ──────────────────────
notificationsRouter.put("/:id/read", ensureAuth, async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);
    
    const id = c.req.param("id");
    await c.env.DB.prepare(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?"
    ).bind(id, user.id).run();

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 mark notification read error:", err);
    return c.json({ error: "Update failed" }, 500);
  }
});

// ── PUT /notifications/read-all — mark all as read ──────────────────────
notificationsRouter.put("/read-all", ensureAuth, async (c) => {
    try {
      const user = await getSessionUser(c);
      if (!user) return c.json({ error: "Unauthorized" }, 401);
      
      await c.env.DB.prepare(
        "UPDATE notifications SET is_read = 1 WHERE user_id = ?"
      ).bind(user.id).run();
  
      return c.json({ success: true });
    } catch (err) {
      console.error("D1 mark all notifications read error:", err);
      return c.json({ error: "Update failed" }, 500);
    }
  });

export default notificationsRouter;
