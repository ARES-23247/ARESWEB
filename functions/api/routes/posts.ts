import { Context, Hono } from "hono";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, getSocialConfig, extractAstText, getSessionUser, ensureAdmin, ensureAuth, parsePagination, createContentLifecycleRouter, rateLimitMiddleware } from "../middleware";
import { dispatchSocials } from "../../utils/socialSync";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification, notifyByRole } from "../../utils/notifications";
import { 
  approvePost, 
  getPostHistory, 
  restorePostFromHistory,
  createShadowRevision
} from "../../utils/postHistory";


const postsRouter = new Hono<AppEnv>();

// ── GET /list — list all blog posts (admin) ──────────────────────
// Static route must be BEFORE /:slug
postsRouter.get("/list", ensureAdmin, async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 50, 200);
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, cf_email, is_deleted, status, revision_of, published_at FROM posts ORDER BY date DESC LIMIT ? OFFSET ?"
    ).bind(limit, offset).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (posts):", err);
    return c.json({ posts: [] });
  }
});

// ── GET /export-all — export all posts (admin) ───────────────────
postsRouter.get("/export-all", ensureAdmin, async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT slug, title, date, snippet, thumbnail, author, ast, is_deleted, status, revision_of, published_at, is_portfolio FROM posts").all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 export error (posts):", err);
    return c.json({ error: "Export failed" }, 500);
  }
});

// ── GET /posts — list all blog posts (public) ─────────────────────────────
postsRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 10, 100);
    const q = c.req.query("q") || "";

    if (q) {
      // FTS5 Search Route (Using JOIN rule for metadata)
      const { results } = await c.env.DB.prepare(
        `SELECT p.slug, p.title, p.date, p.snippet, p.thumbnail,
                uP.nickname as author_nickname, u.image as author_avatar
         FROM posts_fts f
         JOIN posts p ON f.slug = p.slug
         LEFT JOIN user u ON p.cf_email = u.email
         LEFT JOIN user_profiles uP ON u.id = uP.user_id
         WHERE p.is_deleted = 0 AND p.status = 'published' AND (p.published_at IS NULL OR datetime(p.published_at) <= datetime('now')) 
         AND f.posts_fts MATCH ?
         ORDER BY f.rank LIMIT ? OFFSET ?`
      ).bind(q, limit, offset).all();
      return c.json({ posts: results ?? [] });
    }

    // Standard Route
    const { results } = await c.env.DB.prepare(
      `SELECT p.slug, p.title, p.date, p.snippet, p.thumbnail,
              uP.nickname as author_nickname, u.image as author_avatar
       FROM posts p
       LEFT JOIN user u ON p.cf_email = u.email
       LEFT JOIN user_profiles uP ON u.id = uP.user_id
       WHERE p.is_deleted = 0 AND p.status = 'published' AND (p.published_at IS NULL OR datetime(p.published_at) <= datetime('now')) ORDER BY p.date DESC LIMIT ? OFFSET ?`
    ).bind(limit, offset).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 list error:", err);
    return c.json({ posts: [] });
  }
});

// ── GET /:slug/detail — single blog post (admin) ─────────────────
postsRouter.get("/:slug/detail", ensureAdmin, async (c) => {
  const slug = (c.req.param("slug") || "");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, ast, is_deleted, status, revision_of, published_at FROM posts WHERE slug = ?"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /:slug/history — list post history (admin) ─────────
postsRouter.get("/:slug/history", ensureAdmin, async (c) => {
  try {
    const slug = (c.req.param("slug") || "");
    const history = await getPostHistory(c, slug);
    return c.json({ history });
  } catch (err) {
    console.error("D1 post history error:", err);
    return c.json({ history: [] });
  }
});

// ── GET /:slug — single blog post (public) ───────────────────────────
postsRouter.get("/:slug", async (c) => {
  const slug = (c.req.param("slug") || "");
  try {
    const row = await c.env.DB.prepare(
      `SELECT p.slug, p.title, p.date, p.ast, p.thumbnail,
              uP.nickname as author_nickname, u.image as author_avatar
       FROM posts p
       LEFT JOIN user u ON p.cf_email = u.email
       LEFT JOIN user_profiles uP ON u.id = uP.user_id
       WHERE p.slug = ? AND p.is_deleted = 0 AND p.status = 'published' AND (p.published_at IS NULL OR datetime(p.published_at) <= datetime('now'))`
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});



// ── POST /save — create a new blog post (auth required) ────────────────
postsRouter.post("/save", ensureAuth, rateLimitMiddleware(15, 60), async (c) => {
  return handlePostSave(c);
});

async function handlePostSave(c: Context<AppEnv>) {
  try {
    let body;
    try {
      body = await c.req.json<{
        title: string;
        author?: string;
        coverImageUrl?: string;
        ast: unknown;
        isDraft?: boolean;
        publishedAt?: string;
      }>();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }

    let slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // ── Slug Collision Protection ──
    const existingSlug = await c.env.DB.prepare("SELECT slug FROM posts WHERE slug = ?").bind(slug).first();
    if (existingSlug) {
      const suffix = Math.random().toString(36).substring(2, 6);
      slug = `${slug}-${suffix}`;
    }

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(JSON.stringify(body.ast)).substring(0, 200);
    
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_dashboard_user";
    const status = body.isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email, status, published_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        slug,
        body.title,
        body.author || "ARES Team",
        dateStr,
        body.coverImageUrl || "",
        snippet,
        astStr,
        email,
        status,
        body.publishedAt || null
      ),
      c.env.DB.prepare(
        `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        email,
        "CREATE_POST",
        "posts",
        slug,
        `Created post: ${body.title} (${status})`
      )
    ]);

    // ── Phase 3: Omnichannel Social Media Integration ──
    if (status === "published") {
      const socialConfig = await getSocialConfig(c);
      const socialsFilter = (body as { socials?: Record<string, boolean> }).socials || null;
      const baseUrl = new URL(c.req.url).origin;

      c.executionCtx.waitUntil(
        dispatchSocials(
          c.env.DB,
          {
            title: body.title,
            url: `${baseUrl}/blog/${slug}`,
            snippet: snippet || "Read the latest engineering update from ARES 23247!",
            coverImageUrl: body.coverImageUrl || "/gallery_1.png",
            baseUrl: baseUrl
          },
          socialConfig,
          socialsFilter
        ).catch(err => console.error("Social dispatch failed:", err))
      );
    }

    // ── Zulip Announcement ──
    if (status === "published") {
      c.executionCtx.waitUntil(
        sendZulipMessage(
          c.env,
          "announcements",
          "Website Updates",
          `🚀 **New Blog Post Published:** [${body.title}](${siteConfig.urls.base}/blog/${slug})\n\n${snippet.substring(0, 300)}`
        ).catch(err => console.error("[Posts] Zulip announcement failed:", err))
      );
    }
    // ── Notify admins and mentors of pending content ──
    if (status === "pending") {
      c.executionCtx.waitUntil(
        notifyByRole(c, ["admin", "coach", "mentor"], {
          title: "📝 Pending Blog Post",
          message: `"${body.title}" submitted by ${email} needs review.`,
          link: "/dashboard",
          external: true,
          priority: "medium"
        }).catch(err => console.error("[Posts] Admin notification failed:", err))
      );
    }


    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
}

// ── PUT /:slug — edit a blog post (auth required) ────────────────────
postsRouter.put("/:slug", ensureAuth, rateLimitMiddleware(15, 60), async (c) => {
  return handlePostEdit(c);
});

async function handlePostEdit(c: Context<AppEnv>) {
  try {
    const slug = (c.req.param("slug") || "");
    let body;
    try {
      body = await c.req.json<{
        title: string;
        author?: string;
        coverImageUrl?: string;
        ast: unknown;
        isDraft?: boolean;
        publishedAt?: string;
      }>();
    } catch {
      return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
    }

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    const astStr = JSON.stringify(body.ast);
    const snippet = extractAstText(JSON.stringify(body.ast)).substring(0, 200);

    const user = await getSessionUser(c);
    
    if (user?.role !== "admin") {
      // ── Shadow Revision Logic (Student Edits) ── (GAP-03)
      const revSlug = await createShadowRevision(c, slug, user!, {
        title: body.title,
        author: body.author,
        coverImageUrl: body.coverImageUrl,
        snippet,
        astStr,
        publishedAt: body.publishedAt
      });

      return c.json({ success: true, slug: revSlug });
    }

    // ── Direct Update Logic (Admin Edits) ──
    const status = body.isDraft ? "pending" : "published";
    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, status = ?, published_at = ? WHERE slug = ?`
      ).bind(
        body.title,
        body.author || "ARES Team",
        body.coverImageUrl || "",
        snippet,
        astStr,
        status,
        body.publishedAt || null,
        slug
      ),
      c.env.DB.prepare(
        `INSERT INTO audit_log (id, actor, action, resource_type, resource_id, details, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
      ).bind(
        crypto.randomUUID(),
        user?.email || "unknown",
        "UPDATE_POST",
        "posts",
        slug,
        `Updated post: ${body.title} (${status})`
      )
    ]);

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
}

// ── Generic Lifecycle Operations ──────────────────────────────────
postsRouter.route("/", createContentLifecycleRouter("posts", {
  onApprove: async (c, slug) => {
    const result = await approvePost(c, slug);
    if (!result.success) throw new Error(result.error);
    return true; // We handled the DB update and notifications in approvePost
  },
  onReject: async (c, slug, reason) => {
    const row = await c.env.DB.prepare("SELECT title, cf_email FROM posts WHERE slug = ?").bind(slug).first<{ title: string, cf_email: string }>();
    if (row?.cf_email) {
      const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
      if (author) {
        c.executionCtx.waitUntil(emitNotification(c, {
          userId: author.id,
          title: "Post Rejected",
          message: `Your post "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`,
          link: "/dashboard?tab=posts",
          priority: "high"
        }));
      }
    }
  },
  onRestore: async (_c, _slug) => {
    // We don't want to break the standard `/undelete` functionality which is just setting is_deleted = 0
    // The history restore logic is separate on `/:slug/history/:id/restore`
  }
}, "slug"));

// ── POST /:slug/repush — manual social broadcast (admin) ──
postsRouter.post("/:slug/repush", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  const slug = (c.req.param("slug") || "");
  let json;
  try {
    json = await c.req.json<{ socials: Record<string, boolean> }>();
  } catch {
    return c.json({ error: "Invalid request payload (malformed JSON or FormData)" }, 400);
  }
  const { socials } = json;
  
  const post = await c.env.DB.prepare(
    "SELECT title, snippet, thumbnail FROM posts WHERE slug = ?"
  ).bind(slug).first<{ title: string, snippet: string, thumbnail: string }>();

  if (!post) return c.json({ error: "Post not found" }, 404);

  const socialConfig = await getSocialConfig(c);
  const baseUrl = new URL(c.req.url).origin;
  
  try {
    await dispatchSocials(
      c.env.DB,
      {
      title: post.title,
      url: `${baseUrl}/blog/${slug}`,
      snippet: extractAstText(post.snippet || "").substring(0, 250) || "Read the latest update from ARES 23247!",
      coverImageUrl: post.thumbnail || "",
      baseUrl: baseUrl
    }, socialConfig, socials);
  } catch (err: unknown) {
    console.error("Post repush failed:", err);
    return c.json({ error: `Network Repush Failed: ${(err as Error)?.message || String(err)}` }, 502);
  }

  return c.json({ success: true });
});

// ── PATCH /:slug/history/:id/restore — restore from history (admin) ──
postsRouter.patch("/:slug/history/:id/restore", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  const slug = (c.req.param("slug") || "");
  const id = (c.req.param("id") || "");
  const user = await getSessionUser(c);
  
  const result = await restorePostFromHistory(c, slug, id, user?.email || "anonymous_admin");
  if (!result.success) return c.json({ error: result.error }, 404);

  return c.json({ success: true });
});

export default postsRouter;
