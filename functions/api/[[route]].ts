import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";

type Bindings = {
  DB: D1Database;
  ARES_STORAGE: R2Bucket;
};

const app = new Hono<{ Bindings: Bindings }>().basePath("/api");

// ── Auth middleware for admin routes ──────────────────────────────────
app.use("/admin/*", async (c, next) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }
  await next();
});

// ── GET /api/posts — list all blog posts ─────────────────────────────
app.get("/posts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, cf_email FROM posts ORDER BY date DESC"
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

// ── GET /api/events — list all events ──────────────────────────────────
app.get("/events", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email FROM events ORDER BY date_start ASC"
    ).all();
    return c.json({ events: results ?? [] });
  } catch (err) {
    console.error("D1 list error (events):", err);
    return c.json({ events: [] });
  }
});

// ── GET /api/events/:id — single event ─────────────────────────────────
app.get("/events/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email FROM events WHERE id = ?"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── POST /api/events — create a new event (admin) ────────────────────
app.post("/events", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const { id, title, dateStart, dateEnd, location, description, coverImage } = await c.req.json();

    if (!id || !title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    await c.env.DB.prepare(
      "INSERT INTO events (id, title, date_start, date_end, location, description, cover_image, cf_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", email || "anonymous_dashboard_user")
      .run();

    return c.json({ success: true, id });
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error)?.message || "Event creation failed" }, 500);
  }
});

// ── POST /api/posts — create a new blog post (admin) ────────────────
app.post("/posts", async (c) => {
  // Validate host header to prevent Zero Trust bypass via .pages.dev
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

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
        email || "anonymous_dashboard_user"
      )
      .run();

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

// ── PUT /api/posts/:slug — edit a blog post (admin) ────────────────────
app.put("/posts/:slug", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const slug = c.req.param("slug");
    const body = await c.req.json<{
      title: string;
      author?: string;
      coverImageUrl?: string;
      ast: unknown;
    }>();

    if (!body.title) {
      return c.json({ success: false, error: "Title is required" }, 400);
    }
    const astStr = JSON.stringify(body.ast);

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
      `UPDATE posts SET title = ?, author = ?, thumbnail = ?, snippet = ?, ast = ? WHERE slug = ?`
    )
      .bind(
        body.title,
        body.author || "ARES Team",
        body.coverImageUrl || "/gallery_1.png",
        snippet,
        astStr,
        slug
      )
      .run();

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

// ── File Upload via R2 ───────────────────────────────────────────────
app.post("/upload", async (c) => {
  // Validate host header
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const key = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const arrayBuffer = await file.arrayBuffer();

    await c.env.ARES_STORAGE.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    return c.json({ success: true, url: `/api/media/${key}` });
  } catch (err) {
    console.error("R2 upload error:", err);
    return c.json({ error: "Storage upload failed" }, 500);
  }
});

// ── GET /api/media/:key — proxy R2 images ─────────────────────────────
app.get("/media/:key", async (c) => {
  const key = c.req.param("key");
  const object = await c.env.ARES_STORAGE.get(key);

  if (!object) {
    return c.text("Not found", 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set("etag", object.httpEtag);
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

// ── GET /api/media — list all R2 objects ──────────────────────────────
app.get("/media", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const key = c.req.param("key");
    await c.env.ARES_STORAGE.delete(key);
    return c.json({ success: true });
  } catch (err) {
    console.error("R2 delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── DELETE /api/events/:id — delete an event (admin) ────────────────────
app.delete("/events/:id", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 delete error (events):", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── DELETE /api/posts/:slug — delete a blog post (admin) ────────────────
app.delete("/posts/:slug", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 delete error (posts):", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── PUT /api/events/:id — edit an event (admin) ────────────────────────
app.put("/events/:id", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  try {
    const paramId = c.req.param("id");
    const { title, dateStart, dateEnd, location, description, coverImage } = await c.req.json();

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    await c.env.DB.prepare(
      `UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ? WHERE id = ?`
    )
      .bind(title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", paramId)
      .run();

    return c.json({ success: true, id: paramId });
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error)?.message || "Event update failed" }, 500);
  }
});

export const onRequest = handle(app);
