import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

// ── Auth middleware for admin routes ──────────────────────────────────
app.use("/admin/*", async (c, next) => {
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email) {
    return c.json({ error: "Unauthorized — Cloudflare Access required" }, 401);
  }
  await next();
});

// ── GET /api/posts — list all blog posts ─────────────────────────────
app.get("/posts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail FROM posts ORDER BY date DESC"
    ).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 list error:", err);
    return c.json({ posts: [] });
  }
});

// ── GET /api/posts/:slug — single blog post ──────────────────────────
app.get("/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, ast FROM posts WHERE slug = ?"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── POST /api/posts — create a new blog post (admin) ────────────────
app.post("/posts", async (c) => {
  // Validate host header to prevent Zero Trust bypass via .pages.dev
  const host = c.req.header("host") || "";
  const allowedHosts = ["aresweb.pages.dev", "localhost"];
  const isAllowed = allowedHosts.some((h) => host.startsWith(h));
  if (!isAllowed) {
    return c.json({ error: "Forbidden host" }, 403);
  }

  const email = c.req.header("cf-access-authenticated-user-email") || "anonymous";

  try {
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
    }>();

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }

    const slug = body.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    const dateStr = new Date().toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "2-digit",
    });

    const astStr = JSON.stringify(body.ast);

    // Build a plain-text snippet from the AST for previews
    let snippet = "";
    try {
      type ASTNode = { text?: string; content?: ASTNode[] };
      const extractText = (node: ASTNode): string => {
        if (node.text) return node.text;
        if (node.content) return node.content.map(extractText).join(" ");
        return "";
      };
      snippet = extractText(body.ast as ASTNode).slice(0, 200);
    } catch {
      snippet = "";
    }

    await c.env.DB.prepare(
      `INSERT INTO posts (slug, title, author, date, thumbnail, snippet, ast, cf_email)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        slug,
        body.title,
        body.author || "ARES Team",
        dateStr,
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        email
      )
      .run();

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

export const onRequest = handle(app);
