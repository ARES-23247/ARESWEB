import { Hono, Context, Next } from "hono";
import { handle } from "hono/cloudflare-pages";
import { pushEventToGcal, deleteEventFromGcal, pullEventsFromGcal } from "../utils/gcalSync";
import { dispatchSocials } from "../utils/socialSync";

type Bindings = {
  DB: D1Database;
  ARES_STORAGE: R2Bucket;
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  DISCORD_WEBHOOK_URL?: string;
  GCAL_SERVICE_ACCOUNT_EMAIL?: string;
  GCAL_PRIVATE_KEY?: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const apiRouter = new Hono<{ Bindings: Bindings }>();

// ── Zero Trust Auth Middleware ────────────────────────────────────────
const ensureAdmin = async (c: Context, next: Next) => {
  const url = new URL(c.req.url);

  // Block raw .pages.dev alias to prevent Zero Trust bypass via header spoofing
  if (url.hostname.endsWith(".pages.dev")) {
    return c.json({ error: "Strict Context: Direct invocation of .pages.dev alias is forbidden." }, 403);
  }

  const email = c.req.header("cf-access-authenticated-user-email");
  const jwt = c.req.header("cf-access-jwt-assertion");
  
  // Cloudflare occasionally strips Access headers on API subpaths, fallback to checking the JWT cookie
  const cookieHeader = c.req.header("cookie") || "";
  const hasAuthCookie = /CF_Authorization=/.test(cookieHeader);

  if (!email && !jwt && !hasAuthCookie && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    return c.json({ error: "Strict Context: Unauthorized. Cloudflare Zero Trust authentication required." }, 401);
  }
  await next();
};



// ── Auth middleware for admin routes ──────────────────────────────────
apiRouter.use("/admin/*", ensureAdmin);

// ── GET /api/auth-check — verify Zero Trust session (UI gate only) ───
// This endpoint lives OUTSIDE /admin/* intentionally. Cloudflare Access
// only injects cf-access-* headers for the exact path the Access Application
// protects (/dashboard), NOT subpaths like /dashboard/api/admin/auth-check.
// So we check headers AND the CF_Authorization cookie (set by Access after login)
// as a fallback. The real security boundary remains ensureAdmin for mutations.
apiRouter.get("/auth-check", async (c) => {
  const url = new URL(c.req.url);

  // Block .pages.dev alias
  if (url.hostname.endsWith(".pages.dev")) {
    return c.json({ authenticated: false }, 403);
  }

  // Localhost always passes
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return c.json({ authenticated: true, email: "local-dev@localhost" });
  }

  // Check Cloudflare Access injected headers (works when Access covers this path)
  const email = c.req.header("cf-access-authenticated-user-email");
  const jwt = c.req.header("cf-access-jwt-assertion");
  if (email || jwt) {
    return c.json({ authenticated: true, email: email || "authenticated-user" });
  }

  // Fallback: Check CF_Authorization cookie set by Cloudflare Access login flow.
  // This cookie is present for ANY path on the domain after Access authentication,
  // even if Cloudflare doesn't inject headers for this specific subpath.
  const cookieHeader = c.req.header("cookie") || "";
  const cfAuthMatch = cookieHeader.match(/CF_Authorization=([^;]+)/);
  if (cfAuthMatch && cfAuthMatch[1]) {
    return c.json({ authenticated: true, email: "authenticated-user" });
  }

  return c.json({ authenticated: false }, 401);
});

// ── GET /api/search — Global Platform Search ───────────────────────────
apiRouter.get("/search", async (c) => {
  try {
    const q = c.req.query("q") || "";
    if (q.length < 2) return c.json({ results: [] });

    // Perform a naive LIKE query across posts and events
    // In D1, we query both and merge.
    const wildcard = `%${q}%`;
    const [postsReq, eventsReq] = await Promise.all([
      c.env.DB.prepare(
        "SELECT 'blog' as type, slug as id, title, snippet as matched_text FROM posts WHERE title LIKE ? OR snippet LIKE ? LIMIT 5"
      ).bind(wildcard, wildcard).all(),
      c.env.DB.prepare(
        "SELECT 'event' as type, id, title, description as matched_text FROM events WHERE title LIKE ? OR description LIKE ? LIMIT 5"
      ).bind(wildcard, wildcard).all()
    ]);

    const results = [
      ...(postsReq.results || []),
      ...(eventsReq.results || [])
    ];
    
    return c.json({ results });
  } catch (err) {
    console.error("D1 search error:", err);
    return c.json({ results: [] }, 500);
  }
});

// ── GET /api/posts — list all blog posts ─────────────────────────────
apiRouter.get("/posts", async (c) => {
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
apiRouter.get("/posts/:slug", async (c) => {
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
apiRouter.get("/events", async (c) => {
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
apiRouter.get("/events/:id", async (c) => {
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
apiRouter.post("/admin/events", async (c) => {
  try {
    const { id, title, dateStart, dateEnd, location, description, coverImage } = await c.req.json();

    if (!id || !title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const email = c.req.header("cf-access-authenticated-user-email") || "anonymous_dashboard_user";

    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const calId = dbSettings["CALENDAR_ID"];

    let gcalId: string | undefined = undefined;
    if (gcalEmail && gcalKey && calId) {
      try {
        gcalId = await pushEventToGcal(
          { id, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage },
          { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        );
      } catch (err) {
        console.error("GCal create failed:", err);
      }
    }

    await c.env.DB.prepare(
      "INSERT INTO events (id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
      .bind(id, title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, email)
      .run();

    return c.json({ success: true, id });
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error)?.message || "Event creation failed" }, 500);
  }
});

// ── POST /api/posts — create a new blog post (admin) ────────────────
apiRouter.post("/admin/posts", async (c) => {
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
            snippet = (aiResponse as { response?: string }).response?.trim() || rawText.slice(0, 200);
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

    // ── Phase 3: Omnichannel Social Media Integration ──
    try {
      const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
      const dbSettings: Record<string, string> = {};
      for (const row of settingsRows as { key: string, value: string }[]) {
         dbSettings[row.key] = row.value;
      }

      const socialConfig = {
         DISCORD_WEBHOOK_URL: c.env.DISCORD_WEBHOOK_URL || dbSettings["DISCORD_WEBHOOK_URL"],
         MAKE_WEBHOOK_URL: dbSettings["MAKE_WEBHOOK_URL"],
         BLUESKY_HANDLE: dbSettings["BLUESKY_HANDLE"],
         BLUESKY_APP_PASSWORD: dbSettings["BLUESKY_APP_PASSWORD"],
         SLACK_WEBHOOK_URL: dbSettings["SLACK_WEBHOOK_URL"],
         TEAMS_WEBHOOK_URL: dbSettings["TEAMS_WEBHOOK_URL"],
         GCHAT_WEBHOOK_URL: dbSettings["GCHAT_WEBHOOK_URL"],
         FACEBOOK_PAGE_ID: dbSettings["FACEBOOK_PAGE_ID"],
         FACEBOOK_ACCESS_TOKEN: dbSettings["FACEBOOK_ACCESS_TOKEN"]
      };

      c.executionCtx.waitUntil(
         dispatchSocials({
           title: body.title,
           url: `https://ares23247.com/blog/${slug}`,
           snippet: snippet || "Read the latest engineering update from ARES 23247!",
           coverImageUrl: body.coverImageUrl || "/gallery_1.png"
         }, socialConfig).catch(err => console.error("Social dispatch returned top-level rejection:", err))
      );
    } catch(err) {
      console.error("Failed to fetch settings for social integration:", err);
    }

    return c.json({ success: true, slug });
  } catch (err: unknown) {
    console.error("D1 write error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Database write failed" }, 500);
  }
});

// ── PUT /api/posts/:slug — edit a blog post (admin) ────────────────────
apiRouter.put("/admin/posts/:slug", async (c) => {
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
            snippet = (aiResponse as { response?: string }).response?.trim() || rawText.slice(0, 200);
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
apiRouter.post("/admin/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body["file"] as File;
    const folder = (body["folder"] as string) || "Library";

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
        if ((aiResponse as { description?: string })?.description) {
          altText = String((aiResponse as { description?: string }).description).trim();
        }
      }
    } catch (aiErr) {
      console.error("AI Vision generation failed, utilizing fallback alt text:", aiErr);
    }

    await uploadTask;

    // 3. Register Logical Metadata
    try {
       await c.env.DB.prepare(
         `INSERT INTO media_tags (key, folder, tags) VALUES (?, ?, ?)`
       ).bind(key, folder, altText).run();
    } catch (e) {
       console.error("D1 registry warning, table might not exist in this environment:", e);
    }

    return c.json({ success: true, url: `/api/media/${key}`, key, folder, altText });
  } catch (err) {
    console.error("R2 upload error:", err);
    return c.json({ error: "Storage upload failed" }, 500);
  }
});

// ── Dynamic XML Sitemap Generation ─────────────────────────────────
apiRouter.get("/sitemap.xml", async (c) => {
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

    for (const post of (posts as { slug: string }[])) {
      xml += `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>`;
    }

    for (const event of (events as { id: string }[])) {
      xml += `
  <url>
    <loc>${baseUrl}/events/${event.id}</loc>
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
apiRouter.get("/media/:key", async (c) => {
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
apiRouter.get("/media", async (c) => {
  try {
    const [objects, dbRes] = await Promise.all([
      c.env.ARES_STORAGE.list(),
      c.env.DB.prepare("SELECT key, folder, tags FROM media_tags").all().catch(() => ({ results: [] }))
    ]);

    const metaMap = new Map();
    for (const row of dbRes.results as { key: string, folder: string, tags: string }[]) {
      metaMap.set(row.key, { folder: row.folder, tags: row.tags });
    }

    const merged = objects.objects.map(obj => ({
      ...obj,
      folder: metaMap.get(obj.key)?.folder || "Library",
      tags: metaMap.get(obj.key)?.tags || ""
    }));

    return c.json({ media: merged });
  } catch (err) {
    console.error("R2 list error:", err);
    return c.json({ error: "List failed", media: [] }, 500);
  }
});

// ── DELETE /api/media/:key — delete R2 object (admin) ─────────────────
apiRouter.delete("/admin/media/:key", ensureAdmin, async (c) => {
  try {
    const key = c.req.param("key") as string;
    await Promise.all([
      c.env.ARES_STORAGE.delete(key),
      c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(key).run().catch(() => {})
    ]);
    return c.json({ success: true });

  } catch (err) {
    console.error("R2 delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── POST /admin/media/syndicate — Cross-post Asset to Socials (admin) ─
apiRouter.post("/admin/media/syndicate", async (c) => {
  try {
    const { key, caption } = await c.req.json();
    if (!key || !caption) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    
    // Retrieve Configuration
    const { results } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const config: Record<string, string> = {};
    for (const row of results as { key: string, value: string }[]) {
      config[row.key] = row.value;
    }
    
    const imageUrl = `https://ares23247.com/api/media/${key}`;
    const { dispatchPhotoSocials } = await import("../utils/socialSync");
    
    // Offload the slow, heavily cryptographic dispatches to edge context background
    c.executionCtx.waitUntil(
      dispatchPhotoSocials(imageUrl, caption, config)
    );
    
    return c.json({ success: true, message: "Syndication dispatched to background worker" });
  } catch (err) {
    console.error("Syndicate dispatch error:", err);
    return c.json({ error: "Failed to dispatch syndication hook" }, 500);
  }
});

// ── GET /admin/settings — Get obscured settings (admin) ─────────────────
apiRouter.get("/admin/settings", async (c) => {
  try {
    const { results } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const settingsObj: Record<string, string> = {};
    for (const row of results as { key: string, value: string }[]) {
      if (row.value && row.value.trim() !== "") {
        settingsObj[row.key] = "••••••••••••••••";
      } else {
        settingsObj[row.key] = "";
      }
    }
    return c.json({ success: true, settings: settingsObj });
  } catch (err) {
    console.error("D1 get settings error:", err);
    return c.json({ error: "Failed to fetch settings" }, 500);
  }
});

// ── POST /admin/settings — Update settings (admin) ──────────────────────
apiRouter.post("/admin/settings", async (c) => {
  try {
    const body = await c.req.json();
    for (const [key, value] of Object.entries(body)) {
      // Never overwrite with dummy obfuscated strings
      if (value !== "••••••••••••••••") {
        await c.env.DB.prepare(
          "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=datetime('now')"
        ).bind(key, String(value)).run();
      }
    }
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 update settings error:", err);
    return c.json({ error: "Failed to update settings" }, 500);
  }
});

// ── DELETE /api/events/:id — delete an event (admin) ────────────────────
apiRouter.delete("/admin/events/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const calId = dbSettings["CALENDAR_ID"];
    
    // Attempt GCal deletion
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(id).first<{gcal_event_id: string}>();
      if (row && row.gcal_event_id) {
        c.executionCtx.waitUntil(
          deleteEventFromGcal(row.gcal_event_id, {
            email: gcalEmail,
            privateKey: gcalKey,
            calendarId: calId
          }).catch(err => console.error("GCal delete error:", err))
        );
      }
    }

    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 delete error (events):", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── DELETE /api/posts/:slug — delete a blog post (admin) ────────────────
apiRouter.delete("/admin/posts/:slug", async (c) => {
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
apiRouter.put("/admin/events/:id", async (c) => {
  try {
    const paramId = c.req.param("id");
    const { title, dateStart, dateEnd, location, description, coverImage } = await c.req.json();

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const calId = dbSettings["CALENDAR_ID"];

    // Attempt GCal update
    let gcalId: string | undefined = undefined;
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(paramId).first<{gcal_event_id: string}>();
      try {
        gcalId = await pushEventToGcal(
          { id: paramId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage, gcal_event_id: row?.gcal_event_id },
          { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        );
      } catch (err) {
        console.error("GCal PUT update error:", err);
      }
    }

    await c.env.DB.prepare(
      `UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, gcal_event_id = COALESCE(?, gcal_event_id) WHERE id = ?`
    )
      .bind(title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, paramId)
      .run();

    return c.json({ success: true, id: paramId });
  } catch (err: unknown) {
    console.error("D1 write error (events):", err);
    return c.json({ success: false, error: (err as Error)?.message || "Event update failed" }, 500);
  }
});

// ── POST /api/events/sync — Google Calendar Sync (admin) ──────────────
apiRouter.post("/admin/events/sync", async (c) => {

  try {
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const CALENDAR_ID = dbSettings["CALENDAR_ID"] || "af2d297c3425adaeafc13ddd48a582056404cbf16a6156d3925bb8f3b4affaa0@group.calendar.google.com";
    const ICS_URL = `https://calendar.google.com/calendar/ical/${encodeURIComponent(CALENDAR_ID)}/public/basic.ics`;
    const email = c.req.header("cf-access-authenticated-user-email") || "sync";

    let newCount = 0;
    let upCount = 0;

    // Use fast realtime REST API if Authenticated
    if (gcalEmail && gcalKey && CALENDAR_ID) {
      const events = await pullEventsFromGcal({
        email: gcalEmail,
        privateKey: gcalKey,
        calendarId: CALENDAR_ID
      });

      for (const ev of events) {
        const existing = await c.env.DB.prepare("SELECT id FROM events WHERE gcal_event_id = ?").bind(ev.gcal_event_id).first();
        if (existing) {
          await c.env.DB.prepare(
            "UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ? WHERE gcal_event_id = ?"
          ).bind(ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id).run();
          upCount++;
        } else {
          const genId = crypto.randomUUID();
          await c.env.DB.prepare(
            "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
          ).bind(genId, ev.title, ev.date_start, ev.date_end || null, ev.location, ev.description, ev.gcal_event_id, email, null).run();
          newCount++;
        }
      }
    } else {
      // Fallback: Public ICS polling
      const icsResponse = await fetch(ICS_URL);
      if (!icsResponse.ok) throw new Error("Failed to fetch Google Calendar ICS");
      const icsText = await icsResponse.text();

      const parseICSDate = (icsDate: string) => {
        if (!icsDate) return null;
        const clean = icsDate.replace(/[^0-9TZ]/g, "");
        if (clean.length === 8) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T00:00:00Z`;
        }
        if (clean.length >= 15) {
          return `${clean.substring(0,4)}-${clean.substring(4,6)}-${clean.substring(6,8)}T${clean.substring(9,11)}:${clean.substring(11,13)}:${clean.substring(13,15)}Z`;
        }
        return null;
      };

      const extractField = (block: string, field: string) => {
        const regex = new RegExp(`^${field}(?:;[^:]+)?:(.*)$`, "m");
        const match = block.match(regex);
        return match ? match[1].trim().replace(/\\,/g, ",").replace(/\\n/g, "\n") : null;
      };

      const blocks = icsText.split("BEGIN:VEVENT");
      blocks.shift();

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
          ).bind(genId, title, parsedStart, parsedEnd, location, description, uid, email, null).run();
          newCount++;
        }
      }
    }

    return c.json({ success: true, synced: newCount + upCount, newEvents: newCount, updatedEvents: upCount });
  } catch (err: unknown) {
    console.error("GCal sync error:", err);
    return c.json({ success: false, error: (err as Error)?.message || "Calendar sync failed" }, 500);
  }
});

// ── DOCUMENTATION SYSTEM ──────────────────────────────────────────────

// ── GET /api/docs — list all docs grouped by category ─────────────────
apiRouter.get("/docs", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, category, sort_order, description FROM docs ORDER BY category, sort_order ASC"
    ).all();
    return c.json({ docs: results ?? [] });
  } catch (err) {
    console.error("D1 docs list error:", err);
    return c.json({ docs: [] });
  }
});

// ── GET /api/docs/search?q=keyword — full-text search ─────────────────
apiRouter.get("/docs/search", async (c) => {
  const q = c.req.query("q");
  if (!q || q.length < 2) return c.json({ results: [] });
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, category, description, content FROM docs WHERE title LIKE ? OR content LIKE ? OR description LIKE ? ORDER BY category, sort_order ASC LIMIT 20"
    ).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();

    // Return snippets, not full content
    const mapped = (results ?? []).map((r: Record<string, unknown>) => {
      const content = String(r.content || "");
      const idx = content.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 80);
      const end = Math.min(content.length, idx + q.length + 80);
      return {
        slug: r.slug,
        title: r.title,
        category: r.category,
        description: r.description,
        snippet: idx >= 0 ? "..." + content.slice(start, end) + "..." : (r.description || ""),
      };
    });
    return c.json({ results: mapped });
  } catch (err) {
    console.error("D1 docs search error:", err);
    return c.json({ results: [] });
  }
});

// ── GET /api/docs/:slug — single doc page ─────────────────────────────
apiRouter.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, category, description, content, updated_at FROM docs WHERE slug = ?"
    ).bind(slug).first();
    if (!row) return c.json({ error: "Doc not found" }, 404);
    return c.json({ doc: row });
  } catch (err) {
    console.error("D1 doc read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── POST /api/admin/docs — create/update a doc (admin) ────────────────
apiRouter.post("/admin/docs", async (c) => {
  try {
    const { slug, title, category, sortOrder, description, content } = await c.req.json();
    if (!slug || !title || !category || !content) {
      return c.json({ error: "Missing required fields" }, 400);
    }
    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO docs (slug, title, category, sort_order, description, content, updated_at) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(slug, title, category, sortOrder || 0, description || "", content).run();
    return c.json({ success: true, slug });
  } catch (err) {
    console.error("D1 doc write error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── DELETE /api/admin/docs/:slug — delete a doc (admin) ───────────────
apiRouter.delete("/admin/docs/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM docs WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 doc delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── PATCH /api/admin/docs/:slug/sort — update doc sort_order ───────────────
apiRouter.patch("/admin/docs/:slug/sort", async (c) => {
  try {
    const slug = c.req.param("slug");
    const { sortOrder } = await c.req.json();
    if (typeof sortOrder !== 'number') {
      return c.json({ error: "Invalid sortOrder" }, 400);
    }
    await c.env.DB.prepare("UPDATE docs SET sort_order = ? WHERE slug = ?").bind(sortOrder, slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 doc sort update error:", err);
    return c.json({ error: "Sort update failed" }, 500);
  }
});

app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);

export default app;
