import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { notificationContract } from "../../../src/schemas/contracts/notificationContract";

const s = initServer<AppEnv>();
export const notificationsRouter = new Hono<AppEnv>();

const notificationHandlers = {
  getNotifications: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

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

      return { status: 200 as const, body: { notifications } as any };
    } catch {
      return { status: 500 as const, body: { error: "Fetch failed", notifications: [] } as any };
    }
  },
  markAsRead: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("id", "=", params.id)
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 500 as const, body: { error: "Update failed" } as any };
    }
  },
  markAllAsRead: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 500 as const, body: { error: "Update failed" } as any };
    }
  },
};

const notificationTsRestRouter = s.router(notificationContract, notificationHandlers as any);

notificationsRouter.use("*", ensureAuth);
notificationsRouter.use("/:id/read", rateLimitMiddleware(20, 60));
notificationsRouter.use("/read-all", rateLimitMiddleware(10, 60));

createHonoEndpoints(notificationContract, notificationTsRestRouter, notificationsRouter);

export default notificationsRouter;
