/* eslint-disable @typescript-eslint/no-explicit-any */
import { typedHandler } from "../utils/handler";
 
import { sql, Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { OpenAPIHono } from "@hono/zod-openapi";

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
} from "../middleware";
import { getStandardDate } from "../../utils/content";
import { dispatchSocials } from "../../utils/socialSync";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../utils/notifications";
import { triggerBackgroundReindex } from "./ai/autoReindex";
import {
  approvePost,
  getPostHistory,
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
  postSchema as _postSchema,
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
postsRouter.use("/", edgeCacheMiddleware(300, 60, 600));
postsRouter.use("/:slug", edgeCacheMiddleware(300, 60, 600));
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
  try {
    const db = c.get("db") as any;
    const { limit = 10, offset = 0, q } = c.req.valid("query");

    if (q) {
      const cleanQ = sanitizeFtsQuery(String(q || ""));
      if (!cleanQ) return c.json({ posts: [] } as any, 200 as any);

      const results = await sql<{
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
      `.execute(db);

      const posts = results.rows.map((p: any) => ({
        ...p,
        season_id: p.season_id ? Number(p.season_id) : null,
        is_deleted: 0,
        is_portfolio: 0,
      }));

      return c.json({ posts } as any, 200 as any);
    }

    const results = await db
      .selectFrom("posts")
      .leftJoin("user as u", "posts.cf_email", "u.email")
      .leftJoin("user_profiles as uP", "u.id", "uP.user_id")
      .select([
        "posts.slug",
        "posts.title",
        "posts.date",
        "posts.snippet",
        "posts.thumbnail",
        "posts.status",
        "posts.author",
        "posts.season_id",
        "posts.published_at",
        "uP.nickname as author_nickname",
        "u.image as author_avatar",
      ])
      .where("posts.is_deleted", "=", 0)
      .where("posts.status", "=", "published")
      .where((eb: any) =>
        eb.or([
          eb("published_at", "is", null),
          eb("published_at", "<=", new Date().toISOString()),
        ])
      )
      .orderBy("posts.date", "desc")
      .limit(Number(limit) || 10)
      .offset(Number(offset) || 0)
      .execute();

    const posts = results.map((p: any) => ({
      ...p,
      season_id: p.season_id ? Number(p.season_id) : null,
      is_deleted: 0,
      is_portfolio: 0,
    }));

    c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=600");
    return c.json({ posts } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:List] Error", e);
    return c.json({ error: "Failed to fetch posts" } as any, 500 as any);
  }
}));

postsRouter.openapi(getPostRoute, typedHandler<typeof getPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;
    const user = await getSessionUser(c);

    const row = await db
      .selectFrom("posts")
      .leftJoin("user as u", "posts.cf_email", "u.email")
      .leftJoin("user_profiles as uP", "u.id", "uP.user_id")
      .select([
        "posts.slug",
        "posts.title",
        "posts.date",
        "posts.ast",
        "posts.thumbnail",
        "posts.status",
        "posts.author",
        "posts.season_id",
        "posts.published_at",
        "posts.zulip_stream",
        "posts.zulip_topic",
        "uP.nickname as author_nickname",
        "u.image as author_avatar",
      ])
      .where("posts.slug", "=", slug)
      .where("posts.is_deleted", "=", 0)
      .where("posts.status", "=", "published")
      .where((eb: any) =>
        eb.or([
          eb("published_at", "is", null),
          eb("published_at", "<=", new Date().toISOString()),
        ])
      )
      .executeTakeFirst();

    if (!row) return c.json({ error: "Post not found" } as any, 404 as any);

    return c.json(
      {
        post: {
          ...row,
          season_id: row.season_id ? Number(row.season_id) : null,
          is_deleted: 0,
          is_portfolio: 0,
          ast: row.ast || "{}",
        },
        is_editor: user?.role === "admin" || user?.role === "author",
        author: {
          id: row.author || "system",
          name: row.author_nickname || null,
          image: row.author_avatar || null,
          role: "author",
        },
      } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Detail] Error", e);
    return c.json({ error: "Failed to fetch post" } as any, 500 as any);
  }
}));

// ─── Admin Routes ────────────────────────────────────────────────────────

postsRouter.openapi(getAdminPostsRoute, typedHandler<typeof getAdminPostsRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const { limit = 50, offset = 0 } = c.req.valid("query");

    let results;
    try {
      results = await db
        .selectFrom("posts")
        .select([
          "slug",
          "title",
          "date",
          "snippet",
          "thumbnail",
          "cf_email",
          "is_deleted",
          "status",
          "revision_of",
          "published_at",
          "season_id",
          "author",
        ])
        .orderBy("date", "desc")
        .limit(Number(limit) || 50)
        .offset(Number(offset) || 0)
        .execute();
    } catch (primaryError) {
      console.error("[Posts:AdminList] Primary query failed, trying fallback:", primaryError);
      results = await db
        .selectFrom("posts")
        .select(["slug", "title", "date", "snippet", "thumbnail", "cf_email", "is_deleted", "author"])
        .orderBy("date", "desc")
        .limit(Number(limit) || 50)
        .offset(Number(offset) || 0)
        .execute();
    }

    const posts = results.map((p: any) => {
      const item = p as { season_id?: unknown; is_deleted?: unknown };
      return {
        ...p,
        season_id: item.season_id ? Number(item.season_id) : null,
        is_deleted: Number(item.is_deleted ?? 0),
        is_portfolio: 0,
      };
    });

    return c.json({ posts } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:AdminList] Error", e);
    return c.json({ error: "Failed to fetch posts" } as any, 500 as any);
  }
}));

postsRouter.openapi(getAdminPostRoute, typedHandler<typeof getAdminPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;
    const row = await db
      .selectFrom("posts")
      .select([
        "slug",
        "title",
        "date",
        "snippet",
        "thumbnail",
        "ast",
        "is_deleted",
        "status",
        "revision_of",
        "published_at",
        "season_id",
        "author",
        "zulip_stream",
        "zulip_topic",
      ])
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (!row) return c.json({ error: "Post not found" } as any, 404 as any);

    return c.json(
      {
        post: {
          ...row,
          season_id: row.season_id ? Number(row.season_id) : null,
          is_deleted: Number(row.is_deleted),
          is_portfolio: 0,
          ast: row.ast || "{}",
        },
      } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:AdminDetail] Error", e);
    return c.json({ error: "Failed to fetch post" } as any, 500 as any);
  }
}));

postsRouter.openapi(savePostRoute, typedHandler<typeof savePostRoute>(async (c) => {
  try {
    const db = c.get("db") as any;
    const body = c.req.valid("json");

    // If slug is provided, update existing post
    if (body.slug) {
      const existing = await db.selectFrom("posts")
        .select(["slug", "title", "ast"] as any)
        .where("slug", "=", body.slug)
        .executeTakeFirst();

      if (!existing) {
        return c.json({ error: "Post not found" } as any, 404 as any);
      }

      const user = await getSessionUser(c);
      const _email = user?.email || "anonymous_dashboard_user";

      // Create shadow revision for history
      await captureHistory(c, body.slug, existing as any);

      await db.updateTable("posts")
        .set({
          title: body.title,
          ast: body.ast as string,
          content: typeof body.content === "string" ? body.content : null,
          category: body.category,
          is_portfolio: body.isPortfolio ? 1 : 0,
          updated_at: new Date().toISOString()
        } as any)
        .where("slug", "=", body.slug)
        .execute();

      return c.json({ success: true, slug: body.slug });
    }

    const titleError = validateLength(body.title, MAX_INPUT_LENGTHS.title, "Title");
    if (titleError) return c.json({ error: titleError } as any, 400 as any);

    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_dashboard_user";
    const dateStr = getStandardDate();

    const recent = await db
      .selectFrom("posts")
      .select("slug")
      .where("title", "=", body.title)
      .where("cf_email", "=", email)
      .where("date", "=", dateStr)
      .executeTakeFirst();

    if (recent) {
      return c.json({ error: "A post with this title already exists for today" } as any, 409 as any);
    }

    let slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `untitled-${Date.now()}`;

    const existing = await db.selectFrom("posts").select("slug").where("slug", "=", slug).executeTakeFirst();
    if (existing) {
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${suffix}`;
    }

    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(body.ast).substring(0, 200);

    const status = body.isDraft ? "pending" : user?.role === "admin" ? "published" : "pending";

    await db
      .insertInto("posts")
      .values({
        slug,
        title: body.title,
        author: "ARES Team",
        date: dateStr,
        thumbnail: body.thumbnail || "",
        snippet,
        ast: astStr,
        cf_email: email,
        status,
        published_at: body.publishedAt || null,
        season_id: body.seasonId ? Number(body.seasonId) : null,
        zulip_stream: "blog",
        zulip_topic: `Blog: ${body.title}`,
      })
      .execute();

    c.executionCtx.waitUntil(
      db
        .insertInto("document_history")
        .values({
          room_id: `post_${slug}`,
          content: astStr,
          created_by: email,
          created_at: new Date().toISOString(),
        })
        .execute()
    );

    c.executionCtx.waitUntil(pruneHistory(c, slug, 10));
    c.executionCtx.waitUntil(
      logAuditAction(c, "CREATE_POST", "posts", slug, `Created post: ${body.title} (${status})`)
    );
    triggerBackgroundReindex(c.executionCtx, c.get("db") as any, c.env.AI, c.env.VECTORIZE_DB);

    const warnings: string[] = [];

    if (status === "published") {
      const socialConfig = await getSocialConfig(c);
      const socialsFilter = body.socials || null;
      const baseUrl = new URL(c.req.url).origin;

      c.executionCtx.waitUntil(
        (async () => {
          try {
            await dispatchSocials(
              c.get("db") as any,
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
          ).catch((err: any) => {
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

    return c.json({ success: true, slug, warning: warnings.join(" | ") } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Save] Error", e);
    return c.json({ error: "Database write failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(updatePostRoute, typedHandler<typeof updatePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;
    const body = c.req.valid("json");
    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(body.ast).substring(0, 200);
    const user = await getSessionUser(c);

    if (user?.role !== "admin") {
      const revSlug = await createShadowRevision(c, slug, user!, {
        title: body.title,
        author: "ARES Team",
        thumbnail: body.thumbnail,
        snippet,
        astStr,
        publishedAt: body.publishedAt,
        seasonId: body.seasonId,
      });
      return c.json({ success: true, slug: revSlug } as any, 200 as any);
    }

    const status = body.isDraft ? "pending" : "published";

    const current = await db
      .selectFrom("posts")
      .select(["title", "author", "thumbnail", "snippet", "ast", "cf_email", "season_id"])
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (current) {
      await captureHistory(c, slug, current);
    }

    await db
      .updateTable("posts")
      .set({
        title: body.title,
        thumbnail: body.thumbnail || "",
        snippet,
        ast: astStr,
        status,
        content_draft: null,
        published_at: body.publishedAt || null,
        season_id: body.seasonId ? Number(body.seasonId) : null,
        updated_at: new Date().toISOString(),
      })
      .where("slug", "=", slug)
      .execute();

    c.executionCtx.waitUntil(
      db
        .insertInto("document_history")
        .values({
          room_id: `post_${slug}`,
          content: astStr,
          created_by: user?.email || "anonymous",
          created_at: new Date().toISOString(),
        })
        .execute()
    );

    c.executionCtx.waitUntil(
      logAuditAction(c, "UPDATE_POST", "posts", slug, `Updated post: ${body.title} (${status})`)
    );
    triggerBackgroundReindex(c.executionCtx, c.get("db") as any, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true, slug } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Update] Error", e);
    return c.json({ error: "Database write failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(deletePostRoute, typedHandler<typeof deletePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;
    await db
      .updateTable("posts")
      .set({ is_deleted: 1, status: "draft", updated_at: new Date().toISOString() })
      .where("slug", "=", slug)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "DELETE_POST", "posts", slug));

    triggerBackgroundReindex(c.executionCtx, c.get("db") as any, c.env.AI, c.env.VECTORIZE_DB);
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Delete] Error", e);
    return c.json({ error: "Delete failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(undeletePostRoute, typedHandler<typeof undeletePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;
    await db
      .updateTable("posts")
      .set({ is_deleted: 0, status: "draft", updated_at: new Date().toISOString() })
      .where("slug", "=", slug)
      .execute();
    c.executionCtx.waitUntil(logAuditAction(c, "RESTORE_POST", "posts", slug));
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Undelete] Error", e);
    return c.json({ error: "Undelete failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(purgePostRoute, typedHandler<typeof purgePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const db = c.get("db") as any;

    const post = await db
      .selectFrom("posts")
      .select("thumbnail")
      .where("slug", "=", slug)
      .executeTakeFirst();

    if (post?.thumbnail && c.env.ARES_STORAGE) {
      try {
        const url = new URL(post.thumbnail);
        const key = url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname;
        c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(key));
      } catch (e) {
        console.error("[Posts] Failed to parse/delete thumbnail:", e);
      }
    }

    await db.deleteFrom("posts").where("slug", "=", slug).execute();
    c.executionCtx.waitUntil(logAuditAction(c, "PURGE_POST", "posts", slug));
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Purge] Error", e);
    return c.json({ error: "Purge failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(approvePostRoute, typedHandler<typeof approvePostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const result = await approvePost(c, slug);
    if (!result.success) return c.json({ error: result.error || "Approval failed" } as any, 404 as any);
    return c.json({ success: true, warnings: result.warnings } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Approve] Error", e);
    return c.json({ error: "Approval failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(rejectPostRoute, typedHandler<typeof rejectPostRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const _body = c.req.valid("json");
  const { reason } = c.req.valid("json");
  try {
    const db = c.get("db") as any;
    const row = await db
      .selectFrom("posts")
      .select(["title", "cf_email"])
      .where("slug", "=", slug)
      .executeTakeFirst();

    await db
      .updateTable("posts")
      .set({ status: "rejected", updated_at: new Date().toISOString() })
      .where("slug", "=", slug)
      .execute();

    if (row?.cf_email) {
      const author = await db
        .selectFrom("user")
        .select("id")
        .where("email", "=", row.cf_email)
        .executeTakeFirst();
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
    return c.json({ success: true } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:Reject] Error", e);
    return c.json({ error: "Reject failed" } as any, 500 as any);
  }
}));

postsRouter.openapi(getPostHistoryRoute, typedHandler<typeof getPostHistoryRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  try {
    const historyRows = await getPostHistory(c, slug);
    const history = historyRows.map((h: any) => ({
      ...h,
      id: Number(h.id),
    }));
    return c.json({ history } as any, 200 as any);
  } catch (e) {
    console.error("[Posts:History] Error", e);
    return c.json({ error: "Failed to fetch history" } as any, 500 as any);
  }
}));

postsRouter.openapi(restorePostHistoryRoute, typedHandler<typeof restorePostHistoryRoute>(async (c) => {
  const { slug, id } = c.req.valid("param");
  const user = await getSessionUser(c);
  const result = await restorePostFromHistory(c, slug, String(id), user?.email || "anonymous_admin");
  if (!result.success) return c.json({ error: result.error || "Restore failed" } as any, 404 as any);
  return c.json({ success: true } as any, 200 as any);
}));

postsRouter.openapi(repushSocialsRoute, typedHandler<typeof repushSocialsRoute>(async (c) => {
  const { slug } = c.req.valid("param");
  const _body = c.req.valid("json");
  const { socials } = c.req.valid("json");
  try {
    const db = c.get("db") as any;
    const post = await db
      .selectFrom("posts")
      .select(["title", "snippet", "thumbnail"])
      .where("slug", "=", slug)
      .executeTakeFirst();
    if (!post) return c.json({ error: "Post not found" } as any, 404 as any);

    const socialConfig = await getSocialConfig(c);
    const baseUrl = new URL(c.req.url).origin;

    c.executionCtx.waitUntil(
      dispatchSocials(
        c.get("db") as any,
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
      ).catch((err: any) => console.error("[Repush] Social dispatch failed:", err))
    );
    return c.json({ success: true } as any, 200 as any);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return c.json({ error: message } as any, 502 as any);
  }
}));

export default postsRouter;
