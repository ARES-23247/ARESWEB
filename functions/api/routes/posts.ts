import { Hono } from "hono";
import { sql, Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { postContract } from "../../../shared/schemas/contracts/postContract";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, getSocialConfig, extractAstText, getSessionUser, ensureAdmin, ensureAuth, validateLength, MAX_INPUT_LENGTHS, logAuditAction } from "../middleware";
import { getStandardDate } from "../../utils/content";
import { dispatchSocials } from "../../utils/socialSync";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../utils/notifications";
import { 
  approvePost, 
  getPostHistory, 
  restorePostFromHistory,
  createShadowRevision,
  captureHistory,
  pruneHistory
} from "../../utils/postHistory";

const s = initServer<AppEnv>();



const postTsRestRouterObj: any = {
  getPosts: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      const { limit = 10, offset = 0, q } = query;

      if (q) {
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
           AND f.posts_fts MATCH ${q}
           ORDER BY f.rank LIMIT ${limit} OFFSET ${offset}
        `.execute(db);
        
        const posts = results.rows.map(p => ({
          ...p,
          season_id: p.season_id ? Number(p.season_id) : null,
          is_deleted: 0,
          is_portfolio: 0
        }));

        return { status: 200, body: { posts } };
      }

      const results = await db.selectFrom("posts")
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
          "u.image as author_avatar"
        ])
        .where("posts.is_deleted", "=", 0)
        .where("posts.status", "=", "published")
        .where((eb) => eb.or([
          eb("published_at", "is", null),
          eb("published_at", "<=", new Date().toISOString())
        ]))
        .orderBy("posts.date", "desc")
        .limit(Number(limit) || 10)
        .offset(Number(offset) || 0)
        .execute();

      const posts = results.map(p => ({
        ...p,
        season_id: p.season_id ? Number(p.season_id) : null,
        is_deleted: 0,
        is_portfolio: 0
      }));

      c.header("Cache-Control", "public, max-age=60, stale-while-revalidate=600");

      return { status: 200, body: { posts } };
    } catch (e) {
      console.error("[Posts:List] Error", e);
      return { status: 200, body: { posts: [] } }; // Graceful degradation
    }
  },
  getPost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const user = await getSessionUser(c);
      
      const row = await db.selectFrom("posts")
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
          "uP.nickname as author_nickname",
          "u.image as author_avatar"
        ])
        .where("posts.slug", "=", slug)
        .where("posts.is_deleted", "=", 0)
        .where("posts.status", "=", "published")
        .where((eb) => eb.or([
          eb("published_at", "is", null),
          eb("published_at", "<=", new Date().toISOString())
        ]))
        .executeTakeFirst();

      if (!row) return { status: 404, body: { error: "Post not found" } };

      return { 
        status: 200, 
        body: { 
          post: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: 0,
            is_portfolio: 0,
            ast: row.ast || "{}"
          },
          is_editor: user?.role === "admin" || user?.role === "author",
          author: {
            id: row.author || "system",
            name: row.author_nickname || null,
            image: row.author_avatar || null,
            role: "author"
          }
        }
      };
    } catch (e) {
      console.error("[Posts:Detail] Error", e);
      return { status: 404, body: { error: "Database error" } };
    }
  },
  getAdminPosts: async (input: any, c: any) => {
    try {
      const { query } = input;
      const db = c.get("db") as Kysely<DB>;
      const { limit = 50, offset = 0 } = query;
      
      let results;
      try {
        results = await db.selectFrom("posts")
          .select(["slug", "title", "date", "snippet", "thumbnail", "cf_email", "is_deleted", "status", "revision_of", "published_at", "season_id", "author"])
          .orderBy("date", "desc")
          .limit(Number(limit) || 50)
          .offset(Number(offset) || 0)
          .execute();
      } catch (_e) {
        // Fallback for older D1 schemas without status/published_at columns
        results = await db.selectFrom("posts")
          .select(["slug", "title", "date", "snippet", "thumbnail", "cf_email", "is_deleted", "author"])
          .orderBy("date", "desc")
          .limit(Number(limit) || 50)
          .offset(Number(offset) || 0)
          .execute();
      }
      
      const posts = results.map(p => ({
        ...p,
        season_id: (p as any).season_id ? Number((p as any).season_id) : null,
        is_deleted: Number(p.is_deleted),
        is_portfolio: 0
      }));

      return { status: 200, body: { posts } };
    } catch (e) {
      console.error("[Posts:AdminList] Error", e);
      return { status: 200, body: { posts: [] } };
    }
  },
  getAdminPost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("posts")
        .select(["slug", "title", "date", "snippet", "thumbnail", "ast", "is_deleted", "status", "revision_of", "published_at", "season_id", "author"])
        .where("slug", "=", slug)
        .executeTakeFirst();

      if (!row) return { status: 404, body: { error: "Post not found" } };
      
      return { 
        status: 200, 
        body: { 
          post: {
            ...row,
            season_id: row.season_id ? Number(row.season_id) : null,
            is_deleted: Number(row.is_deleted),
            is_portfolio: 0,
            ast: row.ast || "{}"
          }
        }
      };
    } catch (e) {
      console.error("[Posts:AdminDetail] Error", e);
      return { status: 404, body: { error: "Database error" } };
    }
  },
  savePost: async (input: any, c: any) => {
    try {
      const { body } = input;
      const db = c.get("db") as Kysely<DB>;

      if (body.slug) {
        // Redirect to updatePost
        return postTsRestRouterObj.updatePost({ params: { slug: body.slug }, body }, c);
      }

      const titleError = validateLength(body.title, MAX_INPUT_LENGTHS.title, "Title");
      if (titleError) return { status: 400, body: { error: titleError } };

      const user = await getSessionUser(c);
      const email = user?.email || "anonymous_dashboard_user";
      const dateStr = getStandardDate();

      const recent = await db.selectFrom("posts")
        .select("slug")
        .where("title", "=", body.title)
        .where("cf_email", "=", email)
        .where("date", "=", dateStr)
        .executeTakeFirst();
      
      if (recent) {
        return { status: 409, body: { error: "A post with this title already exists for today" } };
      }

      let slug = body.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const existing = await db.selectFrom("posts").select("slug").where("slug", "=", slug).executeTakeFirst();
      if (existing) {
        const suffix = Math.random().toString(36).substring(2, 6);
        slug = `${slug}-${suffix}`;
      }

      const astStr = JSON.stringify(body.ast);
      const snippet = extractAstText(body.ast).substring(0, 200);
      
      const status = body.isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

      await db.insertInto("posts")
        .values({
          slug,
          title: body.title,
          author: "ARES Team", 
          date: dateStr,
          thumbnail: body.coverImageUrl || "",
          snippet,
          ast: astStr,
          cf_email: email,
          status,
          published_at: body.publishedAt || null,
          season_id: body.seasonId ? Number(body.seasonId) : null
        })
        .execute();

      c.executionCtx.waitUntil(pruneHistory(c, slug, 10));
      c.executionCtx.waitUntil(logAuditAction(c, "CREATE_POST", "posts", slug, `Created post: ${body.title} (${status})`));

      const warnings: string[] = [];

      if (status === "published") {
        const socialConfig = await getSocialConfig(c);
        const socialsFilter = body.socials || null;
        const baseUrl = new URL(c.req.url).origin;

        c.executionCtx.waitUntil((async () => {
          try {
            await dispatchSocials(
              c.env.DB,
              {
                title: body.title,
                url: `${baseUrl}/blog/${slug}`,
                snippet: snippet || "Read the latest engineering update from ARES 23247!",
                thumbnail: body.coverImageUrl || "/gallery_1.png",
                baseUrl: baseUrl
              },
              socialConfig,
              socialsFilter
            );
          } catch (err) {
            console.error("Social dispatch failed:", err);
          }
        })());

        try {
          c.executionCtx.waitUntil(sendZulipMessage(
            socialConfig,
            "announcements",
            `Blog: ${body.title}`,
            `🚀 **New Blog Post Published:** [${body.title}](${siteConfig.urls.base}/blog/${slug})\n\n${snippet.substring(0, 300)}`
          ).catch(err => {
            console.error("[Posts] Zulip announcement failed:", err);
            warnings.push("Zulip Notification Failed");
          }));
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
          priority: "medium"
        });
        
        c.executionCtx.waitUntil(
          notifyPromise.catch(function handleNotifyError(e) {
            console.error("[Posts] notifyByRole error:", e);
          })
        );
      }

      return { 
        status: 200, 
        body: { success: true, slug, warning: warnings.join(" | ") }
      };
    } catch (e) {
      console.error("[Posts:Save] Error", e);
      return { status: 500, body: { error: "Database write failed" } };
    }
  },
  updatePost: async (input: any, c: any) => {
    const { params, body } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      const astStr = JSON.stringify(body.ast);
      const snippet = extractAstText(body.ast).substring(0, 200);
      const user = await getSessionUser(c);
      
      if (user?.role !== "admin") {
        const revSlug = await createShadowRevision(c, slug, user!, {
          title: body.title,
          author: "ARES Team",
          thumbnail: body.coverImageUrl,
          snippet,
          astStr,
          publishedAt: body.publishedAt,
          seasonId: body.seasonId
        });
        return { status: 200, body: { success: true, slug: revSlug } };
      }

      const status = body.isDraft ? "pending" : "published";
      
      const current = await db.selectFrom("posts")
        .select(["title", "author", "thumbnail", "snippet", "ast", "cf_email", "season_id"])
        .where("slug", "=", slug)
        .executeTakeFirst();
      
      if (current) {
        // @ts-expect-error -- manual casting for history
        await captureHistory(c, slug, current);
      }

      await db.updateTable("posts")
        .set({
          title: body.title,
          thumbnail: body.coverImageUrl || "",
          snippet,
          ast: astStr,
          status,
          published_at: body.publishedAt || null,
          season_id: body.seasonId ? Number(body.seasonId) : null
        })
        .where("slug", "=", slug)
        .execute();

      c.executionCtx.waitUntil(logAuditAction(c, "UPDATE_POST", "posts", slug, `Updated post: ${body.title} (${status})`));
      return { status: 200, body: { success: true, slug } };
    } catch (e) {
      console.error("[Posts:Update] Error", e);
      return { status: 500, body: { error: "Database write failed" } };
    }
  },
  deletePost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("posts").set({ is_deleted: 1, status: "draft" }).where("slug", "=", slug).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "DELETE_POST", "posts", slug));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Delete] Error", e);
      return { status: 500, body: { error: "Delete failed" } };
    }
  },
  undeletePost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("posts").set({ is_deleted: 0, status: "draft" }).where("slug", "=", slug).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "RESTORE_POST", "posts", slug));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Undelete] Error", e);
      return { status: 500, body: { error: "Undelete failed" } };
    }
  },
  purgePost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
      
      const post = await db.selectFrom("posts")
        .select("thumbnail")
        .where("slug", "=", slug)
        .executeTakeFirst();
      
      if (post?.thumbnail && c.env.ARES_STORAGE) {
        try {
          const url = new URL(post.thumbnail);
          const key = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
          c.executionCtx.waitUntil(c.env.ARES_STORAGE.delete(key));
        } catch (e) {
          console.error("[Posts] Failed to parse/delete thumbnail:", e);
        }
      }

      await db.deleteFrom("posts").where("slug", "=", slug).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "PURGE_POST", "posts", slug));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Purge] Error", e);
      return { status: 500, body: { error: "Purge failed" } };
    }
  },
  approvePost: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const result = await approvePost(c, slug);
      if (!result.success) return { status: 404, body: { error: result.error || "Approval failed" } };
      return { status: 200, body: { success: true, warnings: result.warnings } };
    } catch (e) {
      console.error("[Posts:Approve] Error", e);
      return { status: 500, body: { error: "Approval failed" } };
    }
  },
  rejectPost: async (input: any, c: any) => {
    const { params, body } = input;
    const { slug } = params;
    const { reason } = body;
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("posts").select(["title", "cf_email"]).where("slug", "=", slug).executeTakeFirst();
      
      await db.updateTable("posts").set({ status: "rejected" }).where("slug", "=", slug).execute();

      if (row?.cf_email) {
        const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
        if (author) {
          c.executionCtx.waitUntil(emitNotification(c, {
            userId: String(author.id),
            title: "Post Rejected",
            message: `Your post "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`,
            link: "/dashboard/manage_blog",
            priority: "high"
          }));
        }
      }
      c.executionCtx.waitUntil(logAuditAction(c, "REJECT_POST", "posts", slug));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Posts:Reject] Error", e);
      return { status: 500, body: { error: "Reject failed" } };
    }
  },
  getPostHistory: async (input: any, c: any) => {
    const { params } = input;
    const { slug } = params;
    try {
      const historyRows = await getPostHistory(c, slug);
      const history = historyRows.map(h => ({
        ...h,
        id: Number(h.id)
      }));
      return { status: 200, body: { history } };
    } catch (e) {
      console.error("[Posts:History] Error", e);
      return { status: 500, body: { error: "Failed to fetch history" } };
    }
  },
  restorePostHistory: async (input: any, c: any) => {
    const { params } = input;
    const { slug, id } = params;
    const user = await getSessionUser(c);
    const result = await restorePostFromHistory(c, slug, String(id), user?.email || "anonymous_admin");
    if (!result.success) return { status: 404, body: { error: result.error || "Restore failed" } };
    return { status: 200, body: { success: true } };
  },
  repushSocials: async (input: any, c: any) => {
    const { params, body } = input;
    const { slug } = params;
    const { socials } = body;
    try {
      const db = c.get("db") as Kysely<DB>;
      const post = await db.selectFrom("posts").select(["title", "snippet", "thumbnail"]).where("slug", "=", slug).executeTakeFirst();
      if (!post) return { status: 404, body: { error: "Post not found" } };

      const socialConfig = await getSocialConfig(c);
      const baseUrl = new URL(c.req.url).origin;
      
      c.executionCtx.waitUntil(
        dispatchSocials(
          c.env.DB,
          {
            title: String(post.title),
            url: `${baseUrl}/blog/${slug}`,
            snippet: post.snippet || "Read the latest update from ARES 23247!",
            thumbnail: post.thumbnail || "",
            baseUrl: baseUrl
          }, socialConfig, socials).catch(err => console.error("[Repush] Social dispatch failed:", err))
      );
      return { status: 200, body: { success: true } };
    } catch (err) {
      return { status: 502, body: { error: (err as Error).message } };
    }
  },
};

const postTsRestRouter = s.router(postContract, postTsRestRouterObj);

export const postsRouter = new Hono<AppEnv>();

// Apply middleware/protections
postsRouter.use("/admin/:slug/history", ensureAuth);
postsRouter.use("/admin/:slug/history/*", ensureAuth);
postsRouter.use("/admin/*", ensureAdmin);

createHonoEndpoints(postContract, postTsRestRouter, postsRouter);

export default postsRouter;
