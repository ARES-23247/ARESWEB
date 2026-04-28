import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono, Context } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { notificationContract } from "../../../shared/schemas/contracts/notificationContract";

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
    } catch (e) {
      console.error("GET_NOTIFICATIONS ERROR", e);
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
  deleteNotification: async ({ params }: { params: any }, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

      await db.deleteFrom("notifications")
        .where("id", "=", params.id)
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } as any };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } as any };
    }
  },
  getPendingCounts: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

      let filterOutreach = false;
      if (user.role !== "admin") {
        const memberType = user.member_type || "student";
        if (memberType === "student") {
          filterOutreach = true;
        }
      }

      // Optimized single-roundtrip query for all counts
      const [inquiries, posts, events, docs] = await Promise.all([
        (async () => {
          let q = db.selectFrom("inquiries").select(db.fn.count("id").as("count")).where("status", "=", "pending");
          if (filterOutreach) q = q.where("type", "in", ["outreach", "support"]);
          return q.executeTakeFirst();
        })(),
        db.selectFrom("posts").select(db.fn.count("id").as("count")).where("status", "=", "pending").where("is_deleted", "=", 0).executeTakeFirst(),
        db.selectFrom("events").select(db.fn.count("id").as("count")).where("status", "=", "pending").where("is_deleted", "=", 0).executeTakeFirst(),
        db.selectFrom("docs").select(db.fn.count("id").as("count")).where("status", "=", "pending").where("is_deleted", "=", 0).executeTakeFirst(),
      ]);

      return {
        status: 200 as const,
        body: {
          inquiries: Number(inquiries?.count || 0),
          posts: Number(posts?.count || 0),
          events: Number(events?.count || 0),
          docs: Number(docs?.count || 0),
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Count failed" } as any };
    }
  },
  getDashboardActionItems: async (_: any, c: Context<AppEnv>) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };

      let filterOutreach = false;
      if (user.role !== "admin") {
        const memberType = user.member_type || "student";
        if (memberType === "student") {
          filterOutreach = true;
        }
      }

      // Batch fetch all detailed pending items
      const [inquiries, posts, events, docs] = await Promise.all([
        (async () => {
          let q = db.selectFrom("inquiries")
            .select(["id", "name", "email", "type", "status", "created_at"])
            .where("status", "=", "pending");
          if (filterOutreach) q = q.where("type", "in", ["outreach", "support"]);
          return q.execute();
        })(),
        db.selectFrom("posts")
          .select(["title", "slug", "status", "is_deleted"])
          .where("status", "=", "pending")
          .where("is_deleted", "=", 0)
          .execute(),
        db.selectFrom("events")
          .select(["id", "title", "status", "is_deleted"])
          .where("status", "=", "pending")
          .where("is_deleted", "=", 0)
          .execute(),
        db.selectFrom("docs")
          .select(["title", "slug", "status", "is_deleted"])
          .where("status", "=", "pending")
          .where("is_deleted", "=", 0)
          .execute(),
      ]);

      return {
        status: 200 as const,
        body: {
          inquiries: inquiries as any[],
          posts: posts as any[],
          events: events as any[],
          docs: docs as any[],
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Action items fetch failed" } as any };
    }
  },
};

const notificationTsRestRouter = s.router(notificationContract, notificationHandlers as any);

notificationsRouter.use("*", ensureAuth);
notificationsRouter.use("/:id/read", rateLimitMiddleware(20, 60));
notificationsRouter.use("/read-all", rateLimitMiddleware(10, 60));

createHonoEndpoints(notificationContract, notificationTsRestRouter, notificationsRouter);

export default notificationsRouter;
