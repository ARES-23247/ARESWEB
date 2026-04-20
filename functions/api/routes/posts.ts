import { Hono } from "hono";
import { Bindings, getSocialConfig, extractAstText, getSessionUser } from "./_shared";
import { dispatchSocials } from "../../utils/socialSync";

const postsRouter = new Hono<{ Bindings: Bindings }>();

// ── GET /posts — list all blog posts ─────────────────────────────────
postsRouter.get("/posts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, cf_email FROM posts WHERE is_deleted = 0 AND status = 'published' ORDER BY date DESC"
    ).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 list error:", err);
    return c.json({ posts: [] });
  }
});

// ── GET /posts/:slug — single blog post ──────────────────────────────
postsRouter.get("/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, ast FROM posts WHERE slug = ? AND is_deleted = 0 AND status = 'published'"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /admin/posts — list all blog posts (admin) ──────────────────────
postsRouter.get("/admin/posts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, cf_email, is_deleted, status, revision_of FROM posts ORDER BY date DESC"
    ).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (posts):", err);
    return c.json({ posts: [] });
  }
});

// ── GET /admin/posts/:slug — single blog post (admin) ─────────────────
postsRouter.get("/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, content, is_deleted, status, revision_of FROM posts WHERE slug = ?"
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

// ── POST /admin/posts — create a new blog post (admin) ────────────────
postsRouter.post("/admin/posts", async (c) => {
  try {
    const email = c.req.header("cf-access-authenticated-user-email");
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
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
    const status = body.isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

    await c.env.DB.prepare(
      `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        slug,
        body.title,
        body.author || "ARES Team",
        dateStr,
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        email || "anonymous_dashboard_user",
        status
      )
      .run();

    // ── Phase 3: Omnichannel Social Media Integration ──
    try {
      const socialConfig = await getSocialConfig(c);
      const socialsFilter = (body as { socials?: Record<string, boolean> }).socials || null;

      try {
        await dispatchSocials({
           title: body.title,
           url: `https://aresfirst.org/blog/${slug}`,
           snippet: snippet || "Read the latest engineering update from ARES 23247!",
           coverImageUrl: body.coverImageUrl || "/gallery_1.png",
           baseUrl: new URL(c.req.url).origin
        }, socialConfig, socialsFilter);
      } catch (err: unknown) {
        console.error("Social dispatch returned top-level rejection:", err);
        return c.json({ success: true, slug, warning: `Network Syndication Failed: ${(err as Error)?.message || String(err)}` }, 207);
      }
    } catch(err) {
      console.error("Critical Social Dispatch Failure:", err);
    }

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

// ── PUT /admin/posts/:slug — edit a blog post (admin) ────────────────────
postsRouter.put("/admin/posts/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
      isDraft?: boolean;
    }>();

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    const astStr = JSON.stringify(body.ast);
    const snippet = buildSnippet(body.ast);

    const user = await getSessionUser(c);
    
    if (user?.role !== "admin") {
      // ── Shadow Revision Logic (Student Edits) ──
      const suffix = Math.random().toString(36).substring(2, 6);
      const revSlug = `${slug}-rev-${suffix}`;
      const dateStr = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "2-digit" });

      await c.env.DB.prepare(
        `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email, status, revision_of)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
      ).bind(
        revSlug,
        body.title,
        body.author || "ARES Team",
        dateStr,
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        user?.email || "anonymous_author",
        slug
      ).run();

      return c.json({ success: true, slug: revSlug });
    }

    // ── Direct Update Logic (Admin Edits) ──
    const status = body.isDraft ? "pending" : "published";
    await c.env.DB.prepare(
      `UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, status = ? WHERE slug = ?`
    )
      .bind(
        body.title,
        body.author || "ARES Team",
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        status,
        slug
      )
      .run();

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

// ── DELETE /admin/posts/:slug — soft-delete (admin) ──────────────────
postsRouter.delete("/admin/posts/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 1 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (posts):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /admin/posts/:slug/undelete — restore (admin) ───────────────
postsRouter.patch("/admin/posts/:slug/undelete", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 0 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (posts):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /admin/posts/:slug/purge — PERMANENTLY delete (admin) ──────
postsRouter.delete("/admin/posts/:slug/purge", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (posts):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── PATCH /admin/posts/:slug/approve — approve pending post (admin) ─────
postsRouter.patch("/admin/posts/:slug/approve", async (c) => {
  try {
    const user = await getSessionUser(c);
    if (user?.role !== "admin") return c.json({ error: "Unauthorized" }, 401);
    const slug = c.req.param("slug");
    
    type PostRow = { revision_of?: string; title: string; author: string; thumbnail: string; snippet: string; ast: string };
    const row = await c.env.DB.prepare(
      "SELECT revision_of, title, author, thumbnail, snippet, ast FROM posts WHERE slug = ?"
    ).bind(slug).first<PostRow>();

    if (row && row.revision_of) {
      // Merge shadow revision into original, then delete shadow
      await c.env.DB.prepare(
        "UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ?, status = 'published' WHERE slug = ?"
      ).bind(row.title, row.author || "ARES Team", row.thumbnail, row.snippet, row.ast, row.revision_of).run();
      await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
      return c.json({ success: true });
    }

    await c.env.DB.prepare("UPDATE posts SET status = 'published' WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 approve error (posts):", err);
    return c.json({ error: "Approval failed" }, 500);
  }
});

// ── POST /admin/posts/:slug/repush — manual social broadcast (admin) ──
postsRouter.post("/admin/posts/:slug/repush", async (c) => {
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
        url: `https://aresfirst.org/blog/${slug}`,
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

export default postsRouter;
