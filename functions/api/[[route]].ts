import { Hono } from "hono";
import { handle } from "hono/cloudflare-pages";

type Bindings = {
  DB: D1Database;
  ARES_STORAGE: R2Bucket;
  AI: any;
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
      const rawText = extractText(body.ast as ASTNode);
      if (rawText) {
        try {
          if (c.env.AI) {
            const aiResponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
              messages: [
                { role: "system", content: "You are an expert SEO assistant. Summarize the provided blog text into an engaging, keyword-optimized meta-description of exactly 1-2 sentences. Max 150 chars. Return only the summary text without quotes." },
                { role: "user", content: rawText.slice(0, 2000) }
              ]
            });
            snippet = (aiResponse as any).response?.trim() || rawText.slice(0, 200);
          } else {
            snippet = rawText.slice(0, 200);
          }
        } catch (aiErr) {
          console.error("AI summarization failed:", aiErr);
          snippet = rawText.slice(0, 200);
        }
      }
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
      const rawText = extractText(body.ast as ASTNode);
      if (rawText) {
        try {
          if (c.env.AI) {
            const aiResponse = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
              messages: [
                { role: "system", content: "You are an expert SEO assistant. Summarize the provided blog text into an engaging, keyword-optimized meta-description of exactly 1-2 sentences. Max 150 chars. Return only the summary text without quotes." },
                { role: "user", content: rawText.slice(0, 2000) }
              ]
            });
            snippet = (aiResponse as any).response?.trim() || rawText.slice(0, 200);
          } else {
            snippet = rawText.slice(0, 200);
          }
        } catch (aiErr) {
          console.error("AI summarization failed:", aiErr);
          snippet = rawText.slice(0, 200);
        }
      }
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

// ── File Upload via R2 & AI Image Accessibility Generation ───────────
app.post("/upload", async (c) => {
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

    // 1. Storage Upload
    const uploadTask = c.env.ARES_STORAGE.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    // 2. Automated AI Accessibility Tagging (LLava Vision)
    let altText = "ARES 23247 Team Media Image";
    try {
      if (c.env.AI) {
        const uint8 = [...new Uint8Array(arrayBuffer)];
        const aiResponse = await c.env.AI.run('@cf/llava-1.5-7b-hf', {
          prompt: 'Describe this image for screen readers in 1 sentence. Make it helpful, concise, and focused on robotics if applicable.',
          image: uint8
        });
        if ((aiResponse as any)?.description) {
          altText = String((aiResponse as any).description).trim();
        }
      }
    } catch (aiErr) {
      console.error("AI Vision generation failed, utilizing fallback alt text:", aiErr);
    }

    await uploadTask;

    return c.json({ success: true, url: `/api/media/${key}`, altText });
  } catch (err) {
    console.error("R2 upload error:", err);
    return c.json({ error: "Storage upload failed" }, 500);
  }
});

// ── Dynamic XML Sitemap Generation ─────────────────────────────────
app.get("/sitemap.xml", async (c) => {
  try {
    const { results: posts } = await c.env.DB.prepare(`SELECT slug, date FROM posts ORDER BY id DESC`).all();
    const { results: events } = await c.env.DB.prepare(`SELECT id, date FROM events ORDER BY id DESC`).all();

    const baseUrl = "https://ares23247.com";
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/events</loc>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/gallery</loc>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/accessibility</loc>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${baseUrl}/blog</loc>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>`;

    for (const post of (posts as any)) {
      xml += `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    // Dynamic rendering complete
    xml += `\n</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        "Cache-Control": "public, max-age=3600"
      }
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return new Response("Internal Server Error", { status: 500 });
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

// ── POST /api/events/sync — Google Calendar Sync (admin) ──────────────
app.post("/events/sync", async (c) => {
  const url = new URL(c.req.url);
  const email = c.req.header("cf-access-authenticated-user-email");
  if (!email && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }

  const CALENDAR_ID = "af2d297c3425adaeafc13ddd48a582056404cbf16a6156d3925bb8f3b4affaa0@group.calendar.google.com";
  const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;

  try {
    const icsResponse = await fetch(ICS_URL);
    if (!icsResponse.ok) throw new Error("Failed to fetch Google Calendar ICS");
    const icsText = await icsResponse.text();

    const parseICSDate = (icsDate: string) => {
      // Basic ics date conversion: "20240417T183459Z" -> ISO 8601
      if (!icsDate) return null;
      const clean = icsDate.replace(/[^0-9TZ]/g, "");
      if (clean.length === 8) { // YYYYMMDD
        return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T00:00:00Z`;
      }
      if (clean.length >= 15) {
        return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T${clean.substring(9,11)}:${clean.substring(11,13)}:${clean.substring(13,15)}Z`;
      }
      return null;
    };

    const extractField = (block: string, field: string) => {
      // match FIELD:value or FIELD;TZID=...:value
      const regex = new RegExp(`^${field}(?:;[^:]+)?:(.*)$`, "m");
      const match = block.match(regex);
      return match ? match[1].trim().replace(/\\,/g, ",").replace(/\\n/g, "\n") : null;
    };

    const blocks = icsText.split("BEGIN:VEVENT");
    blocks.shift(); // Remove header

    let newCount = 0;
    let upCount = 0;

    for (const block of blocks) {
      const uid = extractField(block, "UID");
      if (!uid) continue;

      const title = extractField(block, "SUMMARY") || "Untitled Event";
      const start = extractField(block, "DTSTART");
      const end = extractField(block, "DTEND");
      const location = extractField(block, "LOCATION") || "";
      const description = extractField(block, "DESCRIPTION") || "";

      const parsedStart = parseICSDate(start || "");
      const parsedEnd = parseICSDate(end || "");

      if (!parsedStart) continue;

      const existing = await c.env.DB.prepare("SELECT id FROM events WHERE gcal_event_id = ?").bind(uid).first();

      if (existing) {
        await c.env.DB.prepare(
          "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
        ).bind(title, parsedStart, parsedEnd, location, description, uid).run();
        upCount++;
      } else {
        const genId = crypto.randomUUID();
        await c.env.DB.prepare(
          "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
        ).bind(genId, title, parsedStart, parsedEnd, location, description, uid, email || "sync", null).run();
        newCount++;
      }
    }

    return c.json({ success: true, synced: newCount + upCount, newEvents: newCount, updatedEvents: upCount });
  } catch (err: unknown) {
    console.error("GCal sync error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Calendar sync failed" }, 500);
  }
});

export const onRequest = handle(app);
