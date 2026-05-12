import { ApiError } from "../middleware/errorHandler";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, getSessionUser, originIntegrityMiddleware, getDb, ensureAuth } from "../middleware";
import {
    listSocialQueueRoute,
    calendarSocialQueueRoute,
    createSocialQueueRoute,
    updateSocialQueueRoute,
    deleteSocialQueueRoute,
    sendNowSocialQueueRoute,
    analyticsSocialQueueRoute,
    type SocialQueuePost,
} from "../../../shared/routes/socialQueue";
import { nanoid } from "nanoid";
import { dispatchQueuePost } from "../../utils/socialSync";
import { requireAuth } from "../middleware/auth";

const _socialQueueRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on social queue operations
_socialQueueRouter.use("*", originIntegrityMiddleware());
_socialQueueRouter.use("*", ensureAuth);

const toSocialQueuePost = (r: Record<string, unknown>): SocialQueuePost => ({
    id: String(r.id),
    content: String(r.content),
    mediaUrls: r.mediaUrls ? JSON.parse(String(r.mediaUrls)) : undefined,
    scheduledFor: String(r.scheduledFor),
    platforms: JSON.parse(String(r.platforms)),
    analytics: r.analytics ? JSON.parse(String(r.analytics)) : null,
    status: r.status as SocialQueuePost["status"],
    linkedType: (r.linkedType as SocialQueuePost["linkedType"]) || null,
    linkedId: (r.linkedId as string) || null,
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
    sentAt: (r.sentAt as string) || null,
    errorMessage: (r.errorMessage as string) || null,
    createdBy: (r.createdBy as string) || null,
});

// List posts
export const socialQueueRouter = _socialQueueRouter
    .openapi(listSocialQueueRoute, async (c) => {
        const user = await requireAuth(c);
        const { status = "all", limit = 20, offset = 0 } = c.req.valid("query");
        const db = getDb(c);

        let condition = undefined;
        const conditions = [];

        if (status !== "all") {
            // Response boundary: Drizzle return type diverges from Zod schema
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            conditions.push(eq(schema.socialQueue.status, status as any));
        }

        if (user.role !== "admin") {
            conditions.push(eq(schema.socialQueue.createdBy, user.id));
        }

        if (conditions.length > 0) {
            condition = and(...conditions);
        }

        const totalResult = await db
            .select({ count: count(schema.socialQueue.id) })
            .from(schema.socialQueue)
            .where(condition)
            .get();

        const total = Number(totalResult?.count || 0);

        const results = await db
            .select()
            .from(schema.socialQueue)
            .where(condition)
            .orderBy(desc(schema.socialQueue.scheduledFor))
            .limit(limit)
            .offset(offset)
            .all();

        const posts: SocialQueuePost[] = results.map(toSocialQueuePost);

        return c.json({ posts, total }, 200);
    })
    .openapi(calendarSocialQueueRoute, async (c) => {
        const user = await requireAuth(c);
        const { start, end } = c.req.valid("query");
        const db = getDb(c);

        const conditions = [gte(schema.socialQueue.scheduledFor, start), lte(schema.socialQueue.scheduledFor, end)];

        if (user.role !== "admin") {
            conditions.push(eq(schema.socialQueue.createdBy, user.id));
        }

        const results = await db
            .select()
            .from(schema.socialQueue)
            .where(and(...conditions))
            .all();

        const posts: SocialQueuePost[] = results.map(toSocialQueuePost);

        return c.json({ posts }, 200);
    })
    .openapi(createSocialQueueRoute, async (c) => {
        const user = await requireAuth(c);
        const body = c.req.valid("json");
        const db = getDb(c);
        const id = nanoid();
        const now = new Date().toISOString();

        const newPostValues = {
            id,
            content: body.content,
            mediaUrls: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
            scheduledFor: body.scheduledFor,
            platforms: JSON.stringify(body.platforms),
            status: "pending",
            createdBy: user.id,
            linkedType: body.linkedType || null,
            linkedId: body.linkedId || null,
            createdAt: now,
        };

        await db.insert(schema.socialQueue).values(newPostValues).run();

        const post = toSocialQueuePost({ ...newPostValues, analytics: null, sentAt: null, errorMessage: null });

        return c.json({ success: true, post }, 200);
    })
    .openapi(updateSocialQueueRoute, async (c) => {
        const user = await requireAuth(c);
        const params = c.req.valid("param");
        const body = c.req.valid("json");
        const db = getDb(c);
        const { id } = params;

        const existing = await db
            .select()
            .from(schema.socialQueue)
            .where(eq(schema.socialQueue.id, id))
            .get();

        if (!existing) {
            throw new ApiError("Post not found", 404);
        }

        if (user.role !== "admin" && existing.createdBy !== user.id) {
            throw new ApiError("Forbidden", 403);
        }

        if (existing.status === "sent") {
            throw new ApiError("Cannot edit a post that has already been sent", 400);
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const update: any = {};
        if (body.content !== undefined) update.content = body.content;
        if (body.mediaUrls !== undefined) update.mediaUrls = body.mediaUrls ? JSON.stringify(body.mediaUrls) : null;
        if (body.scheduledFor !== undefined) update.scheduledFor = body.scheduledFor;
        if (body.platforms !== undefined) update.platforms = JSON.stringify(body.platforms);
        if (body.status !== undefined) update.status = body.status;

        await db.update(schema.socialQueue).set(update).where(eq(schema.socialQueue.id, id)).run();

        const updatedRow = await db
            .select()
            .from(schema.socialQueue)
            .where(eq(schema.socialQueue.id, id))
            .get();

        // Response boundary: Drizzle return type diverges from Zod schema
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return c.json({ success: true, post: toSocialQueuePost(updatedRow as any) }, 200);
    })
    .openapi(deleteSocialQueueRoute, async (c) => {
        const user = await requireAuth(c);
        const params = c.req.valid("param");
        const db = getDb(c);
        const { id } = params;

        const existing = await db
            .select()
            .from(schema.socialQueue)
            .where(eq(schema.socialQueue.id, id))
            .get();

        if (!existing) {
            throw new ApiError("Post not found", 404);
        }

        if (user.role !== "admin" && existing.createdBy !== user.id) {
            throw new ApiError("Forbidden", 403);
        }

        await db.delete(schema.socialQueue).where(eq(schema.socialQueue.id, id)).run();

        return c.json({ success: true }, 200);
    })
    .openapi(sendNowSocialQueueRoute, async (c) => {
        const user = await getSessionUser(c);
        if (!user || user.role !== "admin") {
            throw new ApiError("Unauthorized", 401);
        }

        const params = c.req.valid("param");
        const db = getDb(c);
        const { id } = params;

        const row = await db
            .select()
            .from(schema.socialQueue)
            .where(eq(schema.socialQueue.id, id))
            .get();

        if (!row) {
            throw new ApiError("Post not found", 404);
        }

        const post = toSocialQueuePost(row as Record<string, unknown>);
        const config = {
            TWITTER_BEARER_TOKEN: c.env.TWITTER_BEARER_TOKEN,
            BLUESKY_IDENTIFIER: c.env.BLUESKY_IDENTIFIER,
            BLUESKY_PASSWORD: c.env.BLUESKY_PASSWORD,
            // Type boundary: Env mapping to SocialMediaConfig interface
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any;

        await dispatchQueuePost(db, post, config);

        return c.json({ success: true }, 200);
    })
    .openapi(analyticsSocialQueueRoute, async (c) => {
        const user = await getSessionUser(c);
        if (!user || user.role !== "admin") {
            throw new ApiError("Unauthorized", 401);
        }

        const { start, end } = c.req.valid("query");
        const db = getDb(c);

        const conditions = [];
        if (start) conditions.push(gte(schema.socialQueue.scheduledFor, start));
        if (end) conditions.push(lte(schema.socialQueue.scheduledFor, end));

        let results;
        if (conditions.length > 0) {
            results = await db.select().from(schema.socialQueue).where(and(...conditions)).all();
        } else {
            results = await db.select().from(schema.socialQueue).all();
        }

        const totalPosts = results.length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalSent = results.filter((r: any) => r.status === "sent").length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalPending = results.filter((r: any) => r.status === "pending").length;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const totalFailed = results.filter((r: any) => r.status === "failed").length;

        const byPlatform = {
            twitter: 0,
            bluesky: 0,
            facebook: 0,
            instagram: 0,
            discord: 0,
            slack: 0,
            teams: 0,
            gchat: 0,
            linkedin: 0,
            tiktok: 0,
            band: 0,
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        results.forEach((r: any) => {
            const platforms = JSON.parse(String(r.platforms));
            Object.entries(platforms).forEach(([key, value]) => {
                if (value && key in byPlatform) {
                    (byPlatform as Record<string, number>)[key]++;
                }
            });
        });

        return c.json({
            totalPosts,
            totalSent,
            totalPending,
            totalFailed,
            byPlatform,
            engagement: {
                totalImpressions: 0,
                totalLikes: 0,
                totalShares: 0,
                totalComments: 0,
            },
        }, 200);
    });
// Calendar view
// Create post
// Update post
// Delete post
// Send post now
// Analytics
export default socialQueueRouter;
