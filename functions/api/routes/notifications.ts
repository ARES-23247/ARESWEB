/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { ServerInferRequest } from "../../../shared/types/api";
import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware, s } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { Hono } from "hono";
import { createHonoEndpoints } from "ts-rest-hono";
import { notificationContract } from "../../../shared/schemas/contracts/notificationContract";

import type { HonoContext } from "@shared/types/api";


export const notificationsRouter = new Hono<AppEnv>();


const notificationHandlers: any = {
  getNotifications: async (_input: ServerInferRequest<typeof notificationContract["getNotifications"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

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
        priority: (n.priority || "low") as string,
        is_read: Number(n.is_read || 0),
        created_at: String(n.created_at)
      }));

      return { status: 200 as const, body: { notifications } };
    } catch (e) {
      console.error("GET_NOTIFICATIONS ERROR", e);
      return { status: 500 as const, body: { error: "Fetch failed", notifications: [] } };
    }
  },
  markAsRead: async (input: ServerInferRequest<typeof notificationContract["markAsRead"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const { id } = input.params;
      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("id", "=", id)
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Update failed" } };
    }
  },
  markAllAsRead: async (_input: ServerInferRequest<typeof notificationContract["markAllAsRead"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      await db.updateTable("notifications")
        .set({ is_read: 1 })
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Update failed" } };
    }
  },
  deleteNotification: async (input: ServerInferRequest<typeof notificationContract["deleteNotification"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

      const { id } = input.params;
      await db.deleteFrom("notifications")
        .where("id", "=", id)
        .where("user_id", "=", user.id)
        .execute();

      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
  getPendingCounts: async (_input: ServerInferRequest<typeof notificationContract["getPendingCounts"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

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
      return { status: 500 as const, body: { error: "Count failed" } };
    }
  },
  getDashboardActionItems: async (_input: ServerInferRequest<typeof notificationContract["getDashboardActionItems"]>, c: HonoContext) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      if (!user) return { status: 401 as const, body: { error: "Unauthorized" } };

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
          inquiries,
          posts,
          events,
          docs,
        }
      };
    } catch {
      return { status: 500 as const, body: { error: "Action items fetch failed" } };
    }
  },
};
const notificationTsRestRouter = s.router(notificationContract, notificationHandlers as any);


notificationsRouter.use("*", ensureAuth);
notificationsRouter.use("/:id/read", rateLimitMiddleware(20, 60));
notificationsRouter.use("/read-all", rateLimitMiddleware(10, 60));

createHonoEndpoints(
  notificationContract,
  notificationTsRestRouter,
  notificationsRouter,
  {
    responseValidation: true,
    responseValidationErrorHandler: (err, _c) => {
      console.error('[Contract] Response validation failed:', err.cause);
      return { error: { message: 'Internal server error' }, status: 500 };
    }
  }
);

export default notificationsRouter;


