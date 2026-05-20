import { ApiError } from "../middleware/errorHandler";
import { eq, desc, and, gte, lte, count } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, originIntegrityMiddleware, getDb, ensureAuth } from "../middleware";
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

const _socialQueueRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on social queue operations
_socialQueueRouter.use("*", originIntegrityMiddleware());
_socialQueueRouter.use("*", ensureAuth);

// Drizzle inferred row type
type SocialQueueRow = typeof schema.socialQueue.$inferSelect;

/** Convert a Drizzle row to the API SocialQueuePost shape. */
const toSocialQueuePost = (r: SocialQueueRow): SocialQueuePost => ({
    id: String(r.id),
    content: String(r.content),
    mediaUrls: r.mediaUrls ? JSON.parse(String(r.mediaUrls)) : undefined,
    scheduledFor: String(r.scheduledFor),
    platforms: JSON.parse(String(r.platforms)),
    analytics: r.analytics ? JSON.parse(String(r.analytics)) : null,
    status: r.status as SocialQueuePost["status"],
    linkedType: (r.linkedType as SocialQueuePost["linkedType"]) || null,
    linkedId: r.linkedId || null,
    createdAt: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
    sentAt: r.sentAt || null,
    errorMessage: r.errorMessage || null,
    createdBy: r.createdBy || null,
});

/** Guard: throw 403 if user is not the owner or admin. */
function ensureOwnerOrAdmin(user: { role: string; id: string }, ownerId: string | null) {
    if (user.role !== "admin" && ownerId !== user.id) {
        throw new ApiError("Forbidden", 403);
    }
}

// List posts
export const socialQueueRouter = _socialQueueRouter
    .openapi(listSocialQueueRoute, async (c) => {
        const user = c.get('sessionUser')!
        const { status = "all", limit = 20, offset = 0 } = c.req.valid("query");
        const db = getDb(c);

        const conditions = [];

        if (status !== "all") {
            conditions.push(eq(schema.socialQueue.status, status));
        }

        if (user.role !== "admin") {
            conditions.push(eq(schema.socialQueue.createdBy, user.id));
        }

        const condition = conditions.length > 0 ? and(...conditions) : undefined;

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
        const user = c.get('sessionUser')!
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
        const user = c.get('sessionUser')!
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

        const inserted = await db
            .select()
            .from(schema.socialQueue)
            .where(eq(schema.socialQueue.id, id))
            .get();

        const post = inserted ? toSocialQueuePost(inserted) : toSocialQueuePost({ ...newPostValues, analytics: null, sentAt: null, errorMessage: null, updatedAt: null } as SocialQueueRow);

        return c.json({ success: true, post }, 200);
    })
    .openapi(updateSocialQueueRoute, async (c) => {
        const user = c.get('sessionUser')!
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

        ensureOwnerOrAdmin(user, existing.createdBy);

        if (existing.status === "sent") {
            throw new ApiError("Cannot edit a post that has already been sent", 400);
        }

        const update: Partial<typeof schema.socialQueue.$inferInsert> = {};
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

        if (!updatedRow) throw new ApiError("Post not found after update", 404);

        return c.json({ success: true, post: toSocialQueuePost(updatedRow) }, 200);
    })
    .openapi(deleteSocialQueueRoute, async (c) => {
        const user = c.get('sessionUser')!
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

        ensureOwnerOrAdmin(user, existing.createdBy);

        await db.delete(schema.socialQueue).where(eq(schema.socialQueue.id, id)).run();

        return c.json({ success: true }, 200);
    })
    .openapi(sendNowSocialQueueRoute, async (c) => {
        const user = c.get('sessionUser')!
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

        const post = toSocialQueuePost(row);
        const config = {
            TWITTER_API_KEY: c.env.TWITTER_API_KEY,
            TWITTER_API_SECRET: c.env.TWITTER_API_SECRET,
            TWITTER_ACCESS_TOKEN: c.env.TWITTER_ACCESS_TOKEN,
            TWITTER_ACCESS_SECRET: c.env.TWITTER_ACCESS_SECRET,
            BLUESKY_HANDLE: c.env.BLUESKY_HANDLE || c.env.BLUESKY_IDENTIFIER,
            BLUESKY_APP_PASSWORD: c.env.BLUESKY_APP_PASSWORD || c.env.BLUESKY_PASSWORD,
            FACEBOOK_PAGE_ID: c.env.FACEBOOK_PAGE_ID,
            FACEBOOK_ACCESS_TOKEN: c.env.FACEBOOK_ACCESS_TOKEN,
            INSTAGRAM_ACCOUNT_ID: c.env.INSTAGRAM_ACCOUNT_ID,
            INSTAGRAM_ACCESS_TOKEN: c.env.INSTAGRAM_ACCESS_TOKEN,
        } as Parameters<typeof dispatchQueuePost>[2];

        await dispatchQueuePost(db, post, config);

        return c.json({ success: true }, 200);
    })
    .openapi(analyticsSocialQueueRoute, async (c) => {
        const user = c.get('sessionUser')!
        if (!user || user.role !== "admin") {
            throw new ApiError("Unauthorized", 401);
        }

        const { start, end } = c.req.valid("query");
        const db = getDb(c);

        // EFF-01: Use SQL GROUP BY instead of fetching all rows and filtering in JS
        const dateConditions = [];
        if (start) dateConditions.push(gte(schema.socialQueue.scheduledFor, start));
        if (end) dateConditions.push(lte(schema.socialQueue.scheduledFor, end));
        const dateFilter = dateConditions.length > 0 ? and(...dateConditions) : undefined;

        // Get status counts in a single query
        const statusCounts = await db
            .select({
                status: schema.socialQueue.status,
                count: count(schema.socialQueue.id),
            })
            .from(schema.socialQueue)
            .where(dateFilter)
            .groupBy(schema.socialQueue.status)
            .all();

        let totalPosts = 0;
        let totalSent = 0;
        let totalPending = 0;
        let totalFailed = 0;

        for (const row of statusCounts) {
            const c = Number(row.count);
            totalPosts += c;
            if (row.status === "sent") totalSent = c;
            else if (row.status === "pending") totalPending = c;
            else if (row.status === "failed") totalFailed = c;
        }

        // Platform breakdown still needs row-level data (platforms is JSON)
        const platformRows = await db
            .select({ platforms: schema.socialQueue.platforms })
            .from(schema.socialQueue)
            .where(dateFilter)
            .all();

        const byPlatform = {
            twitter: 0, bluesky: 0, facebook: 0, instagram: 0, discord: 0,
            slack: 0, teams: 0, gchat: 0, linkedin: 0, tiktok: 0, band: 0,
        };

        for (const r of platformRows) {
            const platforms = JSON.parse(String(r.platforms)) as Record<string, boolean>;
            for (const [key, value] of Object.entries(platforms)) {
                if (value && key in byPlatform) {
                    (byPlatform as Record<string, number>)[key]++;
                }
            }
        }

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

export default socialQueueRouter;
