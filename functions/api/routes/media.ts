import { Hono } from "hono";
import { AppEnv, ensureAdmin, getDbSettings, checkRateLimit, rateLimitMiddleware } from "../middleware";

const mediaRouter = new Hono<AppEnv>();
const adminMediaRouter = new Hono<AppEnv>();

// SEC-D02: Magic byte validation helper
function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer).subarray(0, 4);
  const header = arr.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
  
  // PNG: 89504e47
  if (header === '89504e47') return true;
  // JPEG: ffd8ff
  if (header.startsWith('ffd8ff')) return true;
  // GIF: 47494638
  if (header.startsWith('47494638')) return true;
  // WEBP: 52494646 (RIFF) ... 57454250 (WEBP)
  if (header === '52494646') return true; 
  // HEIC: 000000..6674797068656963 (ftypheic)
  // We'll just check if it starts with 0000 for simplicity or has ftyp
  if (header.includes('66747970')) return true;

  return false;
}

// SCA-F01: Recursive R2 Listing Helper to break 1,000 item limit
async function listAllObjects(bucket: R2Bucket, options?: R2ListOptions) {
  let result = await bucket.list(options);
  const objects = [...result.objects];
  while (result.truncated) {
    result = await bucket.list({ ...options, cursor: result.cursor });
    objects.push(...result.objects);
  }
  return { objects };
}

// ── GET /media — list public R2 objects (Gallery only, Edge-Cached) ───
mediaRouter.get("/", async (c) => {
  // SEC-DoW: Rate limit gallery listing (30 req/min per IP — list() is expensive)
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  if (c.env.DEV_BYPASS !== "true" && c.env.DEV_BYPASS !== "1" && !checkRateLimit(ip, 30, 60)) {
    return c.text("Too many requests", 429);
  }

  try {
    // SEC-DoW: Check Edge CDN cache — saves R2 list() Class B op + D1 query
    // @ts-expect-error — Cloudflare Workers runtime: caches.default is the global Edge Cache
    const cache = caches.default;
    const url = new URL(c.req.url);
    url.search = ""; // Strip query params to prevent cache-busting attacks (?nocache=1)
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const [objects, dbRes] = await Promise.all([
      listAllObjects(c.env.ARES_STORAGE),
      c.env.DB.prepare("SELECT key, folder, tags FROM media_tags WHERE folder = 'Gallery'").all().catch(() => ({ results: [] }))
    ]);

    const results = (dbRes.results || []) as { key: string, folder: string, tags: string }[];
    const metaMap = new Map();
    for (const row of results) {
      metaMap.set(row.key, { tags: row.tags });
    }

    const publicKeys = new Set(results.map(r => r.key));

    const merged = objects.objects
      .filter(obj => publicKeys.has((obj as { key: string }).key))
      .map(obj => {
        const key = (obj as { key: string }).key;
        return {
          ...obj,
          url: `/api/media/${key}`,
          folder: "Gallery",
          tags: metaMap.get(key)?.tags || ""
        };
      });

    const payload = { media: merged };
    // SEC-DoW: Edge-cache gallery for 5 min (replaces fragile per-isolate in-memory cache)
    const response = new Response(JSON.stringify(payload), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=300",
      },
    });
    c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

    return response;
  } catch (err) {
    console.error("R2 public list error:", err);
    return c.json({ error: "List failed", media: [] }, 500);
  }
});

// ── GET /admin/media — list all R2 objects (CMS Admins) ───────────────
adminMediaRouter.get("/", ensureAdmin, async (c) => {
  try {
    const [objects, dbRes] = await Promise.all([
      listAllObjects(c.env.ARES_STORAGE),
      c.env.DB.prepare("SELECT key, folder, tags FROM media_tags").all().catch(() => ({ results: [] }))
    ]);

    const metaMap = new Map();
    for (const row of (dbRes.results || []) as { key: string, folder: string, tags: string }[]) {
      metaMap.set(row.key, { folder: row.folder, tags: row.tags });
    }

    const merged = objects.objects.map(obj => ({
      ...obj,
      url: `/api/media/${(obj as { key: string }).key}`,
      ...metaMap.get((obj as { key: string }).key) || { folder: "Uncategorized", tags: "" }
    }));

    return c.json({ media: merged });
  } catch (err) {
    console.error("R2 admin list error:", err);
    return c.json({ error: "List failed", media: [] }, 500);
  }
});

// ── POST /admin/upload — File Upload via R2 & AI Image Accessibility ──
adminMediaRouter.post("/upload", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    const folder = (formData.get("folder") as string) || "Library";

    if (!file) {
      return c.json({ error: "No file uploaded" }, 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    
    // SEC-D02: Validate magic bytes to prevent malicious uploads spoofing extensions
    if (!isValidImage(arrayBuffer)) {
      return c.json({ error: "Invalid file type. Only PNG, JPEG, GIF, WEBP, and HEIC are permitted." }, 400);
    }

    const key = folder ? `${folder}/${file.name}` : file.name;

    // 1. Upload to Cloudflare R2
    await c.env.ARES_STORAGE.put(key, arrayBuffer, {
      httpMetadata: { contentType: file.type },
    });

    // 2. Automated AI Accessibility Tagging (LLava Vision)
    let altText = "ARES 23247 Team Media Image";
    try {
      if (c.env.AI) {
        if (arrayBuffer.byteLength > 2.5 * 1024 * 1024) {
          console.warn("Image exceeds Edge AI memory threshold. Falling back to generic alt text.");
        } else {
          // SCALE-F01: Use Uint8Array directly instead of Array.from to prevent isolate OOM
          const uint8 = new Uint8Array(arrayBuffer);
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

    // 3. Store Metadata in D1
    await c.env.DB.prepare(
      "INSERT OR REPLACE INTO media_tags (key, folder, tags) VALUES (?, ?, ?)"
    ).bind(key, folder, altText).run();

    // SEC-DoW: Purge public gallery cache on new upload
    // @ts-expect-error — Cloudflare Workers runtime
    c.executionCtx.waitUntil(caches.default.delete(new Request(new URL("/api/media", c.req.url).href, { method: "GET" })));

    return c.json({ 
      success: true, 
      key, 
      altText,
      url: `/api/media/${key}`
    });

  } catch (err) {
    console.error("R2 upload error:", err);
    return c.json({ error: "Upload failed" }, 500);
  }
});

// ── GET /media/:key — Serve raw object from R2 (with Access Control) ──
mediaRouter.get("/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  
  try {
    // SEC-DoW: Determine folder from key (e.g., "Gallery/image.png" -> "Gallery")
    const folder = key.includes("/") ? key.split("/")[0] : "Uncategorized";
    
    // SEC-F15: Folder-level access control
    // Files in the 'Gallery' and 'Library' folders are public. Everything else requires at least a login.
    const publicFolders = ["Gallery", "Library"];
    if (!publicFolders.includes(folder)) {
      const { getSessionUser } = await import("../middleware");
      const user = await getSessionUser(c);
      if (!user) {
        return c.text("Unauthorized: Access to this resource requires authentication.", 401);
      }
    }

    // SEC-DoW: Edge-cache individual public images (stripped of query params to prevent busting)
    const cache = caches.default;
    const url = new URL(c.req.url);
    url.search = "";
    const cacheKey = new Request(url.toString(), { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached && publicFolders.includes(folder)) return cached;

    const object = await c.env.ARES_STORAGE.get(key);
    if (!object) return c.text("Not Found", 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    
    // Cache individual images (Public = 1hr, Private = No Cache for security)
    if (publicFolders.includes(folder)) {
      headers.set("Cache-Control", "public, max-age=3600");
    } else {
      headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
    }

    const response = new Response(object.body, { headers });
    if (publicFolders.includes(folder)) {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (err) {
    console.error("R2 fetch error:", err);
    return c.text("Internal Server Error", 500);
  }
});

// ── PUT /media/move/:key — Move object to folder (Admin) ──────────────
adminMediaRouter.put("/move/:key{.+$}", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  const oldKey = c.req.param("key");
  const { folder } = await c.req.json();
  if (!folder) return c.json({ error: "Folder is required" }, 400);

  try {
    const object = await c.env.ARES_STORAGE.get(oldKey);
    if (!object) return c.json({ error: "Source not found" }, 404);

    const fileName = oldKey.split("/").pop();
    const newKey = `${folder}/${fileName}`;

    await c.env.ARES_STORAGE.put(newKey, object.body, {
      httpMetadata: { contentType: object.httpMetadata.contentType },
    });
    await c.env.ARES_STORAGE.delete(oldKey);

    // Update D1
    await c.env.DB.prepare(
      "UPDATE media_tags SET key = ?, folder = ? WHERE key = ?"
    ).bind(newKey, folder, oldKey).run();

    return c.json({ success: true, newKey });
  } catch (err) {
    console.error("R2 move error:", err);
    return c.json({ error: "Move failed" }, 500);
  }
});


// ── DELETE /media/:key — Delete object (Admin) ───────────────────────
adminMediaRouter.delete("/:key{.+$}", ensureAdmin, async (c) => {
  const key = c.req.param("key");
  try {
    await c.env.ARES_STORAGE.delete(key);
    await c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(key).run();
    return c.json({ success: true });
  } catch (err) {
    console.error("R2 delete error:", err);
    return c.json({ error: "Delete failed" }, 500);
  }
});

// ── POST /media/syndicate — Manual social broadcast of asset (Admin) ────
adminMediaRouter.post("/syndicate", ensureAdmin, rateLimitMiddleware(15, 60), async (c) => {
  try {
    const { key, caption } = await c.req.json();
    if (!key) return c.json({ error: "Key is required" }, 400);

    const config = await getDbSettings(c);
    
    const baseUrl = new URL(c.req.url).origin;
    const imageUrl = `${baseUrl}/api/media/${key}`;
    const { dispatchPhotoSocials } = await import("../../utils/socialSync");
    
    c.executionCtx.waitUntil(
      dispatchPhotoSocials(imageUrl, caption, config)
        .catch(err => console.error("[MediaSyndicate] Background failure:", err))
    );
    
    return c.json({ success: true, message: "Syndication dispatched to background" });
  } catch (err) {
    console.error("Syndicate dispatch error:", err);
    return c.json({ error: "Failed to dispatch syndication hook" }, 500);
  }
});

export { adminMediaRouter }; export default mediaRouter;
