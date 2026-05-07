import { typedHandler } from "../utils/handler";
import { eq, desc, asc, and, gte, lte, count } from "drizzle-orm";
import * as schema from "../../../src/db/schema";
import { OpenAPIHono } from "@hono/zod-openapi";

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
  media_urls: r.mediaUrls ? JSON.parse(String(r.mediaUrls)) : undefined,
  scheduled_for: String(r.scheduledFor),
  platforms: JSON.parse(String(r.platforms)),
  analytics: r.analytics ? JSON.parse(String(r.analytics)) : null,
  status: r.status as SocialQueuePost["status"],
  linked_type: (r.linkedType as SocialQueuePost["linked_type"]) || null,
  linked_id: (r.linkedId as string) || null,
  created_at: r.createdAt ? String(r.createdAt) : new Date().toISOString(),
  sent_at: (r.sentAt as string) || null,
  error_message: (r.errorMessage as string) || null,
  created_by: (r.createdBy as string) || null,
});

// List posts
socialQueueRouter.openapi(listSocialQueueRoute, typedHandler<typeof listSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { status = "all", limit = 20, offset = 0 } = c.req.valid("query");
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
  } catch (error) {
    console.error("Social queue list error:", error);
    return c.json({ error: "Failed to fetch scheduled posts" }, 500);
  }
}));

// Calendar view
socialQueueRouter.openapi(calendarSocialQueueRoute, typedHandler<typeof calendarSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { start, end } = c.req.valid("query");
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
  } catch (error) {
    console.error("Social queue calendar error:", error);
    return c.json({ error: "Failed to fetch calendar posts" }, 500);
  }
}));

// Create post
socialQueueRouter.openapi(createSocialQueueRoute, typedHandler<typeof createSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const body = c.req.valid("json");
    const db = getDb(c);
    const id = nanoid();
    const createdAt = new Date().toISOString();

    const newPost = {
      id,
      content: body.content,
      platforms: JSON.stringify(body.platforms),
      mediaUrls: body.media_urls ? JSON.stringify(body.media_urls) : null,
      scheduledFor: body.scheduled_for,
      status: "pending",
      createdAt,
      createdBy: user.id,
      linkedType: body.linked_type || null,
      linkedId: body.linked_id || null,
    };

    await db.insert(schema.socialQueue).values(newPost).run();

    const post: SocialQueuePost = {
      ...body,
      id,
      status: "pending",
      created_at: createdAt,
      created_by: user.id,
      sent_at: null,
      error_message: null,
      analytics: null,
      media_urls: body.media_urls || [],
      linked_type: body.linked_type || null,
      linked_id: body.linked_id || null,
    };

    return c.json({ success: true, post }, 200);
  } catch (error) {
    console.error("Social queue create error:", error);
    return c.json({ error: "Failed to schedule post" }, 500);
  }
}));

// Update post
socialQueueRouter.openapi(updateSocialQueueRoute, typedHandler<typeof updateSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");
    const body = c.req.valid("json");
    const db = getDb(c);

    const existing = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!existing) {
      return c.json({ error: "Post not found" }, 500);
    }
    if (user.role !== "admin" && existing.createdBy !== user.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const updates: Record<string, unknown> = {};
    if (body.content !== undefined) updates.content = body.content;
    if (body.scheduled_for !== undefined) updates.scheduledFor = body.scheduled_for;
    if (body.status !== undefined) updates.status = body.status;
    if (body.linked_type !== undefined) updates.linkedType = body.linked_type;
    if (body.linked_id !== undefined) updates.linkedId = body.linked_id;

    if (body.platforms) updates.platforms = JSON.stringify(body.platforms);
    if (body.media_urls) updates.mediaUrls = JSON.stringify(body.media_urls);

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
  } catch (error) {
    console.error("Social queue update error:", error);
    return c.json({ error: "Failed to update post" }, 500);
  }
}));

// Delete post
socialQueueRouter.openapi(deleteSocialQueueRoute, typedHandler<typeof deleteSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");
    const db = getDb(c);

    const existing = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!existing) {
      return c.json({ error: "Post not found" }, 500);
    }
    if (user.role !== "admin" && existing.createdBy !== user.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await db.delete(schema.socialQueue).where(eq(schema.socialQueue.id, id)).run();

    return c.json({ success: true }, 200);
  } catch (error) {
    console.error("Social queue delete error:", error);
    return c.json({ error: "Failed to delete post" }, 500);
  }
}));

// Send post now
socialQueueRouter.openapi(sendNowSocialQueueRoute, typedHandler<typeof sendNowSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user || user.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { id } = c.req.valid("param");
    const db = getDb(c);

    const record = await db
      .select()
      .from(schema.socialQueue)
      .where(eq(schema.socialQueue.id, id))
      .get();

    if (!record) {
      return c.json({ error: "Post not found" }, 500);
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
  } catch (error) {
    console.error("Social queue sendNow error:", error);
    return c.json({ error: "Failed to send post" }, 500);
  }
}));

// Analytics
socialQueueRouter.openapi(analyticsSocialQueueRoute, typedHandler<typeof analyticsSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user || user.role !== "admin") {
      return c.json({ error: "Unauthorized" }, 401);
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

    const total_posts = results.length;
    const total_sent = results.filter((r) => r.status === "sent").length;
    const total_pending = results.filter((r) => r.status === "pending").length;
    const total_failed = results.filter((r) => r.status === "failed").length;

    const by_platform = {
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
        if (value && key in by_platform) {
          (by_platform as Record<string, number>)[key]++;
        }
      });
    });

    return c.json(
      {
        total_posts,
        total_sent,
        total_pending,
        total_failed,
        by_platform,
        engagement: {
          total_impressions: 0,
          total_likes: 0,
          total_shares: 0,
          total_comments: 0,
        },
      },
      200
    );
  } catch (error) {
    console.error("Social queue analytics error:", error);
    return c.json({ error: "Failed to fetch analytics" }, 500);
  }
}));

export default socialQueueRouter;
