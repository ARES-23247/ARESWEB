import { Context, Hono } from "hono";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, getSocialConfig, extractAstText, getSessionUser, ensureAdmin, ensureAuth, logAuditAction, parsePagination } from "./_shared";
import { dispatchSocials } from "../../utils/socialSync";
import { sendZulipMessage } from "../../utils/zulipSync";
import { emitNotification } from "../../utils/notifications";
import { 
  createShadowRevision, 
  approvePost, 
  getPostHistory, 
  restorePostFromHistory 
} from "../../utils/postHistory";


const postsRouter = new Hono<AppEnv>();

// ── GET /posts — list all blog posts ─────────────────────────────────
postsRouter.get("/", async (c) => {
  try {
    const { limit, offset } = parsePagination(c, 10, 100);
    const { results } = await c.env.DB.prepare(
      `SELECT p.slug, p.title, p.date, p.snippet, p.thumbnail, p.cf_email,
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

// ── GET /posts/:slug — single blog post ──────────────────────────────
postsRouter.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      `SELECT p.slug, p.title, p.date, p.ast, p.cf_email,
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

// ── GET /list — list all blog posts (admin) ──────────────────────
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

// ── GET /:slug/detail — single blog post (admin) ─────────────────
postsRouter.get("/:slug/detail", ensureAdmin, async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, content, is_deleted, status, revision_of, published_at FROM posts WHERE slug = ?"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── Shared snippet extraction helper ─────────────────────────────────
function buildSnippet(ast: unknown): string {
  try {
    type ASTNode = { text?: string; content?: ASTNode[] };
    const extractText = (node: ASTNode): string => {
      if (node.text) return node.text;
      if (node.content) return node.content.map(extractText).join(" ");
      return "";
    };
    const rawText = extractText(ast as ASTNode);
    if (rawText) {
      return rawText.length > 200 ? rawText.slice(0, 200).trim() + "..." : rawText.trim();
    }
  } catch { /* ignore */ }
  return "";
}

// ── POST /save — create a new blog post (auth required) ────────────────
postsRouter.post("/save", ensureAuth, async (c) => {
  return handlePostSave(c);
});

async function handlePostSave(c: Context<AppEnv>) {
  try {
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
      isDraft?: boolean;
      publishedAt?: string;
    }>();

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
    const snippet = buildSnippet(body.ast);
    
    const user = await getSessionUser(c);
    const email = user?.email || "anonymous_dashboard_user";
    const status = body.isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.prepare(
      `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email, status, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        slug,
        body.title,
        body.author || "ARES Team",
        dateStr,
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        email,
        status,
        body.publishedAt || null
      )
      .run();

    // ── Phase 3: Omnichannel Social Media Integration ──
    try {
      const socialConfig = await getSocialConfig(c);
      const socialsFilter = (body as { socials?: Record<string, boolean> }).socials || null;

      try {
        await dispatchSocials({
           title: body.title,
           url: `${new URL(c.req.url).origin}/blog/${slug}`,
           snippet: snippet || "Read the latest engineering update from ARES 23247!",
           coverImageUrl: body.coverImageUrl || "/gallery_1.png",
           baseUrl: new URL(c.req.url).origin
        }, socialConfig, socialsFilter);
      } catch (err: unknown) {
        console.error("Social dispatch returned top-level rejection:", err);
        return c.json({ success: true, slug, warning: `Network Syndication Failed: ${(err as Error)?.message || String(err)}` }, 207);
      }
    } catch(err: unknown) {
      console.error("Critical Social Dispatch Failure:", err);
    }

    // ── Zulip Announcement ──
    if (status === "published") {
      try {
        c.executionCtx.waitUntil(
          sendZulipMessage(
            c.env,
            "announcements",
            "Website Updates",
            `🚀 **New Blog Post Published:** [${body.title}](${siteConfig.urls.base}/blog/${slug})\n\n${snippet.substring(0, 300)}`
          ).catch(err => console.error("[Posts] Zulip announcement failed:", err))
        );
      } catch { /* ignore */ }
    }

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
}

// ── PUT /:slug — edit a blog post (auth required) ────────────────────
postsRouter.put("/:slug", ensureAuth, async (c) => {
  return handlePostEdit(c);
});

async function handlePostEdit(c: Context<AppEnv>) {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
      isDraft?: boolean;
      publishedAt?: string;
    }>();

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    const astStr = JSON.stringify(body.ast);
    const snippet = buildSnippet(body.ast);

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
    await c.env.DB.prepare(
      `UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, status = ?, published_at = ? WHERE slug = ?`
    )
      .bind(
        body.title,
        body.author || "ARES Team",
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        status,
        body.publishedAt || null,
        slug
      )
      .run();

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
}

// ── DELETE /:slug — soft-delete (admin) ──────────────────
postsRouter.delete("/:slug", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 1 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (posts):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /:slug/undelete — restore (admin) ───────────────
postsRouter.patch("/:slug/undelete", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 0 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (posts):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /:slug/purge — PERMANENTLY delete (admin) ──────
postsRouter.delete("/:slug/purge", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (posts):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── PATCH /:slug/approve — approve pending post (admin) ─────
postsRouter.patch("/:slug/approve", ensureAdmin, async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    
    const result = await approvePost(c, slug);
    if (!result.success) return c.json({ error: result.error }, 404);

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 approve error (posts):", err);
    return c.json({ error: "Approval failed" }, 500);
  }
});


// ── PATCH /:slug/reject — reject pending post (admin) ─────
postsRouter.patch("/:slug/reject", ensureAdmin, async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    const body = await c.req.json().catch(() => ({})) as { reason?: string };
    
    const row = await c.env.DB.prepare("SELECT title, cf_email FROM posts WHERE slug = ?").bind(slug).first<{ title: string, cf_email: string }>();
    
    await c.env.DB.prepare(
      "UPDATE posts SET status = 'rejected' WHERE slug = ?"
    ).bind(slug).run();

    if (row?.cf_email) {
      const author = await c.env.DB.prepare("SELECT id FROM user WHERE email = ?").bind(row.cf_email).first<{ id: string }>();
      if (author) {
        c.executionCtx.waitUntil(emitNotification(c, {
          userId: author.id,
          title: "Post Rejected",
          message: `Your post "${row.title}" was rejected${body.reason ? `: "${body.reason}"` : "."}`,
          link: "/dashboard?tab=posts",
          priority: "high"
        }));
      }
    }

    return c.json({ success: true, reason: body.reason || "No reason provided" });

  } catch (err) {
    console.error("D1 reject error (posts):", err);
    return c.json({ error: "Rejection failed" }, 500);
  }
});

// ── POST /:slug/repush — manual social broadcast (admin) ──
postsRouter.post("/:slug/repush", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    const { socials } = await c.req.json<{ socials: Record<string, boolean> }>();
    
    const post = await c.env.DB.prepare(
      "SELECT title, snippet, thumbnail FROM posts WHERE slug = ?"
    ).bind(slug).first<{ title: string, snippet: string, thumbnail: string }>();

    if (!post) return c.json({ error: "Post not found" }, 404);

    const socialConfig = await getSocialConfig(c);
    
    try {
      await dispatchSocials({
        title: post.title,
        url: `${new URL(c.req.url).origin}/blog/${slug}`,
        snippet: extractAstText(post.snippet || "").substring(0, 250) || "Read the latest update from ARES 23247!",
        coverImageUrl: post.thumbnail || "/gallery_1.png",
        baseUrl: new URL(c.req.url).origin
      }, socialConfig, socials);
    } catch (err: unknown) {
      console.error("Post repush failed:", err);
      return c.json({ error: `Network Repush Failed: ${(err as Error)?.message || String(err)}` }, 502);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Post repush error:", err);
    return c.json({ error: "Repush failed" }, 500);
  }
});

// ── GET /:slug/history — list post history (admin) ─────────
postsRouter.get("/:slug/history", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    const history = await getPostHistory(c, slug);
    return c.json({ history });
  } catch (err) {
    console.error("D1 post history error:", err);
    return c.json({ history: [] });
  }
});

// ── PATCH /:slug/history/:id/restore — restore from history (admin) ──
postsRouter.patch("/:slug/history/:id/restore", ensureAdmin, async (c) => {
  try {
    const slug = c.req.param("slug");
    const id = c.req.param("id");
    const user = await getSessionUser(c);
    
    const result = await restorePostFromHistory(c, slug, id, user?.email || "anonymous_admin");
    if (!result.success) return c.json({ error: result.error }, 404);

    return c.json({ success: true });
  } catch (err) {
    console.error("D1 post restore error:", err);
    return c.json({ error: "Restore failed" }, 500);
  }
});

export default postsRouter;
