import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";
import { AppEnv, getSessionUser, ensureAuth, rateLimitMiddleware, getDb } from "../middleware";
import { eq, desc, and, count, inArray } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
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
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    const results = await db
      .select({
        id: schema.notifications.id,
        title: schema.notifications.title,
        message: schema.notifications.message,
        link: schema.notifications.link,
        priority: schema.notifications.priority,
        isRead: schema.notifications.isRead,
        createdAt: schema.notifications.createdAt
      })
      .from(schema.notifications)
      .where(eq(schema.notifications.userId, user.id))
      .orderBy(desc(schema.notifications.createdAt))
      .limit(50)
      .all();

    const notifications = results.map((n) => ({
      ...n,
      id: String(n.id),
      title: String(n.title),
      message: String(n.message),
      link: n.link || null,
      priority: (n.priority || "low") as string,
      is_read: Number(n.isRead || 0),
      created_at: String(n.createdAt)
    }));

    return c.json({ notifications }, 200);
}));

notificationsRouter.openapi(markNotificationReadRoute, typedHandler<typeof markNotificationReadRoute>(async (c) => {
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    const { id } = c.req.valid("param");
    await db
      .update(schema.notifications)
      .set({ isRead: 1 })
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)))
      .run();

    return c.json({ success: true }, 200);
}));

notificationsRouter.openapi(markAllNotificationsReadRoute, typedHandler<typeof markAllNotificationsReadRoute>(async (c) => {
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    await db
      .update(schema.notifications)
      .set({ isRead: 1 })
      .where(eq(schema.notifications.userId, user.id))
      .run();

    return c.json({ success: true }, 200);
}));

notificationsRouter.openapi(deleteNotificationRoute, typedHandler<typeof deleteNotificationRoute>(async (c) => {
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

    const { id } = c.req.valid("param");
    await db
      .delete(schema.notifications)
      .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user.id)))
      .run();

    return c.json({ success: true }, 200);
}));

notificationsRouter.openapi(getPendingCountsRoute, typedHandler<typeof getPendingCountsRoute>(async (c) => {
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

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
        let q = db
          .select({ count: count(schema.inquiries.id) })
          .from(schema.inquiries)
          .where(eq(schema.inquiries.status, "pending"))
          .$dynamic();
        if (filterOutreach) q = q.where(inArray(schema.inquiries.type, ["outreach", "support"]));
        return q.get();
      })(),
      db
        .select({ count: count(schema.posts.slug) })
        .from(schema.posts)
        .where(and(eq(schema.posts.status, "pending"), eq(schema.posts.isDeleted, 0)))
        .get(),
      db
        .select({ count: count(schema.events.id) })
        .from(schema.events)
        .where(and(eq(schema.events.status, "pending"), eq(schema.events.isDeleted, 0)))
        .get(),
      db
        .select({ count: count(schema.docs.slug) })
        .from(schema.docs)
        .where(and(eq(schema.docs.status, "pending"), eq(schema.docs.isDeleted, 0)))
        .get(),
    ]);

    return c.json({
      inquiries: Number(inquiries?.count || 0),
      posts: Number(posts?.count || 0),
      events: Number(events?.count || 0),
      docs: Number(docs?.count || 0),
    }, 200);
}));

notificationsRouter.openapi(getDashboardActionItemsRoute, typedHandler<typeof getDashboardActionItemsRoute>(async (c) => {
    const db = getDb(c);
    const user = await getSessionUser(c);
    if (!user) throw new ApiError("Unauthorized", 401);

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
        let q = db
          .select({
            id: schema.inquiries.id,
            name: schema.inquiries.name,
            email: schema.inquiries.email,
            type: schema.inquiries.type,
            status: schema.inquiries.status,
            createdAt: schema.inquiries.createdAt
          })
          .from(schema.inquiries)
          .where(eq(schema.inquiries.status, "pending"))
          .$dynamic();
        if (filterOutreach) q = q.where(inArray(schema.inquiries.type, ["outreach", "support"]));
        return q.all();
      })(),
      db
        .select({
          title: schema.posts.title,
          slug: schema.posts.slug,
          status: schema.posts.status,
          isDeleted: schema.posts.isDeleted
        })
        .from(schema.posts)
        .where(and(eq(schema.posts.status, "pending"), eq(schema.posts.isDeleted, 0)))
        .all(),
      db
        .select({
          id: schema.events.id,
          title: schema.events.title,
          status: schema.events.status,
          isDeleted: schema.events.isDeleted
        })
        .from(schema.events)
        .where(and(eq(schema.events.status, "pending"), eq(schema.events.isDeleted, 0)))
        .all(),
      db
        .select({
          title: schema.docs.title,
          slug: schema.docs.slug,
          status: schema.docs.status,
          isDeleted: schema.docs.isDeleted
        })
        .from(schema.docs)
        .where(and(eq(schema.docs.status, "pending"), eq(schema.docs.isDeleted, 0)))
        .all(),
    ]);

    return c.json({
      inquiries,
      posts,
      events,
      docs,
    }, 200);
}));

export default notificationsRouter;


