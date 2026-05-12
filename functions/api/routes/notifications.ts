import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, desc, and, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { AppEnv, getSessionUser, getDb, ensureAuth } from "../middleware";
import {
    getNotificationsRoute,
    markNotificationReadRoute,
    markAllNotificationsReadRoute,
    deleteNotificationRoute,
    getPendingCountsRoute,
    getDashboardActionItemsRoute,
} from "../../../shared/routes/notifications";
import { list, notDeleted } from "../../../src/db/query-helpers";
const _notificationsRouter = new OpenAPIHono<AppEnv>();

// Middleware to ensure user is logged in
_notificationsRouter.use("*", ensureAuth);

// List notifications - types auto-inferred from route definition
export const notificationsRouter = _notificationsRouter
    .openapi(getNotificationsRoute, async (c) => {
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
    })
    .openapi(markNotificationReadRoute, async (c) => {
        const { id } = c.req.valid('param'); // Type: { id: string }
        const user = await getSessionUser(c);
        const db = getDb(c);

        await db
            .update(schema.notifications)
            .set({ isRead: 1 })
            .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user!.id)))
            .run();

        return c.json({ success: true }, 200);
    })
    .openapi(markAllNotificationsReadRoute, async (c) => {
        const user = await getSessionUser(c);
        const db = getDb(c);

        await db
            .update(schema.notifications)
            .set({ isRead: 1 })
            .where(eq(schema.notifications.userId, user!.id))
            .run();

        return c.json({ success: true }, 200);
    })
    .openapi(deleteNotificationRoute, async (c) => {
        const { id } = c.req.valid('param'); // Type: { id: string }
        const user = await getSessionUser(c);
        const db = getDb(c);

        await db
            .delete(schema.notifications)
            .where(and(eq(schema.notifications.id, id), eq(schema.notifications.userId, user!.id)))
            .run();

        return c.json({ success: true }, 200);
    })
    .openapi(getPendingCountsRoute, async (c) => {
        const db = getDb(c);
        // Example logic for pending counts based on status fields
        const inquiriesCount = await db.select({ count: sql<number>`count(*)` }).from(schema.inquiries).where(eq(schema.inquiries.status, 'pending')).get();
        const postsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.posts).where(and(eq(schema.posts.status, 'draft'), notDeleted(schema.posts))).get();
        const eventsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.events).where(and(eq(schema.events.status, 'draft'), notDeleted(schema.events))).get();
        const docsCount = await db.select({ count: sql<number>`count(*)` }).from(schema.docs).where(and(eq(schema.docs.status, 'draft'), notDeleted(schema.docs))).get();

        return c.json({
            inquiries: inquiriesCount?.count || 0,
            posts: postsCount?.count || 0,
            events: eventsCount?.count || 0,
            docs: docsCount?.count || 0,
        }, 200);
    })
    .openapi(getDashboardActionItemsRoute, async (c) => {
        const db = getDb(c);

        const pendingInquiries = await list(db, schema.inquiries, {
            where: eq(schema.inquiries.status, 'pending'),
            limit: 10,
            useAll: true
        });
        const pendingPosts = await list(db, schema.posts, {
            where: and(eq(schema.posts.status, 'draft'), notDeleted(schema.posts)),
            limit: 10,
            useAll: true
        });
        const pendingEvents = await list(db, schema.events, {
            where: and(eq(schema.events.status, 'draft'), notDeleted(schema.events)),
            limit: 10,
            useAll: true
        });
        const pendingDocs = await list(db, schema.docs, {
            where: and(eq(schema.docs.status, 'draft'), notDeleted(schema.docs)),
            limit: 10,
            useAll: true
        });

        return c.json({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            inquiries: pendingInquiries.map((i: any) => ({
                id: i.id,
                type: i.type,
                name: i.name,
                email: i.email,
                status: i.status || 'pending',
                createdAt: i.createdAt || new Date().toISOString(),
            })),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            posts: pendingPosts.map((p: any) => ({
                id: p.slug,
                title: p.title,
                authorName: p.author || 'Unknown',
                createdAt: p.updatedAt || new Date().toISOString(),
            })),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            events: pendingEvents.map((e: any) => ({
                id: e.id,
                title: e.title,
                dateStart: e.dateStart,
                createdAt: e.updatedAt || new Date().toISOString(),
            })),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            docs: pendingDocs.map((d: any) => ({
                slug: d.slug,
                title: d.title,
                category: d.category,
                updatedAt: d.updatedAt || new Date().toISOString(),
            })),
        }, 200);
    });
// Mark as read - params auto-typed from route definition
// Mark all as read
// Delete notification - params auto-typed
// Pending counts
// Dashboard action items
export default notificationsRouter;
