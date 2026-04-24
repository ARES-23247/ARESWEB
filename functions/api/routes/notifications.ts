import { Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { notificationContract } from "../../../src/schemas/contracts/notificationContract";
import { AppEnv, ensureAuth, getSessionUser, rateLimitMiddleware } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";

const s = initServer<AppEnv>();
const notificationsRouter = new Hono<AppEnv>();

const notificationTsRestRouter = s.router(notificationContract, {
  getNotifications: async (_, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      const results = await db.selectFrom("notifications")
        .select(["id", "title", "message", "link", "priority", "is_read", "created_at"])
        .where("user_id", "=", user.id)
        .orderBy("created_at", "desc")
        .limit(50)
        .execute();

      const notifications = results.map(n => ({
        ...n,
        id: String(n.id),
        title: String(n.title),
        message: String(n.message),
        link: n.link || null,
        priority: (n.priority || "low") as any,
        is_read: Number(n.is_read || 0),
        created_at: String(n.created_at)
      }));

      return { status: 200, body: { notifications: notifications as any[] } };
    } catch (_err) {
      return { status: 500, body: { error: "Fetch failed", notifications: [] } };
    }
  },
  markAsRead: async ({ params }, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("id", "=", params.id)
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Update failed" } };
    }
  },
  markAllAsRead: async (_, c) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401, body: { error: "Unauthorized" } };

      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200, body: { success: true } };
    } catch (_err) {
      return { status: 500, body: { error: "Update failed" } };
    }
  },
});

notificationsRouter.use("*", ensureAuth);
notificationsRouter.use("/:id/read", rateLimitMiddleware(20, 60));
notificationsRouter.use("/read-all", rateLimitMiddleware(10, 60));

createHonoEndpoints(notificationContract, notificationTsRestRouter, notificationsRouter);

export default notificationsRouter;
