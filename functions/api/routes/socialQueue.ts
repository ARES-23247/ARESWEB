import { createTypedHandler } from "../utils/handler-native";
import { ApiError } from "../middleware/errorHandler";
import { eq, desc, asc, and, gte, lte, count } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";

import { AppEnv, getSessionUser, originIntegrityMiddleware, getDb } from "../middleware";
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

export const socialQueueRouter = new OpenAPIHono<AppEnv>();

// WR-11: Add origin integrity to prevent CSRF attacks on social queue operations
socialQueueRouter.use("*", originIntegrityMiddleware());

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
socialQueueRouter.openapi(listSocialQueueRoute, createTypedHandler(listSocialQueueRoute, async (c, { query }) => {
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { status = "all", limit = 20, offset = 0 } = query;
    const db = getDb(c);

    let condition = undefined;
    const conditions = [];

    if (status !== "all") {
      conditions.push(eq(schema.socialQueue.status, status));
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
}));

// Calendar view
socialQueueRouter.openapi(calendarSocialQueueRoute, createTypedHandler(calendarSocialQueueRoute, async (c, { query }) => {
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { start, end } = query;
    const db = getDb(c);

    const conditions = [
      gte(schema.socialQueue.scheduledFor, start),
      lte(schema.socialQueue.scheduledFor, end),
    ];

    if (user.role !== "admin") {
      conditions.push(eq(schema.socialQueue.createdBy, user.id));
    }

    const results = await db
      .select()
      .from(schema.socialQueue)
      .where(and(...conditions))
      .orderBy(asc(schema.socialQueue.scheduledFor))
      .all();

    const posts: SocialQueuePost[] = results.map(toSocialQueuePost);

    return c.json({ posts }, 200);
}));

// Create post
socialQueueRouter.openapi(createSocialQueueRoute, createTypedHandler(createSocialQueueRoute, async (c, { body }) => {
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }
    const db = getDb(c);
    const id = nanoid();
    const createdAt = new Date().toISOString();

    const newPost = {
      id,
      content: body.content,
      platforms: JSON.stringify(body.platforms),
      mediaUrls: body.mediaUrls ? JSON.stringify(body.mediaUrls) : null,
      scheduledFor: body.scheduledFor,
      status: "pending",
      createdAt,
      createdBy: user.id,
      linkedType: body.linkedType || null,
      linkedId: body.linkedId || null,
    };

    await db.insert(schema.socialQueue).values(newPost).run();

    const post: SocialQueuePost = {
      ...body,
      id,
      status: "pending",
      createdAt,
      createdBy: user.id,
      sentAt: null,
      errorMessage: null,
      analytics: null,
      mediaUrls: body.mediaUrls || [],
      linkedType: body.linkedType || null,
      linkedId: body.linkedId || null,
    };

    return c.json({ success: true, post }, 200);
}));

// Update post
socialQueueRouter.openapi(updateSocialQueueRoute, createTypedHandler(updateSocialQueueRoute, async (c, { params, body }) => {
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = params;
    const db = getDb(c);

    const existing = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!existing) {
      throw new ApiError("Post not found", 500);
    }
    if (user.role !== "admin" && existing.createdBy !== user.id) {
      throw new ApiError("Unauthorized", 401);
    }

    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.scheduledFor !== undefined) updates.scheduledFor = body.scheduledFor;
    if (body.status !== undefined) updates.status = body.status;
    if (body.linkedType !== undefined) updates.linkedType = body.linkedType;
    if (body.linkedId !== undefined) updates.linkedId = body.linkedId;

    if (body.platforms) updates.platforms = JSON.stringify(body.platforms);
    if (body.mediaUrls) updates.mediaUrls = JSON.stringify(body.mediaUrls);

    await db.update(schema.socialQueue).set(updates).where(eq(schema.socialQueue.id, id)).run();

    const updated = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!updated) {
      throw new Error("Failed to retrieve updated post");
    }

    return c.json({ success: true, post: toSocialQueuePost(updated) }, 200);
}));

// Delete post
socialQueueRouter.openapi(deleteSocialQueueRoute, createTypedHandler(deleteSocialQueueRoute, async (c, { params }) => {
    const user = await getSessionUser(c);
    if (!user) {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = params;
    const db = getDb(c);

    const existing = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!existing) {
      throw new ApiError("Post not found", 500);
    }
    if (user.role !== "admin" && existing.createdBy !== user.id) {
      throw new ApiError("Unauthorized", 401);
    }

    await db.delete(schema.socialQueue).where(eq(schema.socialQueue.id, id)).run();

    return c.json({ success: true }, 200);
}));

// Send post now
socialQueueRouter.openapi(sendNowSocialQueueRoute, createTypedHandler(sendNowSocialQueueRoute, async (c, { params }) => {
    const user = await getSessionUser(c);
    if (!user || user.role !== "admin") {
      throw new ApiError("Unauthorized", 401);
    }

    const { id } = params;
    const db = getDb(c);

    const record = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!record) {
      throw new ApiError("Post not found", 500);
    }

    const post = toSocialQueuePost(record);

    const config: Record<string, boolean> = {
      twitter: !!c.env.TWITTER_API_KEY,
      bluesky: !!c.env.BLUESKY_HANDLE,
      facebook: !!c.env.FACEBOOK_ACCESS_TOKEN,
      instagram: !!c.env.INSTAGRAM_ACCESS_TOKEN,
      discord: !!c.env.DISCORD_WEBHOOK_URL,
      slack: !!c.env.SLACK_WEBHOOK_URL,
      linkedin: !!c.env.LINKEDIN_ACCESS_TOKEN,
    };

    await dispatchQueuePost(db, post, config);

    return c.json({ success: true }, 200);
}));

// Analytics
socialQueueRouter.openapi(analyticsSocialQueueRoute, createTypedHandler(analyticsSocialQueueRoute, async (c, { query }) => {
    const user = await getSessionUser(c);
    if (!user || user.role !== "admin") {
      throw new ApiError("Unauthorized", 401);
    }

    const { start, end } = query;
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
    const totalSent = results.filter((r) => r.status === "sent").length;
    const totalPending = results.filter((r) => r.status === "pending").length;
    const totalFailed = results.filter((r) => r.status === "failed").length;

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

    results.forEach((r) => {
      const platforms = JSON.parse(String(r.platforms));
      Object.entries(platforms).forEach(([key, value]) => {
        if (value && key in byPlatform) {
          (byPlatform as Record<string, number>)[key]++;
        }
      });
    });

    return c.json(
      {
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
      },
      200
    );
}));

export default socialQueueRouter;


