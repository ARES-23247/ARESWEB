import { typedHandler } from "../utils/handler";
import { ApiError } from "../middleware/errorHandler";

import { sql } from "drizzle-orm";
import { OpenAPIHono } from "@hono/zod-openapi";

import { eq, or, and, desc, isNull, lte } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

import {
  AppEnv,
  getSessionUser,
  extractAstText,
  ensureAdmin,
  validateLength,
  MAX_INPUT_LENGTHS,
  logAuditAction,
  getSocialConfig,
  edgeCacheMiddleware,
  getDb,
} from "../middleware";
import { getStandardDate } from "../../utils/content";
import { dispatchSocials } from "../../utils/socialSync";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../utils/notifications";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import {
  approvePost,
  restorePostFromHistory,
  createShadowRevision,
  captureHistory,
  pruneHistory,
} from "../../utils/postHistory";
import {
  getPostsRoute,
  getPostRoute,
  getAdminPostsRoute,
  getAdminPostRoute,
  savePostRoute,
  updatePostRoute,
  deletePostRoute,
  undeletePostRoute,
  purgePostRoute,
  approvePostRoute,
  rejectPostRoute,
  getPostHistoryRoute,
  restorePostHistoryRoute,
  repushSocialsRoute,
} from "../../../shared/routes/posts";
import { siteConfig } from "../../utils/site.config";

export const postsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public blog routes (GET only, non-admin)
postsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/internal/")) {
    return next();
  }
  return edgeCacheMiddleware(300, 60, 600)(c, next);
});

// ─── Middleware Configuration ─────────────────────────────────────────────
// Cache public GET requests at the edge
// Using aggressive caching (5 min edge, 1 min browser, 10 min SWR) for public blog content


// Admin routes require authentication
postsRouter.use("/admin/:slug/history", ensureAdmin);
postsRouter.use("/admin/:slug/history/*", ensureAdmin);
postsRouter.use("/admin/*", ensureAdmin);

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 * Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
 */
const sanitizeFtsQuery = (query: string): string => {
  const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
  if (!cleanQ) return "";
  return `"${cleanQ.replace(/"/g, '""')}*`;
};

// ─── Public Routes ───────────────────────────────────────────────────────

postsRouter.openapi(getPostsRoute, typedHandler<typeof getPostsRoute>(async (c) => {
  const { limit = 10, offset = 0, q } = c.req.valid("query");

    const db = getDb(c);

    if (q) {
      const cleanQ = sanitizeFtsQuery(String(q || ""));
      if (!cleanQ) {
        return c.json({ posts: [] }, 200);
      }

      const results = await db.run(sql<{
        slug: string;
        title: string;
        date: string | null;
        snippet: string | null;
        thumbnail: string | null;
        status: string;
        season_id: number | null;
        author: string | null;
        author_nickname: string | null;
        author_avatar: string | null;
        published_at: string | null;
      }>`
        SELECT p.slug, p.title, p.date, p.snippet, p.thumbnail, p.status, p.season_id, p.author,
                uP.nickname as author_nickname, u.image as author_avatar, p.published_at
         FROM posts_fts f
         JOIN posts p ON f.slug = p.slug
         LEFT JOIN user u ON p.cf_email = u.email
         LEFT JOIN user_profiles uP ON u.id = uP.user_id
         WHERE p.is_deleted = 0 AND p.status = 'published' AND (p.published_at IS NULL OR datetime(p.published_at) <= datetime('now'))
         AND f.posts_fts MATCH ${cleanQ}
         ORDER BY f.rank LIMIT ${Number(limit) || 10} OFFSET ${Number(offset) || 0}
      `);

      type FtsPostRow = {
        slug: string;
        title: string;
        date: string | null;
        snippet: string | null;
        thumbnail: string | null;
        status: string;
        season_id: number | null;
        author: string | null;
        author_nickname: string | null;
        author_avatar: string | null;
        published_at: string | null;
      };

      const rows = (results as unknown as { rows: FtsPostRow[] }).rows || [];
      const posts = rows.map((p: FtsPostRow) => ({
        slug: p.slug,
        title: p.title,
        date: p.date,
        snippet: p.snippet,
        thumbnail: p.thumbnail,
        status: p.status,
        author: p.author,
        author_nickname: p.author_nickname,
        author_avatar: p.author_avatar,
        published_at: p.published_at,
        season_id: p.season_id ? Number(p.season_id) : null,
        is_deleted: 0,
        is_portfolio: 0,
      }));

      return c.json({ posts }, 200);
    }

    const results = await db
      .select({
        slug: schema.posts.slug,
        title: schema.posts.title,
        date: schema.posts.date,
        snippet: schema.posts.snippet,
        thumbnail: schema.posts.thumbnail,
        status: schema.posts.status,
        author: schema.posts.author,
        season_id: schema.posts.seasonId,
        published_at: schema.posts.publishedAt,
        author_nickname: schema.userProfiles.nickname,
        author_avatar: schema.user.image,
      })
      .from(schema.posts)
      .leftJoin(schema.user, eq(schema.posts.cfEmail, schema.user.email))
      .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
      .where(and(
        eq(schema.posts.isDeleted, 0),
        eq(schema.posts.status, "published"),
        or(
          isNull(schema.posts.publishedAt),
          lte(schema.posts.publishedAt, new Date().toISOString())
        )
      ))
      .orderBy(desc(schema.posts.date))
      .limit(Number(limit) || 10)
      .offset(Number(offset) || 0)
      .all();

    const posts = results.map((p) => ({
      slug: p.slug,
      title: p.title,
      date: p.date,
      snippet: p.snippet,
      thumbnail: p.thumbnail,
      status: p.status,
      author: p.author,
      author_nickname: p.author_nickname,
      author_avatar: p.author_avatar,
      published_at: p.published_at,
      season_id: p.season_id ? Number(p.season_id) : null,
      is_deleted: 0,
      is_portfolio: 0,
    }));

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
    return c.json({ posts }, 200);
}));

postsRouter.openapi(getPostRoute, typedHandler<typeof getPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);
    const user = await getSessionUser(c);

    const row = await db
      .select({
        slug: schema.posts.slug,
        title: schema.posts.title,
        date: schema.posts.date,
        ast: schema.posts.ast,
        thumbnail: schema.posts.thumbnail,
        status: schema.posts.status,
        author: schema.posts.author,
        season_id: schema.posts.seasonId,
        published_at: schema.posts.publishedAt,
        zulip_stream: schema.posts.zulipStream,
        zulip_topic: schema.posts.zulipTopic,
        author_nickname: schema.userProfiles.nickname,
        author_avatar: schema.user.image,
      })
      .from(schema.posts)
      .leftJoin(schema.user, eq(schema.posts.cfEmail, schema.user.email))
      .leftJoin(schema.userProfiles, eq(schema.user.id, schema.userProfiles.userId))
      .where(and(
        eq(schema.posts.slug, slug),
        eq(schema.posts.isDeleted, 0),
        eq(schema.posts.status, "published"),
        or(
          isNull(schema.posts.publishedAt),
          lte(schema.posts.publishedAt, new Date().toISOString())
        )
      ))
      .limit(1)
      .get();

    if (!row) throw new ApiError("Post", 404, "NOT_FOUND");

    return c.json(
      {
        post: {
          slug: row.slug,
          title: row.title,
          date: row.date,
          snippet: null,
          thumbnail: row.thumbnail,
          status: row.status,
          author: row.author,
          author_nickname: row.author_nickname,
          author_avatar: row.author_avatar,
          published_at: row.published_at,
          season_id: row.season_id ? Number(row.season_id) : null,
          is_deleted: 0,
          is_portfolio: 0,
          zulip_stream: row.zulip_stream,
          zulip_topic: row.zulip_topic,
          ast: row.ast || "{}",
        },
        is_editor: user?.role === "admin" || user?.role === "author",
        author: {
          id: row.author || "system",
          name: row.author_nickname || null,
          image: row.author_avatar || null,
          role: "author",
        },
      },
      200
    );
}));

// ─── Admin Routes ────────────────────────────────────────────────────────

postsRouter.openapi(getAdminPostsRoute, typedHandler<typeof getAdminPostsRoute>(async (c) => {
  const { limit = 50, offset = 0 } = c.req.valid("query");

    const db = getDb(c);

    let results;
    try {
      results = await db
        .select({
          slug: schema.posts.slug,
          title: schema.posts.title,
          date: schema.posts.date,
          snippet: schema.posts.snippet,
          thumbnail: schema.posts.thumbnail,
          cf_email: schema.posts.cfEmail,
          is_deleted: schema.posts.isDeleted,
          status: schema.posts.status,
          revision_of: schema.posts.revisionOf,
          published_at: schema.posts.publishedAt,
          season_id: schema.posts.seasonId,
          author: schema.posts.author,
        })
        .from(schema.posts)
        .orderBy(desc(schema.posts.date))
        .limit(Number(limit) || 50)
        .offset(Number(offset) || 0)
        .all();
    } catch (primaryError) {
      console.error("[Posts:AdminList] Primary query failed, trying fallback:", primaryError);
      results = await db
        .select({
          slug: schema.posts.slug,
          title: schema.posts.title,
          date: schema.posts.date,
          snippet: schema.posts.snippet,
          thumbnail: schema.posts.thumbnail,
          cf_email: schema.posts.cfEmail,
          is_deleted: schema.posts.isDeleted,
          author: schema.posts.author,
        })
        .from(schema.posts)
        .orderBy(desc(schema.posts.date))
        .limit(Number(limit) || 50)
        .offset(Number(offset) || 0)
        .all();
    }

    type AdminPostResult = typeof results extends (infer T)[] ? T : never;

    const posts = results.map((p: AdminPostResult) => {
      const hasSeasonId = "season_id" in p;
      const hasPublishedAt = "published_at" in p;
      const hasStatus = "status" in p;
      return {
        slug: p.slug,
        title: p.title,
        date: p.date,
        snippet: p.snippet,
        thumbnail: p.thumbnail,
        status: hasStatus && p.status ? (p.status as string) : null,
        author: p.author ?? null,
        author_nickname: null,
        author_avatar: null,
        published_at: hasPublishedAt ? (p.published_at as string | null | undefined) ?? null : null,
        season_id: hasSeasonId && p.season_id ? Number(p.season_id as number | string) : null,
        is_deleted: Number(p.is_deleted ?? 0),
        is_portfolio: 0,
        zulip_stream: null,
        zulip_topic: null,
      };
    });

    return c.json({ posts }, 200);
}));

postsRouter.openapi(getAdminPostRoute, typedHandler<typeof getAdminPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);
    const row = await db
      .select({
        slug: schema.posts.slug,
        title: schema.posts.title,
        date: schema.posts.date,
        snippet: schema.posts.snippet,
        thumbnail: schema.posts.thumbnail,
        ast: schema.posts.ast,
        is_deleted: schema.posts.isDeleted,
        status: schema.posts.status,
        revision_of: schema.posts.revisionOf,
        published_at: schema.posts.publishedAt,
        season_id: schema.posts.seasonId,
        author: schema.posts.author,
        zulip_stream: schema.posts.zulipStream,
        zulip_topic: schema.posts.zulipTopic,
      })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();

    if (!row) throw new ApiError("Post", 404, "NOT_FOUND");

    return c.json(
      {
        post: {
          slug: row.slug,
          title: row.title,
          date: row.date,
          snippet: row.snippet ?? null,
          thumbnail: row.thumbnail ?? null,
          status: row.status ?? null,
          author: row.author ?? null,
          author_nickname: null,
          author_avatar: null,
          published_at: row.published_at ?? null,
          season_id: row.season_id ? Number(row.season_id) : null,
          is_deleted: Number(row.is_deleted),
          is_portfolio: 0,
          zulip_stream: row.zulip_stream ?? null,
          zulip_topic: row.zulip_topic ?? null,
          ast: row.ast || "{}",
        },
      },
      200
    );
}));

postsRouter.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  const body = c.req.valid("json");

    const db = getDb(c);

    // If slug is provided, update existing post
    if (body.slug) {
      const existing = await db
        .select({
          slug: schema.posts.slug,
          title: schema.posts.title,
          ast: schema.posts.ast,
          author: schema.posts.author,
          thumbnail: schema.posts.thumbnail,
          snippet: schema.posts.snippet,
          cfEmail: schema.posts.cfEmail,
          seasonId: schema.posts.seasonId,
        })
        .from(schema.posts)
        .where(eq(schema.posts.slug, body.slug))
        .limit(1)
        .get();

      if (!existing) {
        throw new ApiError("Post", 404, "NOT_FOUND");
      }

      const user = await getSessionUser(c);
      const _email = user?.email || "anonymous_dashboard_user";

      // Create shadow revision for history
      await captureHistory(c, body.slug, existing);

      await db
        .update(schema.posts)
        .set({
          title: body.title,
          ast: JSON.stringify(body.ast),
          contentDraft: typeof body.content === "string" ? body.content : null,
          isPortfolio: body.isPortfolio ? 1 : 0,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.posts.slug, body.slug))
        .run();

      return c.json({ success: true, slug: body.slug }, 200);
    }

    const titleError = validateLength(body.title, MAX_INPUT_LENGTHS.title, "Title");
    if (titleError) throw new ApiError(titleError, 400, "VALIDATION_ERROR");

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_dashboard_user";
    const dateStr = getStandardDate();

    const recent = await db
      .select({ slug: schema.posts.slug })
      .from(schema.posts)
      .where(and(
        eq(schema.posts.title, body.title),
        eq(schema.posts.cfEmail, email),
        eq(schema.posts.date, dateStr)
      ))
      .limit(1)
      .get();

    if (recent) {
      throw new ApiError("A post with this title already exists for today", 409);
    }

    let slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `untitled-${Date.now()}`;

    const existing = await db
      .select({ slug: schema.posts.slug })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();
    if (existing) {
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${suffix}`;
    }

    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(body.ast).substring(0, 200);

    const status = body.isDraft ? "pending" : user?.role === "admin" ? "published" : "pending";

    await db
      .insert(schema.posts)
      .values({
        slug,
        title: body.title,
        author: "ARES Team",
        date: dateStr,
        thumbnail: body.thumbnail || "",
        snippet,
        ast: astStr,
        cfEmail: email,
        status,
        publishedAt: body.publishedAt || null,
        seasonId: body.seasonId ? Number(body.seasonId) : null,
        zulipStream: "blog",
        zulipTopic: `Blog: ${body.title}`,
      })
      .run();

    c.executionCtx.waitUntil(
      db
        .insert(schema.documentHistory)
        .values({
          roomId: `post_${slug}`,
          content: astStr,
          createdBy: email,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .run()
    );

    c.executionCtx.waitUntil(pruneHistory(c, slug, 10));
    c.executionCtx.waitUntil(
      logAuditAction(c, "CREATE_POST", "posts", slug, `Created post: ${body.title} (${status})`)
    );
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);

    const warnings: string[] = [];

    if (status === "published") {
      const socialConfig = await getSocialConfig(c);
      const socialsFilter = body.socials || null;
      const baseUrl = new URL(c.req.url).origin;

      c.executionCtx.waitUntil(
        (async () => {
          try {
            await dispatchSocials(
              db,
              {
                title: body.title,
                url: `${baseUrl}/blog/${slug}`,
                snippet: snippet || "Read the latest engineering update from ARES 23247!",
                thumbnail: body.thumbnail || "/gallery_1.png",
                baseUrl: baseUrl,
              },
              socialConfig,
              socialsFilter
            );
          } catch (err) {
            console.error("Social dispatch failed:", err);
          }
        })()
      );

      try {
        c.executionCtx.waitUntil(
          sendZulipMessage(
            socialConfig,
            "blog",
            `Blog: ${body.title}`,
            `🚀 **New Blog Post Published:** [${body.title}](${siteConfig.urls.base}/blog/${slug})\n\n${snippet.substring(0, 300)}`
          ).catch((err: unknown) => {
            console.error("[Posts] Zulip announcement failed:", err);
            warnings.push("Zulip Notification Failed");
          })
        );
      } catch (err) {
        console.error("Zulip prepare failed", err);
        warnings.push("Zulip Notification Failed");
      }
    }

    if (status === "pending") {
      const notifyPromise = notifyByRole(c, ["admin", "coach", "mentor"], {
        title: "📝 Pending Blog Post",
        message: `"${body.title}" submitted by ${email} needs review.`,
        link: "/dashboard/manage_blog",
        external: true,
        priority: "medium",
      });

      c.executionCtx.waitUntil(
        notifyPromise.catch(function handleNotifyError(e: unknown) {
          console.error("[Posts] notifyByRole error:", e);
        })
      );
    }

    const warning = warnings.length > 0 ? warnings.join(" | ") : undefined;
    return c.json({ success: true, slug, warning }, 200);
}));

postsRouter.openapi(updatePostRoute, typedHandler<typeof updatePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const body = c.req.valid("json");

    const db = getDb(c);
    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(body.ast).substring(0, 200);
    const user = await getSessionUser(c);

    if (user?.role !== "admin") {
      if (!user) {
        throw new ApiError("Unauthorized", 401);
      }
      const revSlug = await createShadowRevision(c, slug, user, {
        title: body.title,
        author: "ARES Team",
        thumbnail: body.thumbnail,
        snippet,
        astStr,
        publishedAt: body.publishedAt,
        seasonId: body.seasonId,
      });
      return c.json({ success: true, slug: revSlug }, 200);
    }

    const status = body.isDraft ? "pending" : "published";

    const current = await db
      .select({
        title: schema.posts.title,
        author: schema.posts.author,
        thumbnail: schema.posts.thumbnail,
        snippet: schema.posts.snippet,
        ast: schema.posts.ast,
        cf_email: schema.posts.cfEmail,
        season_id: schema.posts.seasonId,
      })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();

    if (current) {
      await captureHistory(c, slug, {
        title: current.title,
        author: current.author,
        thumbnail: current.thumbnail,
        snippet: current.snippet,
        ast: current.ast,
        cfEmail: current.cf_email,
        seasonId: current.season_id,
      });
    }

    await db
      .update(schema.posts)
      .set({
        title: body.title,
        thumbnail: body.thumbnail || "",
        snippet,
        ast: astStr,
        status,
        contentDraft: null,
        publishedAt: body.publishedAt || null,
        seasonId: body.seasonId ? Number(body.seasonId) : null,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(schema.posts.slug, slug))
      .run();

    c.executionCtx.waitUntil(
      db
        .insert(schema.documentHistory)
        .values({
          roomId: `post_${slug}`,
          content: astStr,
          createdBy: user?.email || "anonymous",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .run()
    );

    c.executionCtx.waitUntil(
      logAuditAction(c, "UPDATE_POST", "posts", slug, `Updated post: ${body.title} (${status})`)
    );
    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);

    return c.json({ success: true, slug }, 200);
}));

postsRouter.openapi(deletePostRoute, typedHandler<typeof deletePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);
    await db
      .update(schema.posts)
      .set({ isDeleted: 1, status: "draft", updatedAt: new Date().toISOString() })
      .where(eq(schema.posts.slug, slug))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "DELETE_POST", "posts", slug));

    triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);

    return c.json({ success: true }, 200);
}));

postsRouter.openapi(undeletePostRoute, typedHandler<typeof undeletePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);
    await db
      .update(schema.posts)
      .set({ isDeleted: 0, status: "draft", updatedAt: new Date().toISOString() })
      .where(eq(schema.posts.slug, slug))
      .run();
    c.executionCtx.waitUntil(logAuditAction(c, "RESTORE_POST", "posts", slug));

    return c.json({ success: true }, 200);
}));

postsRouter.openapi(purgePostRoute, typedHandler<typeof purgePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);

    const post = await db
      .select({ thumbnail: schema.posts.thumbnail })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();

    if (post?.thumbnail && c.env.ARES_STORAGE) {
      try {
        const url = new URL(post.thumbnail);
        const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
        c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(key));
      } catch (e) {
        console.error("[Posts] Failed to parse/delete thumbnail:", e);
      }
    }

    await db.delete(schema.posts).where(eq(schema.posts.slug, slug)).run();
    c.executionCtx.waitUntil(logAuditAction(c, "PURGE_POST", "posts", slug));

    return c.json({ success: true }, 200);
}));

postsRouter.openapi(approvePostRoute, typedHandler<typeof approvePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const result = await approvePost(c, slug);
    if (!result.success) {
      throw new ApiError(result.error || "Post", 404);
    }

    return c.json({ success: true, warnings: result.warnings }, 200);
}));

postsRouter.openapi(rejectPostRoute, typedHandler<typeof rejectPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { reason } = c.req.valid("json");

    const db = getDb(c);
    const row = await db
      .select({
        title: schema.posts.title,
        cf_email: schema.posts.cfEmail,
      })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();

    await db
      .update(schema.posts)
      .set({ status: "rejected", updatedAt: new Date().toISOString() })
      .where(eq(schema.posts.slug, slug))
      .run();

    if (row?.cf_email) {
      const author = await db
        .select({ id: schema.user.id })
        .from(schema.user)
        .where(eq(schema.user.email, row.cf_email))
        .limit(1)
        .get();
      if (author) {
        c.executionCtx.waitUntil(
          emitNotification(c, {
            userId: String(author.id),
            title: "Post Rejected",
            message: `Your post "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`,
            link: "/dashboard/manage_blog",
            priority: "high",
          })
        );
      }
    }
    c.executionCtx.waitUntil(logAuditAction(c, "REJECT_POST", "posts", slug));

    return c.json({ success: true }, 200);
}));

postsRouter.openapi(getPostHistoryRoute, typedHandler<typeof getPostHistoryRoute>(async (c) => {
  const { slug } = c.req.valid("param");

    const db = getDb(c);
    const historyRows = await db
      .select({
        id: schema.postsHistory.id,
        slug: schema.postsHistory.slug,
        title: schema.postsHistory.title,
        author: schema.postsHistory.author,
        thumbnail: schema.postsHistory.thumbnail,
        snippet: schema.postsHistory.snippet,
        ast: schema.postsHistory.ast,
        created_at: schema.postsHistory.createdAt,
      })
      .from(schema.postsHistory)
      .where(eq(schema.postsHistory.slug, slug))
      .orderBy(desc(schema.postsHistory.createdAt))
      .limit(50)
      .all();

    const history = historyRows.map((h) => ({
      id: Number(h.id),
      slug: h.slug,
      title: h.title,
      author: h.author ?? null,
      thumbnail: h.thumbnail ?? null,
      snippet: h.snippet ?? null,
      ast: h.ast,
      created_at: h.created_at,
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return c.json({ history } as any, 200);
}));

postsRouter.openapi(restorePostHistoryRoute, typedHandler<typeof restorePostHistoryRoute>(async (c) => {
  const { slug, id } = c.req.valid("param");
  const user = await getSessionUser(c);
  const result = await restorePostFromHistory(c, slug, String(id), user?.email || "anonymous_admin");

  if (!result.success) {
    throw new ApiError(result.error || "History entry", 404);
  }

  return c.json({ success: true }, 200);
}));

postsRouter.openapi(repushSocialsRoute, typedHandler<typeof repushSocialsRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const { socials } = c.req.valid("json");

    const db = getDb(c);
    const post = await db
      .select({
        title: schema.posts.title,
        snippet: schema.posts.snippet,
        thumbnail: schema.posts.thumbnail,
      })
      .from(schema.posts)
      .where(eq(schema.posts.slug, slug))
      .limit(1)
      .get();

    if (!post) throw new ApiError("Post", 404, "NOT_FOUND");

    const socialConfig = await getSocialConfig(c);
    const baseUrl = new URL(c.req.url).origin;

    c.executionCtx.waitUntil(
      dispatchSocials(
        db,
        {
          title: String(post.title),
          url: `${baseUrl}/blog/${slug}`,
          snippet: post.snippet || "Read the latest update from ARES 23247!",
          thumbnail: post.thumbnail || "",
          baseUrl: baseUrl,
        },
        socialConfig,
        socials
          ? socials.reduce(
              (acc: Record<string, boolean>, curr: string) => ({ ...acc, [curr]: true }),
              {} as Record<string, boolean>
            )
          : null
      ).catch((err: unknown) => console.error("[Repush] Social dispatch failed:", err))
    );

    return c.json({ success: true }, 200);
}));

export default postsRouter;
