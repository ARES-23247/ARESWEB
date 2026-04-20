import { Hono, Context, Next } from "hono";
import { handle } from "hono/cloudflare-pages";
import { pushEventToGcal, deleteEventFromGcal, pullEventsFromGcal, parseAstToText } from "../utils/gcalSync";
import { dispatchSocials } from "../utils/socialSync";
import { getAuth } from "../utils/auth";

type Bindings = {
  DB: D1Database;
  ARES_STORAGE: R2Bucket;
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  DISCORD_WEBHOOK_URL?: string;
  GCAL_SERVICE_ACCOUNT_EMAIL?: string;
  GCAL_PRIVATE_KEY?: string;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  ZULIP_CLIENT_ID: string;
  ZULIP_CLIENT_SECRET: string;
};

const app = new Hono<{ Bindings: Bindings }>();
const apiRouter = new Hono<{ Bindings: Bindings }>();

// ── Request Logger ────────────────────────────────────────────────────
app.use("*", async (c, next) => {
  console.log(`[${c.req.method}] ${c.req.url} (Path: ${c.req.path})`);
  await next();
});

// ── Better Auth Middleware ───────────────────────────────────────────
const ensureAdmin = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const url = new URL(c.req.url);
  
  // Local development bypass
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return await next();
  }

  const auth = getAuth(c.env.DB, c.env, c.req.url);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session || !session.user) {
    return c.json({ error: "Unauthorized: Please log in." }, 401);
  }

  // RBAC: Granular path-based role checks
  // @ts-expect-error - Better Auth additional fields
  const role = (session.user.role as string) || "user";

  // Authors can do everything EXCEPT manage users
  const isSuperAdminRoute = url.pathname.includes("/admin/users") || url.pathname.includes("/admin/roles");
  const allowedRoles = isSuperAdminRoute ? ["admin"] : ["admin", "author"];

  if (!allowedRoles.includes(role)) {
     console.warn(`[Auth Check] Access Denied for ${session.user.email}. Role: ${role}. Path: ${url.pathname}`);
     return c.json({ error: `Forbidden: Requires one of [${allowedRoles.join(", ")}] privileges.` }, 403);
  }

  await next();
};



// ── Better Auth Routes ────────────────────────────────────────────────
apiRouter.on(["POST", "GET"], "/auth/*", async (c) => {
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    return await auth.handler(c.req.raw);
  } catch (error: unknown) {
    const err = error as Error & { status?: number };
    console.error("[Auth Handler] Internal Exception:", err);
    return c.json({ 
      error: "Internal Server Error during Authentication", 
      message: err.message || String(error),
      stack: err.stack
    }, 500);
  }
});

// ── Auth middleware for admin routes ──────────────────────────────────
apiRouter.use("/admin/*", ensureAdmin);

// ── GET /api/auth-check — verify session (UI gate only) ────────────────
apiRouter.get("/auth-check", async (c) => {
  const url = new URL(c.req.url);

  // Localhost always passes
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return c.json({ authenticated: true, email: "local-dev@localhost", role: "admin" });
  }

  const auth = getAuth(c.env.DB, c.env, c.req.url);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (session && session.user) {
    return c.json({ 
      authenticated: true, 
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      // @ts-expect-error - Better Auth role type extension
      role: session.user.role 
    });
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
      "SELECT slug, title, date, snippet, thumbnail, cf_email FROM posts WHERE is_deleted = 0 ORDER BY date DESC"
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
      "SELECT slug, title, date, ast FROM posts WHERE slug = ? AND is_deleted = 0"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /api/calendar — public calendar configuration ──────────────────
apiRouter.get("/calendar", async (c) => {
  try {
    const row = await c.env.DB.prepare("SELECT value FROM settings WHERE key = 'CALENDAR_ID'").first<{value: string}>();
    return c.json({ calendarId: row?.value || "" });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /api/events — list all events ──────────────────────────────────
apiRouter.get("/events", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email FROM events WHERE is_deleted = 0 ORDER BY date_start ASC"
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
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email FROM events WHERE id = ? AND is_deleted = 0"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

function extractAstText(jsonStr: string | undefined | null): string {
  return parseAstToText(jsonStr);
}

async function getSocialConfig(c: Context<{ Bindings: Bindings }>): Promise<Record<string, string | undefined>> {
  try {
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
      dbSettings[row.key] = row.value;
    }

    return {
      DISCORD_WEBHOOK_URL: c.env.DISCORD_WEBHOOK_URL || dbSettings["DISCORD_WEBHOOK_URL"],
      MAKE_WEBHOOK_URL: dbSettings["MAKE_WEBHOOK_URL"],
      BLUESKY_HANDLE: dbSettings["BLUESKY_HANDLE"],
      BLUESKY_APP_PASSWORD: dbSettings["BLUESKY_APP_PASSWORD"],
      SLACK_WEBHOOK_URL: dbSettings["SLACK_WEBHOOK_URL"],
      TEAMS_WEBHOOK_URL: dbSettings["TEAMS_WEBHOOK_URL"],
      GCHAT_WEBHOOK_URL: dbSettings["GCHAT_WEBHOOK_URL"],
      FACEBOOK_PAGE_ID: dbSettings["FACEBOOK_PAGE_ID"],
      FACEBOOK_ACCESS_TOKEN: dbSettings["FACEBOOK_ACCESS_TOKEN"],
      TWITTER_API_KEY: dbSettings["TWITTER_API_KEY"],
      TWITTER_API_SECRET: dbSettings["TWITTER_API_SECRET"],
      TWITTER_ACCESS_TOKEN: dbSettings["TWITTER_ACCESS_TOKEN"],
      TWITTER_ACCESS_SECRET: dbSettings["TWITTER_ACCESS_SECRET"],
      INSTAGRAM_ACCOUNT_ID: dbSettings["INSTAGRAM_ACCOUNT_ID"],
      INSTAGRAM_ACCESS_TOKEN: dbSettings["INSTAGRAM_ACCESS_TOKEN"],
      CALENDAR_ID: dbSettings["CALENDAR_ID"],
      GCAL_SERVICE_ACCOUNT_EMAIL: dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"],
      GCAL_PRIVATE_KEY: dbSettings["GCAL_PRIVATE_KEY"]
    };
  } catch (err) {
    console.error("Failed to fetch settings for social integration:", err);
    return {};
  }
}

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
        snippet = rawText.length > 200 ? rawText.slice(0, 200).trim() + "..." : rawText.trim();
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
        snippet = rawText.length > 200 ? rawText.slice(0, 200).trim() + "..." : rawText.trim();
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
        // Prevent V8 isolate collapse: Skip Edge AI vision for payloads > 2.5MB
        if (arrayBuffer.byteLength > 2.5 * 1024 * 1024) {
          console.warn("Image exceeds Edge AI memory threshold. Falling back to generic alt text.");
        } else {
          // Use Array.from() to prevent 'Maximum call stack size exceeded' caused by array spreads
          const uint8 = Array.from(new Uint8Array(arrayBuffer));
          const aiResponse = await c.env.AI.run('@cf/llava-1.5-7b-hf', {
            prompt: 'Describe this image for screen readers in 1 sentence. Make it helpful, concise, and focused on robotics if applicable.',
            image: uint8
          });
          if ((aiResponse as { description?: string })?.description) {
            altText = String((aiResponse as { description?: string }).description).trim();
          }
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

    const baseUrl = "https://aresfirst.org";
    
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

// ── GET /api/media — list public R2 objects (Gallery only) ────────────
apiRouter.get("/media", async (c) => {
  try {
    const [objects, dbRes] = await Promise.all([
      c.env.ARES_STORAGE.list(),
      c.env.DB.prepare("SELECT key, folder, tags FROM media_tags WHERE folder = 'Gallery'").all().catch(() => ({ results: [] }))
    ]);

    const results = (dbRes.results || []) as { key: string, folder: string, tags: string }[];
    const publicKeys = new Set(results.map(r => r.key));

    const merged = objects.objects
      .filter(obj => publicKeys.has(obj.key))
      .map(obj => ({
        ...obj,
        url: `/api/media/${obj.key}`,
        folder: "Gallery",
        tags: results.find(r => r.key === obj.key)?.tags || ""
      }));

    return c.json({ media: merged });
  } catch (err) {
    console.error("R2 public list error:", err);
    return c.json({ error: "List failed", media: [] }, 500);
  }
});

// ── GET /admin/media — list all R2 objects (CMS Admins) ───────────────
apiRouter.get("/admin/media", async (c) => {
  try {
    const [objects, dbRes] = await Promise.all([
      c.env.ARES_STORAGE.list(),
      c.env.DB.prepare("SELECT key, folder, tags FROM media_tags").all().catch(() => ({ results: [] }))
    ]);

    const metaMap = new Map();
    for (const row of (dbRes.results || []) as { key: string, folder: string, tags: string }[]) {
      metaMap.set(row.key, { folder: row.folder, tags: row.tags });
    }

    const merged = objects.objects.map(obj => ({
      ...obj,
      url: `/api/media/${obj.key}`,
      folder: metaMap.get(obj.key)?.folder || "Library",
      tags: metaMap.get(obj.key)?.tags || ""
    }));

    return c.json({ media: merged });
  } catch (err) {
    console.error("R2 admin list error:", err);
    return c.json({ error: "List failed", media: [] }, 500);
  }
});

// ── DELETE /api/media/:key — delete R2 object (admin) ─────────────────
apiRouter.delete("/admin/media/:key", ensureAdmin, async (c) => {
  try {
    const key = c.req.param("key") as string;
    const auth = getAuth(c.env.DB, c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    const isLocalDev = new URL(c.req.url).hostname === "localhost" || new URL(c.req.url).hostname === "127.0.0.1";
    // @ts-expect-error - Better Auth session type lacks role but D1 query adds it
    const role = isLocalDev ? "admin" : ((session?.user?.role as string) || "user");

    if (role === "admin") {
      await Promise.all([
        c.env.ARES_STORAGE.delete(key),
        c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(key).run().catch(() => {})
      ]);
    } else {
      // Authors trigger soft-deletion mechanism for photos (archived/ prefix)
      if (!isLocalDev) {
        const obj = await c.env.ARES_STORAGE.get(key);
        if (obj) {
          await c.env.ARES_STORAGE.put(`archived/${key}`, obj.body, { httpMetadata: obj.httpMetadata });
          await c.env.ARES_STORAGE.delete(key);
        }
      }
      await c.env.DB.prepare("UPDATE media_tags SET folder = 'Archived', key = ? WHERE key = ?").bind(`archived/${key}`, key).run().catch(() => {});
    }
    return c.json({ success: true });

  } catch (err) {
    console.error("R2 delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── PUT /admin/media/:key/move — change folder (admin) ─────────────────
apiRouter.put("/admin/media/:key/move", ensureAdmin, async (c) => {
  try {
    const key = c.req.param("key") as string;
    const body = await c.req.json();
    const newFolder = body?.folder || "";

    await c.env.DB.prepare("UPDATE media_tags SET folder = ? WHERE key = ?").bind(newFolder, key).run();
    return c.json({ success: true, folder: newFolder });
  } catch (err) {
    console.error("R2 move error:", err);
    return c.json({ error: "Move failed" }, 500);
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
    
    const imageUrl = `https://aresfirst.org/api/media/${key}`;
    const { dispatchPhotoSocials } = await import("../utils/socialSync");
    
    // Offload the slow, heavily cryptographic dispatches to edge context background
    try {
      await dispatchPhotoSocials(imageUrl, caption, config);
      return c.json({ success: true, message: "Syndication dispatched successfully" });
    } catch (err: unknown) {
      console.error("Dispatch photo socials failed:", err);
      return c.json({ error: `Network Syndication Failed: ${(err as Error)?.message || String(err)}` }, 502);
    }
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

// ── GET /admin/posts — list all blog posts (admin) ──────────────────────
apiRouter.get("/admin/posts", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, cf_email, is_deleted FROM posts ORDER BY date DESC"
    ).all();
    return c.json({ posts: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (posts):", err);
    return c.json({ posts: [] });
  }
});

// ── GET /admin/posts/:slug — single blog post (admin) ─────────────────
apiRouter.get("/admin/posts/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, date, snippet, thumbnail, content, is_deleted FROM posts WHERE slug = ?"
    ).bind(slug).first();

    if (!row) return c.json({ error: "Post not found" }, 404);
    return c.json({ post: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── GET /admin/events — list all events (admin) ─────────────────────────
apiRouter.get("/admin/events", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_deleted FROM events ORDER BY date_start ASC"
    ).all();
    return c.json({ events: results ?? [] });
  } catch (err) {
    console.error("D1 admin list error (events):", err);
    return c.json({ events: [] });
  }
});

// ── GET /admin/events/:id — single event (admin) ────────────────────────
apiRouter.get("/admin/events/:id", async (c) => {
  const id = c.req.param("id");
  try {
    const row = await c.env.DB.prepare(
      "SELECT id, title, date_start, date_end, location, description, cover_image, gcal_event_id, cf_email, is_deleted FROM events WHERE id = ?"
    ).bind(id).first();

    if (!row) return c.json({ error: "Event not found" }, 404);
    return c.json({ event: row });
  } catch (err) {
    console.error("D1 read error:", err);
    return c.json({ error: "Database error" }, 500);
  }
});

// ── DELETE /api/events/:id — soft-delete an event (admin) ────────────────
apiRouter.delete("/admin/events/:id", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE events SET is_deleted = 1 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (events):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /api/events/:id/undelete — restore a soft-deleted event (admin) ─────
apiRouter.patch("/admin/events/:id/undelete", async (c) => {
  try {
    const id = c.req.param("id");
    await c.env.DB.prepare("UPDATE events SET is_deleted = 0 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (events):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /api/events/:id/purge — PERMANENTLY delete an event (admin) ────────
apiRouter.delete("/admin/events/:id/purge", async (c) => {
  try {
    const id = c.req.param("id");
    
    // GCal cleanup if possible
    const { results: settingsRows } = await c.env.DB.prepare("SELECT key, value FROM settings").all();
    const dbSettings: Record<string, string> = {};
    for (const row of settingsRows as { key: string, value: string }[]) {
       dbSettings[row.key] = row.value;
    }
    const gcalEmail = dbSettings["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = dbSettings["GCAL_PRIVATE_KEY"];
    const calId = dbSettings["CALENDAR_ID"];
    
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(id).first<{gcal_event_id: string}>();
      if (row && row.gcal_event_id) {
        try {
          await deleteEventFromGcal(row.gcal_event_id, {
            email: gcalEmail,
            privateKey: gcalKey,
            calendarId: calId
          });
        } catch (err: unknown) {
          console.warn("GCal purge cleanup failed (ignoring for DB purge):", err);
        }
      }
    }

    await c.env.DB.prepare("DELETE FROM events WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (events):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── POST /api/events/:id/repush — manual social broadcast (admin) ──
apiRouter.post("/admin/events/:id/repush", async (c) => {
  try {
    const id = c.req.param("id");
    const { socials } = await c.req.json<{ socials: Record<string, boolean> }>();
    
    const event = await c.env.DB.prepare(
      "SELECT title, description, cover_image FROM events WHERE id = ?"
    ).bind(id).first<{ title: string, description: string, cover_image: string }>();

    if (!event) return c.json({ error: "Event not found" }, 404);

    const socialConfig = await getSocialConfig(c);
    
    try {
      await dispatchSocials({
        title: event.title,
        url: `https://aresfirst.org/events`, // Link to events page
        snippet: extractAstText(event.description || "").substring(0, 250) || "Join us for our upcoming event!",
        coverImageUrl: event.cover_image || "/gallery_1.png",
        baseUrl: new URL(c.req.url).origin
      }, socialConfig, socials);
    } catch (err: unknown) {
      console.error("Event repush failed:", err);
      return c.json({ error: `Network Repush Failed: ${(err as Error)?.message || String(err)}` }, 502);
    }

    return c.json({ success: true });
  } catch (err) {
    console.error("Event repush error:", err);
    return c.json({ error: "Repush failed" }, 500);
  }
});

// ── DELETE /api/posts/:slug — soft-delete a blog post (admin) ────────────────
apiRouter.delete("/admin/posts/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 1 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (posts):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /api/posts/:slug/undelete — restore a soft-deleted post (admin) ─────
apiRouter.patch("/admin/posts/:slug/undelete", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE posts SET is_deleted = 0 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (posts):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /api/posts/:slug/purge — PERMANENTLY delete a post (admin) ─────────
apiRouter.delete("/admin/posts/:slug/purge", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM posts WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (posts):", err);
    return c.json({ error: "Purge failed" }, 500);
  }
});

// ── POST /api/posts/:slug/repush — manual social broadcast (admin) ──
apiRouter.post("/admin/posts/:slug/repush", async (c) => {
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

// ── PUT /api/events/:id — edit an event (admin) ────────────────────────
apiRouter.put("/admin/events/:id", async (c) => {
  try {
    const paramId = c.req.param("id");
    const body = await c.req.json();
    const { title, dateStart, dateEnd, location, description, coverImage, socials } = body;

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const warnings: string[] = [];
    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig["CALENDAR_ID"];

    // Attempt GCal update
    let gcalId: string | undefined = undefined;
    if (gcalEmail && gcalKey && calId) {
      const row = await c.env.DB.prepare("SELECT gcal_event_id FROM events WHERE id = ?").bind(paramId).first<{gcal_event_id: string}>();
      try {
        gcalId = await pushEventToGcal(
          { id: paramId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage, gcal_event_id: row?.gcal_event_id },
          { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        );
      } catch (err: unknown) {
        console.error("GCal PUT update error:", err);
        warnings.push(`Google Calendar Auth Failed: ${(err as Error)?.message || "Unknown GCal Error"}`);
      }
    }

    await c.env.DB.prepare(
      `UPDATE events SET title = ?, date_start = ?, date_end = ?, location = ?, description = ?, cover_image = ?, gcal_event_id = COALESCE(?, gcal_event_id) WHERE id = ?`
    )
      .bind(title, dateStart, dateEnd || null, location || "", description || "", coverImage || "", gcalId || null, paramId)
      .run();

    // ── Optional Social Syndication ──
     if (socials) {
       try {
         await dispatchSocials({
            title: title,
            url: `https://aresfirst.org/events`,
            snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
            coverImageUrl: coverImage || "/gallery_1.png",
            baseUrl: new URL(c.req.url).origin
         }, socialConfig, socials);
       } catch (err: unknown) {
         console.error("Event update social dispatch failed:", err);
         warnings.push(`Network Syndication Failed: ${(err as Error)?.message || String(err)}`);
       }
    }

    const finalStatus = warnings.length > 0 ? 207 : 200;
    return c.json({ success: true, id: paramId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, finalStatus as 200 | 207);
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
      "SELECT slug, title, category, sort_order, description FROM docs WHERE is_deleted = 0 ORDER BY category, sort_order ASC"
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
      "SELECT slug, title, category, description, content FROM docs WHERE is_deleted = 0 AND (title LIKE ? OR content LIKE ? OR description LIKE ?) ORDER BY category, sort_order ASC LIMIT 20"
    ).bind(`%${q}%`, `%${q}%`, `%${q}%`).all();

    // Return snippets, not full content
    const mapped = (results ?? []).map((r: Record<string, unknown>) => {
      const content = String(r.content || "");
      const idx = content.toLowerCase().indexOf(q.toLowerCase());
      const start = Math.max(0, idx - 100);
      const end = Math.min(content.length, idx + q.length + 100);
      
      let snippet = idx >= 0 ? content.slice(start, end) : (r.description || "");
      
      // Keyword highlighting (simple HTML bold)
      const regex = new RegExp(`(${q})`, "gi");
      snippet = snippet.replace(regex, "**$1**");

      return {
        slug: r.slug,
        title: r.title,
        category: r.category,
        description: r.description,
        snippet: idx >= 0 ? "..." + snippet + "..." : (r.description || ""),
      };
    });
    return c.json({ results: mapped });
  } catch (err) {
    console.error("D1 docs search error:", err);
    return c.json({ results: [] });
  }
});

// ── POST /api/docs/:slug/feedback — Submit doc feedback ───────────────
apiRouter.post("/docs/:slug/feedback", async (c) => {
  try {
    const slug = c.req.param("slug");
    const { isHelpful, comment } = await c.req.json();
    await c.env.DB.prepare(
      "INSERT INTO docs_feedback (slug, is_helpful, comment) VALUES (?, ?, ?)"
    ).bind(slug, isHelpful ? 1 : 0, comment || null).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 feedback error:", err);
    return c.json({ error: "Feedback failed" }, 500);
  }
});

// ── GET /api/docs/:slug — single doc page ─────────────────────────────
apiRouter.get("/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  try {
    const row = await c.env.DB.prepare(
      "SELECT slug, title, category, description, content, updated_at FROM docs WHERE slug = ? AND is_deleted = 0"
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
    const email = c.req.header("cf-access-authenticated-user-email") || "anonymous_admin";
    const { slug, title, category, sortOrder, description, content } = await c.req.json();
    if (!slug || !title || !category || !content) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    // Capture history before update
    const existing = await c.env.DB.prepare("SELECT * FROM docs WHERE slug = ?").bind(slug).first();
    if (existing) {
       await c.env.DB.prepare(
         `INSERT INTO docs_history (slug, title, category, description, content, author_email)
          VALUES (?, ?, ?, ?, ?, ?)`
       ).bind(existing.slug, existing.title, existing.category, existing.description, existing.content, existing.cf_email || "unknown").run();
    }

    await c.env.DB.prepare(
      `INSERT OR REPLACE INTO docs (slug, title, category, sort_order, description, content, cf_email, updated_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    ).bind(slug, title, category, sortOrder || 0, description || "", content, email).run();
    
    return c.json({ success: true, slug });
  } catch (err) {
    console.error("D1 doc write error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});

// ── DELETE /api/admin/docs/:slug — soft-delete a doc (admin) ───────────────
apiRouter.delete("/admin/docs/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE docs SET is_deleted = 1 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 soft-delete error (docs):", err);
    return c.json({ error: "Soft-delete failed" }, 500);
  }
});

// ── PATCH /api/admin/docs/:slug/undelete — restore a soft-deleted doc (admin) ────
apiRouter.patch("/admin/docs/:slug/undelete", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("UPDATE docs SET is_deleted = 0 WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 undelete error (docs):", err);
    return c.json({ error: "Undelete failed" }, 500);
  }
});

// ── DELETE /api/admin/docs/:slug/purge — PERMANENTLY delete a doc (admin) ────────
apiRouter.delete("/admin/docs/:slug/purge", async (c) => {
  try {
    const slug = c.req.param("slug");
    await c.env.DB.prepare("DELETE FROM docs WHERE slug = ?").bind(slug).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("D1 purge error (docs):", err);
    return c.json({ error: "Purge failed" }, 500);
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

// ── POST /api/admin/events — manual event creation (admin) ─────────────
apiRouter.post("/admin/events", async (c) => {
  try {
    const email = c.req.header("cf-access-authenticated-user-email") || "anonymous_admin";
    const body = await c.req.json();
    const { title, dateStart, dateEnd, location, description, coverImage, socials } = body;

    if (!title || !dateStart) {
      return c.json({ error: "Missing required fields" }, 400);
    }

    const warnings: string[] = [];
    const genId = crypto.randomUUID();
    
    // Sync to GCal if enabled
    let gcalId: string | null = null;
    const socialConfig = await getSocialConfig(c);
    const gcalEmail = socialConfig["GCAL_SERVICE_ACCOUNT_EMAIL"];
    const gcalKey = socialConfig["GCAL_PRIVATE_KEY"];
    const calId = socialConfig["CALENDAR_ID"];

    if (gcalEmail && gcalKey && calId) {
      try {
        gcalId = await pushEventToGcal(
           { id: genId, title, date_start: dateStart, date_end: dateEnd, location, description, cover_image: coverImage },
           { email: gcalEmail, privateKey: gcalKey, calendarId: calId }
        );
      } catch (err: unknown) {
        console.error("GCal manual POST error:", err);
        warnings.push(`Google Calendar Auth Failed: ${(err as Error)?.message || "Unknown GCal Error"}`);
      }
    }

    await c.env.DB.prepare(
      "INSERT INTO events (id, title, date_start, date_end, location, description, gcal_event_id, cf_email, cover_image) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(genId, title, dateStart, dateEnd || null, location || "", description || "", gcalId, email, coverImage || null).run();

    // Dispatch Socials
    if (socials) {
       try {
         await dispatchSocials({
            title: title,
            url: `https://aresfirst.org/events`,
            snippet: extractAstText(description).substring(0, 250) || "New event scheduled!",
            coverImageUrl: coverImage || "/gallery_1.png",
            baseUrl: new URL(c.req.url).origin
         }, socialConfig, socials);
       } catch (err: unknown) {
         console.error("Event social dispatch failed:", err);
         warnings.push(`Network Syndication Failed: ${(err as Error)?.message || String(err)}`);
       }
    }

    const finalStatus = warnings.length > 0 ? 207 : 200;
    return c.json({ success: true, id: genId, warning: warnings.length > 0 ? warnings.join(" | ") : undefined }, finalStatus as 200 | 207);
  } catch (err: unknown) {
    console.error("D1 manual event creation error:", err);
    return c.json({ error: "Write failed" }, 500);
  }
});


// ══════════════════════════════════════════════════════════════════════
// ── PROFILE & COMMUNITY ENDPOINTS ─────────────────────────────────────
// ══════════════════════════════════════════════════════════════════════

/* Helper: Session extraction (returns null if not authenticated) */
async function getSessionUser(c: Context<{ Bindings: Bindings }>) {
  const url = new URL(c.req.url);
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1") {
    return { id: "local-dev", email: "local-dev@localhost", name: "Local Dev", image: null, role: "admin" };
  }
  try {
    const auth = getAuth(c.env.DB, c.env, c.req.url);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session && session.user) {
      return {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        image: session.user.image,
        // @ts-expect-error - Better Auth role extension
        role: (session.user.role as string) || "user",
      };
    }
  } catch { /* ignore */ }
  return null;
}

/* Helper: Server-side PII stripping per FIRST YPP */
function sanitizeProfileForPublic(profile: Record<string, unknown>, memberType: string, bypassSecurity = false) {
  if (bypassSecurity) {
    return {
      ...profile,
      email: profile.contact_email || profile.email,
      nickname: profile.nickname || profile.first_name || "ARES Member",
    };
  }

  const safe: Record<string, unknown> = {
    user_id: profile.user_id,
    nickname: profile.nickname || "ARES Member",
    avatar: profile.avatar,
    pronouns: profile.pronouns,
    subteams: profile.subteams,
    member_type: profile.member_type,
    bio: profile.bio,
    favorite_first_thing: profile.favorite_first_thing,
    fun_fact: profile.fun_fact,
    show_on_about: profile.show_on_about,
    favorite_robot_mechanism: profile.favorite_robot_mechanism,
    pre_match_superstition: profile.pre_match_superstition,
    leadership_role: profile.leadership_role,
    rookie_year: profile.rookie_year,
  };
  // Students & parents: NEVER expose PII or career/education fields
  if (memberType === "student" || memberType === "parent") {
    return safe;
  }
  // Adults: include optional fields if user opted in
  return {
    ...safe,
    email: Number(profile.show_email) ? (profile.contact_email || profile.email) : undefined,
    phone: Number(profile.show_phone) ? profile.phone : undefined,
    colleges: profile.colleges,
    employers: profile.employers,
    grade_year: profile.grade_year,
  };
}

// ── GET /api/profile/me — own profile (auth required) ─────────────────
apiRouter.get("/profile/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const row = await c.env.DB.prepare(
      "SELECT p.*, u.email, u.image as avatar FROM user_profiles p LEFT JOIN user u ON p.user_id = u.id WHERE p.user_id = ?"
    ).bind(user.id).first();
    if (!row) return c.json({ user_id: user.id, member_type: "student" });
    return c.json({ ...row, avatar: row.avatar });
  } catch (err) {
    console.error("[Profile GET me]", err);
    return c.json({ error: "Failed to fetch profile" }, 500);
  }
});

// ── GET /api/logistics/summary — Aggregated dietary & gear info (auth required) ──
apiRouter.get("/logistics/summary", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  try {
    const { results } = await c.env.DB.prepare(
      "SELECT dietary_restrictions, tshirt_size FROM user_profiles"
    ).all();

    const dietCounts: Record<string, number> = {};
    const tshirtCounts: Record<string, number> = {};
    let totalProfiles = 0;

    for (const row of (results || []) as { dietary_restrictions: string; tshirt_size: string }[]) {
      totalProfiles++;
      
      // Aggregate T-shirts
      if (row.tshirt_size) {
        tshirtCounts[row.tshirt_size] = (tshirtCounts[row.tshirt_size] || 0) + 1;
      }

      // Aggregate Dietary
      try {
        const restrictions = JSON.parse(row.dietary_restrictions || "[]") as string[];
        for (const r of restrictions) {
          dietCounts[r] = (dietCounts[r] || 0) + 1;
        }
      } catch (e) {
        console.error("Failed to parse dietary restrictions for a user:", e);
      }
    }

    return c.json({
      dietary: dietCounts,
      tshirts: tshirtCounts,
      totalCount: totalProfiles
    });
  } catch (err) {
    console.error("[Logistics Summary GET]", err);
    return c.json({ error: "Failed to fetch logistics summary" }, 500);
  }
});

// ── PUT /api/profile/me — update own profile ──────────────────────────
apiRouter.put("/profile/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  try {
    const body = await c.req.json() as Record<string, unknown>;
    await c.env.DB.prepare(`
      INSERT INTO user_profiles (
        user_id, first_name, last_name, nickname, phone, contact_email, show_email, show_phone, pronouns, grade_year, subteams, member_type, bio, favorite_food, dietary_restrictions, favorite_first_thing, fun_fact, colleges, employers, show_on_about,
        favorite_robot_mechanism, pre_match_superstition, leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET
        first_name=excluded.first_name, last_name=excluded.last_name, nickname=excluded.nickname, phone=excluded.phone, contact_email=excluded.contact_email, show_email=excluded.show_email, show_phone=excluded.show_phone,
        pronouns=excluded.pronouns, grade_year=excluded.grade_year, subteams=excluded.subteams, member_type=excluded.member_type,
        bio=excluded.bio, favorite_food=excluded.favorite_food, dietary_restrictions=excluded.dietary_restrictions,
        favorite_first_thing=excluded.favorite_first_thing, fun_fact=excluded.fun_fact,
        colleges=excluded.colleges, employers=excluded.employers, show_on_about=excluded.show_on_about,
        favorite_robot_mechanism=excluded.favorite_robot_mechanism, pre_match_superstition=excluded.pre_match_superstition,
        leadership_role=excluded.leadership_role, rookie_year=excluded.rookie_year, tshirt_size=excluded.tshirt_size,
        emergency_contact_name=excluded.emergency_contact_name, emergency_contact_phone=excluded.emergency_contact_phone,
        updated_at=datetime('now')
    `).bind(
      user.id,
      (body.first_name as string) || null,
      (body.last_name as string) || null,
      (body.nickname as string) || null,
      (body.phone as string) || null,
      (body.contact_email as string) || null,
      Number(body.show_email) || 0,
      Number(body.show_phone) || 0,
      (body.pronouns as string) || null,
      (body.grade_year as string) || null,
      (body.subteams as string) || "[]",
      (body.member_type as string) || "student",
      (body.bio as string) || null,
      (body.favorite_food as string) || null,
      (body.dietary_restrictions as string) || null,
      (body.favorite_first_thing as string) || null,
      (body.fun_fact as string) || null,
      (body.colleges as string) || "[]",
      (body.employers as string) || "[]",
      Number(body.show_on_about) ?? 1,
      (body.favorite_robot_mechanism as string) || null,
      (body.pre_match_superstition as string) || null,
      (body.leadership_role as string) || null,
      (body.rookie_year as string) || null,
      (body.tshirt_size as string) || null,
      (body.emergency_contact_name as string) || null,
      (body.emergency_contact_phone as string) || null
    ).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Profile PUT me]", err);
    return c.json({ error: "Save failed: " + ((err as Error).message || String(err)) }, 500);
  }
});

// ── GET /api/profile/:userId — public profile (full if admin) ─────────
apiRouter.get("/profile/:userId", async (c) => {
  const userId = c.req.param("userId");
  try {
    const row = await c.env.DB.prepare(
      "SELECT p.*, u.email, u.image as avatar FROM user_profiles p LEFT JOIN user u ON p.user_id = u.id WHERE p.user_id = ?"
    ).bind(userId).first() as Record<string, unknown> | null;
    if (!row) return c.json({ error: "Not found" }, 404);

    const currentUser = await getSessionUser(c);
    const isAdmin = currentUser?.role === "admin";
    
    return c.json(sanitizeProfileForPublic(row, (row.member_type as string) || "student", isAdmin));
  } catch (err) {
    console.error("[Profile GET public]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ── GET /api/team-roster — public About Us data ───────────────────────
apiRouter.get("/team-roster", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT p.*, u.image as avatar FROM user_profiles p LEFT JOIN user u ON p.user_id = u.id WHERE p.show_on_about = 1 AND p.member_type != 'parent'"
    ).all();
    const sanitized = (results || []).map((r: Record<string, unknown>) =>
      sanitizeProfileForPublic(r, (r.member_type as string) || "student")
    );
    return c.json({ members: sanitized });
  } catch (err) {
    console.error("[Team Roster]", err);
    return c.json({ members: [] }, 500);
  }
});

// ── Admin Users ───────────────────────────────────────────────────────
apiRouter.get("/admin/users", async (c) => {
  try {
    const { results } = await c.env.DB.prepare(
      "SELECT u.id, u.name, u.email, u.image, u.role, u.createdAt, p.first_name, p.last_name, p.nickname, p.member_type FROM user u LEFT JOIN user_profiles p ON u.id = p.user_id ORDER BY u.createdAt DESC"
    ).all();
    return c.json({ users: results || [] });
  } catch (err: unknown) {
    console.error("[Admin Users GET]", err);
    return c.json({ error: err instanceof Error ? err.message : "Failed" }, 500);
  }
});

apiRouter.put("/admin/users/:id/role", async (c) => {
  const id = c.req.param("id");
  const { role } = await c.req.json() as { role: string };
  if (!["user", "author", "admin"].includes(role)) return c.json({ error: "Invalid role" }, 400);
  try {
    await c.env.DB.prepare("UPDATE user SET role = ? WHERE id = ?").bind(role, id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Admin Role Update]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

apiRouter.put("/admin/users/:id/member_type", async (c) => {
  const id = c.req.param("id");
  const { member_type } = await c.req.json() as { member_type: string };
  try {
    // Upsert the profile with the new member_type
    await c.env.DB.prepare(`
      INSERT INTO user_profiles (user_id, member_type, updated_at) 
      VALUES (?, ?, datetime('now'))
      ON CONFLICT(user_id) DO UPDATE SET member_type = excluded.member_type, updated_at = datetime('now')
    `).bind(id, member_type).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Admin Member Type Update]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

apiRouter.delete("/admin/users/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await c.env.DB.batch([
      c.env.DB.prepare("DELETE FROM user_profiles WHERE user_id = ?").bind(id),
      c.env.DB.prepare("DELETE FROM session WHERE userId = ?").bind(id),
      c.env.DB.prepare("DELETE FROM account WHERE userId = ?").bind(id),
      c.env.DB.prepare("DELETE FROM user WHERE id = ?").bind(id),
    ]);
    return c.json({ success: true });
  } catch (err) {
    console.error("[Admin User Delete]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ── GET /admin/users/:id/profile — Admin override profile fetch ─────────
apiRouter.get("/admin/users/:id/profile", async (c) => {
  try {
    const id = c.req.param("id");
    const profile = await c.env.DB.prepare("SELECT * FROM user_profiles WHERE user_id = ?").bind(id).first();
    const user = await c.env.DB.prepare("SELECT email FROM user WHERE id = ?").bind(id).first();
    
    if (!profile) {
      return c.json({ ...(user || {}), error: "Profile not configured yet" });
    }
    return c.json({ 
      ...profile, 
      email: (user as { email?: string })?.email || "",
      contact_email: profile.contact_email || (user as { email?: string })?.email || "" 
    });
  } catch (err) {
    console.error("[Admin Profile Override Fetch]", err);
    return c.json({ error: "Failed to fetch user profile" }, 500);
  }
});

// ── PUT /admin/users/:id/profile — Admin override profile save ──────────
apiRouter.put("/admin/users/:id/profile", async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    await c.env.DB.prepare(
      `INSERT INTO user_profiles (
        user_id, first_name, last_name, nickname, phone, contact_email, show_email, show_phone,
        pronouns, grade_year, subteams, member_type, bio, favorite_food, dietary_restrictions,
        favorite_first_thing, fun_fact, colleges, employers, favorite_robot_mechanism,
        pre_match_superstition, leadership_role, rookie_year, tshirt_size, emergency_contact_name,
        emergency_contact_phone, show_on_about, updated_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now')
      ) ON CONFLICT(user_id) DO UPDATE SET
        first_name=excluded.first_name, last_name=excluded.last_name, nickname=excluded.nickname,
        phone=excluded.phone, contact_email=excluded.contact_email, show_email=excluded.show_email,
        show_phone=excluded.show_phone, pronouns=excluded.pronouns, grade_year=excluded.grade_year,
        subteams=excluded.subteams, member_type=excluded.member_type, bio=excluded.bio,
        favorite_food=excluded.favorite_food, dietary_restrictions=excluded.dietary_restrictions,
        favorite_first_thing=excluded.favorite_first_thing, fun_fact=excluded.fun_fact,
        colleges=excluded.colleges, employers=excluded.employers, favorite_robot_mechanism=excluded.favorite_robot_mechanism,
        pre_match_superstition=excluded.pre_match_superstition, leadership_role=excluded.leadership_role,
        rookie_year=excluded.rookie_year, tshirt_size=excluded.tshirt_size,
        emergency_contact_name=excluded.emergency_contact_name, emergency_contact_phone=excluded.emergency_contact_phone,
        show_on_about=excluded.show_on_about, updated_at=datetime('now')`
    ).bind(
      id, body.first_name || null, body.last_name || null, body.nickname || null, body.phone || null, body.contact_email || null,
      body.show_email ? 1 : 0, body.show_phone ? 1 : 0, body.pronouns || null, body.grade_year || null,
      body.subteams || '[]', body.member_type || 'student', body.bio || null, body.favorite_food || null,
      body.dietary_restrictions || '[]', body.favorite_first_thing || null, body.fun_fact || null,
      body.colleges || '[]', body.employers || '[]', body.favorite_robot_mechanism || null,
      body.pre_match_superstition || null, body.leadership_role || null, body.rookie_year || null, body.tshirt_size || null,
      body.emergency_contact_name || null, body.emergency_contact_phone || null, body.show_on_about ? 1 : 0
    ).run();

    return c.json({ success: true });
  } catch (err: unknown) {
    console.error("[Admin Profile Override Error]", err);
    return c.json({ error: "Failed to update member profile", pii_context: (err as Error)?.message }, 500);
  }
});

// ── Comments ──────────────────────────────────────────────────────────
apiRouter.get("/comments/:targetType/:targetId", async (c) => {
  const targetType = c.req.param("targetType");
  const targetId = c.req.param("targetId");
  const user = await getSessionUser(c);
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT c.*, p.nickname, u.image as avatar FROM comments c
       LEFT JOIN user_profiles p ON c.user_id = p.user_id
       LEFT JOIN user u ON c.user_id = u.id
       WHERE c.target_type = ? AND c.target_id = ? AND c.is_deleted = 0
       ORDER BY c.created_at ASC`
    ).bind(targetType, targetId).all();
    const comments = (results || []).map((r: Record<string, unknown>) => ({
      ...r,
      nickname: r.nickname || "ARES Member",
      is_own: user ? r.user_id === user.id : false,
    }));
    return c.json({ comments, authenticated: !!user });
  } catch (err) {
    console.error("[Comments GET]", err);
    return c.json({ comments: [], authenticated: false }, 500);
  }
});

apiRouter.post("/comments/:targetType/:targetId", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const targetType = c.req.param("targetType");
  const targetId = c.req.param("targetId");
  const { content } = await c.req.json() as { content: string };
  if (!content || content.trim().length === 0) return c.json({ error: "Empty comment" }, 400);
  try {
    await c.env.DB.prepare(
      "INSERT INTO comments (target_type, target_id, user_id, content) VALUES (?, ?, ?, ?)"
    ).bind(targetType, targetId, user.id, content.trim()).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Comments POST]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

apiRouter.delete("/admin/comments/:id", async (c) => {
  const id = c.req.param("id");
  try {
    await c.env.DB.prepare("UPDATE comments SET is_deleted = 1 WHERE id = ?").bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Comments DELETE]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

// ── Event Sign-Ups ────────────────────────────────────────────────────
apiRouter.get("/events/:id/signups", async (c) => {
  const eventId = c.req.param("id");
  const user = await getSessionUser(c);
  try {
    const { results } = await c.env.DB.prepare(
      `SELECT s.*, p.nickname, u.image as avatar FROM event_signups s
       LEFT JOIN user_profiles p ON s.user_id = p.user_id
       LEFT JOIN user u ON s.user_id = u.id
       WHERE s.event_id = ? ORDER BY s.created_at ASC`
    ).bind(eventId).all();
    const signups = (results || []).map((r: Record<string, unknown>) => ({
      ...r,
      nickname: r.nickname || "ARES Member",
      is_own: user ? r.user_id === user.id : false,
    }));
    return c.json({ signups, authenticated: !!user });
  } catch (err) {
    console.error("[Signups GET]", err);
    return c.json({ signups: [], authenticated: false }, 500);
  }
});

apiRouter.post("/events/:id/signups", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const eventId = c.req.param("id");
  const { bringing, notes } = await c.req.json() as { bringing: string; notes: string };
  try {
    await c.env.DB.prepare(
      `INSERT INTO event_signups (event_id, user_id, bringing, notes) VALUES (?, ?, ?, ?)
       ON CONFLICT(event_id, user_id) DO UPDATE SET bringing=excluded.bringing, notes=excluded.notes`
    ).bind(eventId, user.id, bringing || "", notes || "").run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups POST]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

apiRouter.delete("/events/:id/signups/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const eventId = c.req.param("id");
  try {
    await c.env.DB.prepare("DELETE FROM event_signups WHERE event_id = ? AND user_id = ?").bind(eventId, user.id).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("[Signups DELETE me]", err);
    return c.json({ error: "Failed" }, 500);
  }
});

app.route("/api", apiRouter);
app.route("/dashboard/api", apiRouter);

export const onRequest = handle(app);

export default app;

