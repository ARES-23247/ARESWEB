import { typedHandler } from "../utils/handler";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, getSessionUser, originIntegrityMiddleware } from "../middleware";
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
  media_urls: r.media_urls ? JSON.parse(String(r.media_urls)) : undefined,
  scheduled_for: String(r.scheduled_for),
  platforms: JSON.parse(String(r.platforms)),
  analytics: r.analytics ? JSON.parse(String(r.analytics)) : null,
  status: r.status as SocialQueuePost["status"],
  linked_type: (r.linked_type as SocialQueuePost["linked_type"]) || null,
  linked_id: (r.linked_id as string) || null,
  created_at: r.created_at ? String(r.created_at) : new Date().toISOString(),
  sent_at: (r.sent_at as string) || null,
  error_message: (r.error_message as string) || null,
  created_by: (r.created_by as string) || null,
});

// List posts
socialQueueRouter.openapi(listSocialQueueRoute, typedHandler<typeof listSocialQueueRoute>(async (c) => {
  try {
    const user = await getSessionUser(c);
    if (!user) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const { status = "all", limit = 20, offset = 0 } = c.req.valid("query");
    const db = c.get("db") as any;

    let queryBuilder = db.selectFrom("social_queue").selectAll();

    if (status !== "all") {
      queryBuilder = queryBuilder.where("status", "=", status);
    }

    if (user.role !== "admin") {
      queryBuilder = queryBuilder.where("created_by", "=", user.id);
    }

    const totalResult = await queryBuilder
      .select((eb: any) => eb.fn.count("id").as("count"))
      .execute();

    const total = Number(totalResult[0].count);

    const results = await queryBuilder
      .orderBy("scheduled_for", "desc")
      .limit(limit)
      .offset(offset)
      .execute();

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
    const db = c.get("db") as any;

    let queryBuilder = db
      .selectFrom("social_queue")
      .selectAll()
      .where("scheduled_for", ">=", start)
      .where("scheduled_for", "<=", end);

    if (user.role !== "admin") {
      queryBuilder = queryBuilder.where("created_by", "=", user.id);
    }

    const results = await queryBuilder.orderBy("scheduled_for", "asc").execute();

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
    const db = c.get("db") as any;
    const id = nanoid();
    const createdAt = new Date().toISOString();

    const newPost = {
      id,
      content: body.content,
      platforms: JSON.stringify(body.platforms),
      media_urls: body.media_urls ? JSON.stringify(body.media_urls) : null,
      scheduled_for: body.scheduled_for,
      status: "pending" as const,
      created_at: createdAt,
      created_by: user.id,
      linked_type: body.linked_type || null,
      linked_id: body.linked_id || null,
    };

    await db.insertInto("social_queue").values(newPost).execute();

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
    const db = c.get("db") as any;

    const existing = await db
      .selectFrom("social_queue")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return c.json({ error: "Post not found" }, 500);
    }
    if (user.role !== "admin" && existing.created_by !== user.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    const updates: Record<string, unknown> = { ...body };
    if (body.platforms) updates.platforms = JSON.stringify(body.platforms);
    if (body.media_urls) updates.media_urls = JSON.stringify(body.media_urls);

    await db.updateTable("social_queue").set(updates).where("id", "=", id).execute();

    const updated = await db
      .selectFrom("social_queue")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirstOrThrow();

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
    const db = c.get("db") as any;

    const existing = await db
      .selectFrom("social_queue")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

    if (!existing) {
      return c.json({ error: "Post not found" }, 500);
    }
    if (user.role !== "admin" && existing.created_by !== user.id) {
      return c.json({ error: "Unauthorized" }, 401);
    }

    await db.deleteFrom("social_queue").where("id", "=", id).execute();

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
    const db = c.get("db") as any;

    const record = await db
      .selectFrom("social_queue")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();

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
    const db = c.get("db") as any;

    let q = db.selectFrom("social_queue");
    if (start) q = q.where("scheduled_for", ">=", start);
    if (end) q = q.where("scheduled_for", "<=", end);

    const results = await q.selectAll().execute();

    const total_posts = results.length;
    const total_sent = results.filter((r: any) => r.status === "sent").length;
    const total_pending = results.filter((r: any) => r.status === "pending").length;
    const total_failed = results.filter((r: any) => r.status === "failed").length;

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

    results.forEach((r: any) => {
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
