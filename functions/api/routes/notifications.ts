import { typedHandler } from "../utils/handler";
import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware } from "../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import { 

  getNotificationsRoute, 
  markNotificationReadRoute, 
  markAllNotificationsReadRoute, 
  deleteNotificationRoute, 
  getPendingCountsRoute, 
  getDashboardActionItemsRoute 
} from "../../../shared/routes/notifications";


export const notificationsRouter = new OpenAPIHono<AppEnv>();

notificationsRouter.use("*", ensureAuth);
notificationsRouter.use("/:id/read", rateLimitMiddleware(20, 60));
notificationsRouter.use("/read-all", rateLimitMiddleware(10, 60));

notificationsRouter.openapi(getNotificationsRoute, typedHandler<typeof getNotificationsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const results = await db.selectFrom("notifications")
      .select(["id", "title", "message", "link", "priority", "is_read", "created_at"])
      .where("user_id", "=", user.id)
      .orderBy("created_at", "desc")
      .limit(50)
      .execute();

    const notifications = results.map((n: any) => ({
      ...n,
      id: String(n.id),
      title: String(n.title),
      message: String(n.message),
      link: n.link || null,
      priority: (n.priority || "low") as string,
      is_read: Number(n.is_read || 0),
      created_at: String(n.created_at)
    }));

    return c.json({ notifications }, 200);
  } catch (e) {
    console.error("GET_NOTIFICATIONS ERROR", e);
    return c.json({ error: "Fetch failed", notifications: [] }, 500);
  }
}));

notificationsRouter.openapi(markNotificationReadRoute, typedHandler<typeof markNotificationReadRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    await db.updateTable("notifications")
      .set({ is_read: 1 })
      .where("id", "=", id)
      .where("user_id", "=", user.id)
      .execute();

    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Update failed" }, 500);
  }
}));

notificationsRouter.openapi(markAllNotificationsReadRoute, typedHandler<typeof markAllNotificationsReadRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    await db.updateTable("notifications")
      .set({ is_read: 1 })
      .where("user_id", "=", user.id)
      .execute();

    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Update failed" }, 500);
  }
}));

notificationsRouter.openapi(deleteNotificationRoute, typedHandler<typeof deleteNotificationRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const { id } = c.req.valid("param");
    await db.deleteFrom("notifications")
      .where("id", "=", id)
      .where("user_id", "=", user.id)
      .execute();

    return c.json({ success: true }, 200);
  } catch {
    return c.json({ error: "Delete failed" }, 500);
  }
}));

notificationsRouter.openapi(getPendingCountsRoute, typedHandler<typeof getPendingCountsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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

    return c.json({
      inquiries: Number(inquiries?.count || 0),
      posts: Number(posts?.count || 0),
      events: Number(events?.count || 0),
      docs: Number(docs?.count || 0),
    }, 200);
  } catch {
    return c.json({ error: "Count failed" }, 500);
  }
}));

notificationsRouter.openapi(getDashboardActionItemsRoute, typedHandler<typeof getDashboardActionItemsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

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

    return c.json({
      inquiries,
      posts,
      events,
      docs,
    }, 200);
  } catch {
    return c.json({ error: "Action items fetch failed" }, 500);
  }
}));

export default notificationsRouter;


