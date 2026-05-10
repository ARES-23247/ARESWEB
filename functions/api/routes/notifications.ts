import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, and } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, getDb } from "../middleware";
import {
  getNotificationsRoute,
  markNotificationReadRoute,
  markAllNotificationsReadRoute,
  deleteNotificationRoute,
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
    is_read: n.isRead ? 1 : 0,
    created_at: n.createdAt || new Date().toISOString(),
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

export default notificationsRouter;
