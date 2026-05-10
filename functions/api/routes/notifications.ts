import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, and, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, getDb } from "../middleware";
import {
  getNotificationsRoute,
  markNotificationReadRoute,
  markAllNotificationsReadRoute,
  deleteNotificationRoute,
  getPendingCountsRoute,
  getDashboardActionItemsRoute,
} from "../../../shared/routes/notifications";
import { ApiError } from "../middleware/errorHandler";

export const notificationsRouter = new OpenAPIHono<AppEnv>();

// Middleware to ensure user is logged in
notificationsRouter.use("*", async (c, next) => {
  const user = await getSessionUser(c);
  if (!user) {
    throw new ApiError("Unauthorized", 401);
  }
  return next();
});

// List notifications - types auto-inferred from route definition
notificationsRouter.openapi(getNotificationsRoute, async (c) => {
  const user = await getSessionUser(c);
  const db = getDb(c);

  const results = await db
    .select()
    .from(schema.notifications)
    .where(eq(schema.notifications.userId, user!.id))
    .orderBy(desc(schema.notifications.createdAt))
    .all();

  const notifications = results.map((n) => ({
    id: String(n.id),
    title: n.title,
    message: n.message,
    link: n.link || null,
    priority: n.priority || "normal",
    isRead: n.isRead ? 1 : 0,
    createdAt: n.createdAt || new Date().toISOString(),
  }));

  return c.json({ notifications }, 200);
});

// Mark as read - params auto-typed from route definition
notificationsRouter.openapi(markNotificationReadRoute, async (c) => {
  const { id } = c.req.valid('param'); // Type: { id: string }
  const user = await getSessionUser(c);
  const db = getDb(c);

  await db
    .update(schema.notifications)
    .set({ isRead: 1 })
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user!.id)))
    .run();

  return c.json({ success: true }, 200);
});

// Mark all as read
notificationsRouter.openapi(markAllNotificationsReadRoute, async (c) => {
  const user = await getSessionUser(c);
  const db = getDb(c);

  await db
    .update(schema.notifications)
    .set({ isRead: 1 })
    .where(eq(schema.notifications.userId, user!.id))
    .run();

  return c.json({ success: true }, 200);
});

// Delete notification - params auto-typed
notificationsRouter.openapi(deleteNotificationRoute, async (c) => {
  const { id } = c.req.valid('param'); // Type: { id: string }
  const user = await getSessionUser(c);
  const db = getDb(c);

  await db
    .delete(schema.notifications)
    .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user!.id)))
    .run();

  return c.json({ success: true }, 200);
});

// Pending counts
notificationsRouter.openapi(getPendingCountsRoute, async (c) => {
  const db = getDb(c);
  // Example logic for pending counts based on status fields
  const inquiriesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.inquiries).where(eq(schema.inquiries.status, 'pending')).get();
  const postsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.posts).where(eq(schema.posts.status, 'draft')).get();
  const eventsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.events).where(eq(schema.events.status, 'draft')).get();
  const docsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.docs).where(eq(schema.docs.status, 'draft')).get();

  return c.json({
    inquiries: inquiriesCount?.count || 0,
    posts: postsCount?.count || 0,
    events: eventsCount?.count || 0,
    docs: docsCount?.count || 0,
  }, 200);
});

// Dashboard action items
notificationsRouter.openapi(getDashboardActionItemsRoute, async (c) => {
  const db = getDb(c);

  const pendingInquiries = await db.select().from(schema.inquiries).where(eq(schema.inquiries.status, 'pending')).limit(10).all();
  const pendingPosts = await db.select().from(schema.posts).where(eq(schema.posts.status, 'draft')).limit(10).all();
  const pendingEvents = await db.select().from(schema.events).where(eq(schema.events.status, 'draft')).limit(10).all();
  const pendingDocs = await db.select().from(schema.docs).where(eq(schema.docs.status, 'draft')).limit(10).all();

  return c.json({
    inquiries: pendingInquiries.map(i => ({
      id: i.id,
      type: i.type,
      name: i.name,
      email: i.email,
      status: i.status || 'pending',
      createdAt: i.createdAt || new Date().toISOString(),
    })),
    posts: pendingPosts.map(p => ({
      id: p.slug,
      title: p.title,
      authorName: p.author || 'Unknown',
      createdAt: p.updatedAt || new Date().toISOString(),
    })),
    events: pendingEvents.map(e => ({
      id: e.id,
      title: e.title,
      dateStart: e.dateStart,
      createdAt: e.updatedAt || new Date().toISOString(),
    })),
    docs: pendingDocs.map(d => ({
      slug: d.slug,
      title: d.title,
      category: d.category,
      updatedAt: d.updatedAt || new Date().toISOString(),
    })),
  }, 200);
});

export default notificationsRouter;
