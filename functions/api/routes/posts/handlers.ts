import { getSessionUser, getDb, validateLength, MAX_INPUT_LENGTHS, logAuditAction, getSocialConfig, extractAstText, ApiError } from "../../middleware";
import { getStandardDate } from "../../../utils/content";
import { dispatchSocials } from "../../../utils/socialSync";
import { sendZulipMessage } from "../../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../../utils/notifications";
import { triggerBackgroundReindex } from "../ai/autoReindex";
import { approvePost, restorePostFromHistory, createShadowRevision, captureHistory, pruneHistory } from "../../../utils/postHistory";
import { eq, and, or, isNull, lte, desc, sql } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { siteConfig } from "../../../utils/site.config";
import { queryHelpers } from "@/db/query-helpers";
import type { HandlerInput, HonoContext, ApiResponse } from "@shared/types/api";
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
} from "../../../../shared/routes/posts";

// Type for documentHistory inserts (only fields we provide, id auto-increments)
interface DocumentHistoryInsert {
  roomId: string;
  content: string;
  createdBy: string;
}

/**
 * Sanitize FTS query to prevent SQL injection via SQLite FTS syntax.
 * Allows alphanumeric, spaces, hyphens, and periods. Uses proper FTS5 phrase search.
 * SECURITY: Limits query length to prevent abuse and ReDoS attacks.
 */
const sanitizeFtsQuery = (query: string): string => {
  // SECURITY: Limit query length to prevent abuse and ReDoS attacks
  if (query.length > 100) {
    throw new ApiError("Search query too long (max 100 characters)", 400);
  }

  const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
  if (!cleanQ) return "";

  // SECURITY: Proper FTS5 phrase search with escaped quotes
  return `"${cleanQ.replace(/"/g, '""')}*`;
};

type PostSaveBody = {
  slug?: string;
  title?: string;
  ast?: { type?: string; content?: unknown[]; attrs?: Record<string, unknown>; marks?: unknown[]; text?: string };
  content?: string;
  thumbnail?: string;
  category?: string;
  isPortfolio?: boolean;
  socials?: Record<string, boolean>;
  isDraft?: boolean;
  publishedAt?: string;
  seasonId?: number | string;
};

type RepushSocialsBody = {
  socials?: string[];
};

type RejectPostBody = {
  reason?: string;
};

/**
 * Posts Handler - Blog content CRUD operations
 *
 * Provides handlers for creating, reading, updating, and deleting blog posts.
 * Includes full-text search, revision history, and social media integration.
 *
 * @packageDocumentation
 */

export const postHandlers = {
  /**
   * Get published blog posts with optional full-text search
   *
   * @query q - Full-text search query (searches title, snippet, author)
   * @query limit - Maximum number of posts to return (default: 10)
   * @query offset - Number of posts to skip for pagination (default: 0)
   * @returns Paginated list of published posts with author details
   */
  getPosts: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof getPostsRoute>> => {
    try {
      const { query } = input;
      const { limit = 10, offset = 0, q } = query;
      const db = getDb(c);

      if (q) {
        const cleanQ = sanitizeFtsQuery(String(q || ""));
        if (!cleanQ) {
          return { status: 200 as const, body: { posts: [] } };
        }

        const results = await db.run(sql<{
          slug: string;
          title: string;
          date: string | null;
          snippet: string | null;
          thumbnail: string | null;
          status: string;
          seasonId: number | null;
          author: string | null;
          authorNickname: string | null;
          authorAvatar: string | null;
          publishedAt: string | null;
        }>`
          SELECT p.slug, p.title, p.date, p.snippet, p.thumbnail, p.status, p.seasonId, p.author,
                  p.cf_email as cfEmail, p.is_portfolio as isPortfolio, p.zulip_stream as zulipStream, p.zulip_topic as zulipTopic,
                  uP.nickname as authorNickname, u.image as authorAvatar, p.publishedAt
           FROM posts_fts f
           JOIN posts p ON f.slug = p.slug
           LEFT JOIN user u ON p.cf_email = u.email
           LEFT JOIN user_profiles uP ON u.id = uP.user_id
           WHERE p.is_deleted = 0 AND p.status = 'published' AND (p.publishedAt IS NULL OR datetime(p.publishedAt) <= datetime('now'))
           AND f.posts_fts MATCH '${cleanQ.replace(/'/g, "''")}'
           ORDER BY f.rank LIMIT ${Number(limit) || 10} OFFSET ${Number(offset) || 0}
        `);

        type FtsPostRow = {
          slug: string;
          title: string;
          date: string | null;
          snippet: string | null;
          thumbnail: string | null;
          status: string;
          seasonId: number | null;
          author: string | null;
          authorNickname: string | null;
          authorAvatar: string | null;
          publishedAt: string | null;
          cfEmail: string | null;
          isPortfolio: number | null;
          zulipStream: string | null;
          zulipTopic: string | null;
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
          authorNickname: p.authorNickname,
          authorAvatar: p.authorAvatar,
          publishedAt: p.publishedAt,
          seasonId: p.seasonId ? Number(p.seasonId) : null,
          isDeleted: 0,
          cfEmail: p.cfEmail,
          isPortfolio: p.isPortfolio ? 1 : 0,
          zulipStream: p.zulipStream,
          zulipTopic: p.zulipTopic,
        }));

        return { status: 200 as const, body: { posts } };
      }

      // Use query helper for posts with authors
      const results = await queryHelpers.getPostsWithAuthors(db, Number(limit) || 10, Number(offset) || 0);

      // Filter for published posts that should be visible
      const now = new Date().toISOString();
      const posts = results
        .filter((p) => {
          const publishDate = p.publishedAt;
          return !publishDate || publishDate <= now;
        })
        .map((p) => ({
          slug: p.slug,
          title: p.title,
          date: p.date,
          snippet: p.snippet,
          thumbnail: p.thumbnail,
          status: p.status,
          author: p.author,
          authorNickname: p.authorNickname,
          authorAvatar: p.authorAvatar,
          publishedAt: p.publishedAt,
          seasonId: p.seasonId ? Number(p.seasonId) : null,
          isDeleted: 0,
          cfEmail: p.cfEmail,
          isPortfolio: p.isPortfolio ? 1 : 0,
          zulipStream: p.zulipStream,
          zulipTopic: p.zulipTopic,
        }));

      return { status: 200 as const, body: { posts } };
    } catch (e) {
      console.error("[Posts:List] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch posts" } };
    }
  },

  /**
   * Get a single published blog post by slug
   *
   * @param slug - Unique post identifier
   * @returns Full post details including AST content and author info
   */
  getPost: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof getPostRoute>> => {
    try {
      const { params } = input;
      const { slug } = params;
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
          seasonId: schema.posts.seasonId,
          publishedAt: schema.posts.publishedAt,
          cfEmail: schema.posts.cfEmail,
          isPortfolio: schema.posts.isPortfolio,
          zulipStream: schema.posts.zulipStream,
          zulipTopic: schema.posts.zulipTopic,
          authorNickname: schema.userProfiles.nickname,
          authorAvatar: schema.user.image,
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

      if (!row) return { status: 404 as const, body: { error: "Post not found" } };

      return {
        status: 200 as const,
        body: {
          post: {
            slug: row.slug,
            title: row.title,
            date: row.date,
            snippet: null,
            thumbnail: row.thumbnail,
            status: row.status,
            author: row.author,
            cfEmail: row.cfEmail ?? null,
            authorNickname: row.authorNickname,
            authorAvatar: row.authorAvatar,
            publishedAt: row.publishedAt,
            seasonId: row.seasonId ? Number(row.seasonId) : null,
            isDeleted: 0,
            isPortfolio: 0,
            zulipStream: row.zulipStream,
            zulipTopic: row.zulipTopic,
            ast: row.ast || "{}",
          },
          is_editor: user?.role === "admin" || user?.role === "author",
          author: {
            id: row.author || "system",
            name: row.authorNickname || null,
            image: row.authorAvatar || null,
            role: "author",
          },
        },
      };
    } catch (e) {
      console.error("[Posts:Detail] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch post" } };
    }
  },

  /**
   * Get all posts (admin view) including drafts and deleted
   *
   * @query limit - Maximum number of posts to return (default: 50)
   * @query offset - Number of posts to skip for pagination (default: 0)
   * @returns List of all posts regardless of status
   * @requires Admin or Author role
   */
  getAdminPosts: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof getAdminPostsRoute>> => {
    try {
      const { query } = input;
      const { limit = 50, offset = 0 } = query;
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
            isDeleted: schema.posts.isDeleted,
            status: schema.posts.status,
            revision_of: schema.posts.revisionOf,
            publishedAt: schema.posts.publishedAt,
            seasonId: schema.posts.seasonId,
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
            isDeleted: schema.posts.isDeleted,
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
        const hasSeasonId = "seasonId" in p;
        const hasPublishedAt = "publishedAt" in p;
        const hasStatus = "status" in p;
        return {
          slug: p.slug,
          title: p.title,
          date: p.date,
          snippet: p.snippet,
          thumbnail: p.thumbnail,
          status: hasStatus && p.status ? (p.status as string) : null,
          author: p.author ?? null,
          cfEmail: p.cf_email ?? null,
          authorNickname: null,
          authorAvatar: null,
          publishedAt: hasPublishedAt ? (p.publishedAt as string | null | undefined) ?? null : null,
          seasonId: hasSeasonId && p.seasonId ? Number(p.seasonId as number | string) : null,
          isDeleted: Number(p.isDeleted ?? 0),
          isPortfolio: 0,
          zulipStream: null,
          zulipTopic: null,
        };
      });

      return { status: 200 as const, body: { posts } };
    } catch (e) {
      console.error("[Posts:AdminList] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch admin posts" } };
    }
  },

  /**
   * Get a single post for admin editing
   *
   * @param slug - Unique post identifier
   * @returns Full post details with AST content for editing
   * @requires Admin or Author role
   */
  getAdminPost: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof getAdminPostRoute>> => {
    try {
      const { params } = input;
      const { slug } = params;
      const db = getDb(c);
      const row = await db
        .select({
          slug: schema.posts.slug,
          title: schema.posts.title,
          date: schema.posts.date,
          snippet: schema.posts.snippet,
          thumbnail: schema.posts.thumbnail,
          ast: schema.posts.ast,
          isDeleted: schema.posts.isDeleted,
          status: schema.posts.status,
          revision_of: schema.posts.revisionOf,
          publishedAt: schema.posts.publishedAt,
          seasonId: schema.posts.seasonId,
          author: schema.posts.author,
          cfEmail: schema.posts.cfEmail,
          zulipStream: schema.posts.zulipStream,
          zulipTopic: schema.posts.zulipTopic,
        })
        .from(schema.posts)
        .where(eq(schema.posts.slug, slug))
        .limit(1)
        .get();

      if (!row) return { status: 404 as const, body: { error: "Post not found" } };

      return {
        status: 200 as const,
        body: {
          post: {
            slug: row.slug,
            title: row.title,
            date: row.date,
            snippet: row.snippet ?? null,
            thumbnail: row.thumbnail ?? null,
            status: row.status ?? null,
            author: row.author ?? null,
            cfEmail: row.cfEmail ?? null,
            authorNickname: null,
            authorAvatar: null,
            publishedAt: row.publishedAt ?? null,
            seasonId: row.seasonId ? Number(row.seasonId) : null,
            isDeleted: Number(row.isDeleted),
            isPortfolio: 0,
            zulipStream: row.zulipStream ?? null,
            zulipTopic: row.zulipTopic ?? null,
            ast: row.ast || "{}",
          },
        },
      };
    } catch (e) {
      console.error("[Posts:AdminDetail] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch post" } };
    }
  },

  /**
   * Create or update a blog post
   *
   * Creates a new post if slug is not provided. Updates existing post if slug is provided.
   * Non-admin users create pending review posts. Admins can publish directly.
   *
   * @body title - Post title (required for new posts)
   * @body slug - Unique identifier (required for updates)
   * @body ast - Tiptap editor JSON AST
   * @body content - Plain text content
   * @body thumbnail - Cover image URL
   * @body category - Post category for organization
   * @body isPortfolio - Mark as portfolio-worthy
   * @body socials - Object mapping social platforms to booleans
   * @body isDraft - Save as draft instead of publishing
   * @body publishedAt - Scheduled publish date (ISO string)
   * @body seasonId - Associated season ID
   * @returns Success status with slug and optional warnings
   * @requires Admin or Author role
   */
  savePost: async (input: HandlerInput<PostSaveBody>, c: HonoContext) => {
    try {
      const { body } = input;
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
          return { status: 404 as const, body: { error: "Post not found" } };
        }


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

        return { status: 200 as const, body: { success: true, slug: body.slug } };
      }

      const titleError = validateLength(body.title || "", MAX_INPUT_LENGTHS.title, "Title");
      if (titleError) return { status: 400 as const, body: { error: titleError } };

      const user = await getSessionUser(c);
      const email = user?.email || "anonymous_dashboard_user";
      const dateStr = getStandardDate();

      const recent = await db
        .select({ slug: schema.posts.slug })
        .from(schema.posts)
        .where(and(
          eq(schema.posts.title, body.title || ""),
          eq(schema.posts.cfEmail, email),
          eq(schema.posts.date, dateStr)
        ))
        .limit(1)
        .get();

      if (recent) {
        return { status: 409 as const, body: { error: "A post with this title already exists for today" } };
      }

      let slug = (body.title || "")
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
      const snippet = extractAstText(body.ast || {}).substring(0, 200);

      const status = body.isDraft ? "pending" : user?.role === "admin" ? "published" : "pending";

      await db
        .insert(schema.posts)
        .values({
          slug,
          title: body.title || "",
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
          } as DocumentHistoryInsert)
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
                  title: body.title || "",
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
      return { status: 200 as const, body: { success: true, slug, warning } };
    } catch (e) {
      console.error("[Posts:Save] Error", e);
      const errorMessage = e instanceof Error ? e.message : "Save failed";
      return { status: 500 as const, body: { error: errorMessage } };
    }
  },

  /**
   * Update an existing blog post
   *
   * Non-admin changes create shadow revisions for review. Admin updates apply directly.
   * History is captured before each update.
   *
   * @param slug - Unique post identifier to update
   * @body title - Updated post title
   * @body ast - Updated Tiptap editor JSON AST
   * @body content - Updated plain text content
   * @body thumbnail - Updated cover image URL
   * @body isDraft - Save as draft
   * @body publishedAt - Updated scheduled publish date
   * @body seasonId - Updated season association
   * @returns Success status with post slug
   * @requires Admin or Author role
   */
  updatePost: async (input: HandlerInput<PostSaveBody>, c: HonoContext) => {
    try {
      const { params, body } = input;
      const { slug } = params;
      const db = getDb(c);
      const astStr = JSON.stringify(body.ast);
      const snippet = extractAstText(body.ast || {}).substring(0, 200);
      const user = await getSessionUser(c);

      if (user?.role !== "admin") {
        if (!user) {
          return { status: 401 as const, body: { error: "Unauthorized" } };
        }
        const revSlug = await createShadowRevision(c, slug, user, {
          title: body.title || "",
          author: "ARES Team",
          thumbnail: body.thumbnail || "",
          snippet,
          astStr,
          publishedAt: body.publishedAt,
          seasonId: body.seasonId,
        });
        return { status: 200 as const, body: { success: true, slug: revSlug } };
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
          seasonId: schema.posts.seasonId,
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
          seasonId: current.seasonId,
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
          } as DocumentHistoryInsert)
          .run()
      );

      c.executionCtx.waitUntil(
        logAuditAction(c, "UPDATE_POST", "posts", slug, `Updated post: ${body.title} (${status})`)
      );
      triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);

      return { status: 200 as const, body: { success: true, slug } };
    } catch (e) {
      console.error("[Posts:Update] Error", e);
      const errorMessage = e instanceof Error ? e.message : "Update failed";
      return { status: 500 as const, body: { error: errorMessage } };
    }
  },

  /**
   * Soft-delete a blog post
   *
   * Sets is_deleted=1 and status='draft'. Post remains recoverable.
   *
   * @param slug - Unique post identifier to delete
   * @returns Success status
   * @requires Admin or Author role
   */
  deletePost: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof deletePostRoute>> => {
    try {
      const { params } = input;
      const { slug } = params;
      const db = getDb(c);
      await db
        .update(schema.posts)
        .set({ isDeleted: 1, status: "draft", updatedAt: new Date().toISOString() })
        .where(eq(schema.posts.slug, slug))
        .run();
      c.executionCtx.waitUntil(logAuditAction(c, "DELETE_POST", "posts", slug));

      triggerBackgroundReindex(c.executionCtx, db, c.env.AI, c.env.VECTORIZE_DB);

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Delete] Error", e);
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },

  undeletePost: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof undeletePostRoute>> => {
    try {
      const { params } = input;
      const { slug } = params;
      const db = getDb(c);
      await db
        .update(schema.posts)
        .set({ isDeleted: 0, status: "draft", updatedAt: new Date().toISOString() })
        .where(eq(schema.posts.slug, slug))
        .run();
      c.executionCtx.waitUntil(logAuditAction(c, "RESTORE_POST", "posts", slug));

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Undelete] Error", e);
      return { status: 500 as const, body: { error: "Restore failed" } };
    }
  },

  purgePost: async (input: HandlerInput, c: HonoContext): Promise<ApiResponse<typeof purgePostRoute>> => {
    try {
      const { params } = input;
      const { slug } = params;
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

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Purge] Error", e);
      return { status: 500 as const, body: { error: "Purge failed" } };
    }
  },

  approvePost: async (input: HandlerInput, c: HonoContext) => {
    try {
      const { params } = input;
      const { slug } = params;
      const result = await approvePost(c, slug);
      if (!result.success) {
        return { status: 404 as const, body: { error: result.error || "Post not found" } };
      }

      return { status: 200 as const, body: { success: true, warnings: result.warnings } };
    } catch (e) {
      console.error("[Posts:Approve] Error", e);
      return { status: 500 as const, body: { error: "Approval failed" } };
    }
  },

  rejectPost: async (input: HandlerInput<RejectPostBody>, c: HonoContext) => {
    try {
      const { params, body } = input;
      const { slug } = params;
      const { reason } = body;
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

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Reject] Error", e);
      return { status: 500 as const, body: { error: "Rejection failed" } };
    }
  },

  getPostHistory: async (input: HandlerInput, c: HonoContext) => {
    try {
      const { params } = input;
      const { slug } = params;
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
          createdAt: schema.postsHistory.createdAt,
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
        createdAt: h.createdAt,
      }));

      return { status: 200 as const, body: { history } };
    } catch (e) {
      console.error("[Posts:GetHistory] Error", e);
      return { status: 500 as const, body: { error: "Failed to fetch history" } };
    }
  },

  restorePostHistory: async (input: HandlerInput, c: HonoContext) => {
    try {
      const { params } = input;
      const { slug, id } = params;
      const user = await getSessionUser(c);
      const result = await restorePostFromHistory(c, slug, String(id), user?.email || "anonymous_admin");

      if (!result.success) {
        return { status: 404 as const, body: { error: result.error || "History entry not found" } };
      }

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:RestoreHistory] Error", e);
      return { status: 500 as const, body: { error: "Restore failed" } };
    }
  },

  repushSocials: async (input: HandlerInput<RepushSocialsBody>, c: HonoContext) => {
    try {
      const { params, body } = input;
      const { slug } = params;
      const { socials } = body;
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

      if (!post) return { status: 404 as const, body: { error: "Post not found" } };

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

      return { status: 200 as const, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Repush] Error", e);
      return { status: 502 as const, body: { error: "Repush failed" } };
    }
  },
};
