import { Hono } from "hono";
import { AppEnv, ensureAdmin, getDbSettings, checkRateLimit, logAuditAction } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { mediaContract } from "../../../shared/schemas/contracts/mediaContract";

const s = initServer<AppEnv>();
export const mediaRouter = new Hono<AppEnv>();

// SEC-D02: Magic byte validation helper
function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer).subarray(0, 4);
  const header = arr.reduce((acc, b) => acc + b.toString(16).padStart(2, '0'), '');
  
  if (header === '89504e47') return true; // PNG
  if (header.startsWith('ffd8ff')) return true; // JPEG
  if (header.startsWith('47494638')) return true; // GIF
  if (header === '52494646') return true; // WEBP
  if (header.includes('66747970')) return true; // HEIC

  return false;
}

// SCA-F01: Recursive R2 Listing Helper
async function listAllObjects(bucket: R2Bucket | undefined, options?: R2ListOptions) {
  if (!bucket) {
    console.warn("[media.ts] R2Bucket not bound! Returning empty list.");
    return { objects: [] };
  }
  // PERF-M01: Limit results to avoid timeouts on large buckets
  let result = await bucket.list({ ...options, limit: 100 });
  const objects = [...result.objects];
  while (result.truncated) {
    result = await bucket.list({ ...options, cursor: result.cursor, limit: 100 });
    objects.push(...result.objects);
  }
  return { objects };
}
export const mediaTsRestRouter: any = s.router(mediaContract as any, {
    getMedia: async (_: any, c: any) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const ua = c.req.header("user-agent") || "unknown";
    if (c.env.DEV_BYPASS !== "true" && !checkRateLimit(ip, ua, 30, 60)) {
      return { status: 429 as const, body: "Too many requests" as any };
    }

    try {
      // ECON-RCF-01: Runtime Cache Fallback for portability
      const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
      const url = new URL(c.req.url);
      url.search = "";
      const cacheKey = new Request(url.toString(), { method: "GET" });
      
      if (cache) {
        const cached = await cache.match(cacheKey);
        if (cached) return cached as any;
      }

      const [objects, dbRes] = await Promise.all([
        listAllObjects(c.env.ARES_STORAGE),
        c.env.DB.prepare("SELECT key, folder, tags FROM media_tags WHERE folder = 'Gallery'").all().catch(() => ({ results: [] }))
      ]);

      const results = (dbRes.results || []) as { key: string, folder: string, tags: string }[];
      const metaMap = new Map<string, { tags: string }>();
      for (const row of results) { metaMap.set(row.key, { tags: row.tags }); }

      const publicKeys = new Set(results.map(r => r.key));

      const media = objects.objects
        .filter(obj => publicKeys.has(obj.key))
        .map(obj => ({
          key: obj.key,
          size: obj.size,
          uploaded: obj.uploaded.toISOString(),
          url: `/api/media/${obj.key}`,
          httpEtag: obj.httpEtag,
          folder: "Gallery" as const,
          tags: metaMap.get(obj.key)?.tags || ""
        }));

      const payload = { media };
      const response = new Response(JSON.stringify(payload), {
        headers: { "Content-Type": "application/json", "Cache-Control": "public, max-age=300", "Vary": "Accept" },
      });
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));

      return { status: 200 as const, body: payload };
    } catch {
      return { status: 500 as const, body: { error: "List failed", media: [] } };
    }
  },
    adminList: async (_: any, c: any) => {
    try {
      const [objects, dbRes] = await Promise.all([
        listAllObjects(c.env.ARES_STORAGE),
        c.env.DB.prepare("SELECT key, folder, tags FROM media_tags").all().catch(() => ({ results: [] }))
      ]);

      const metaMap = new Map<string, { folder: string, tags: string }>();
      for (const row of (dbRes.results || []) as { key: string, folder: string, tags: string }[]) {
        metaMap.set(row.key, { folder: row.folder, tags: row.tags });
      }

      const media = objects.objects.map(obj => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        url: `/api/media/${obj.key}`,
        httpEtag: obj.httpEtag,
        ...metaMap.get(obj.key) || { folder: "Uncategorized", tags: "" }
      }));

      return { status: 200 as const, body: { media: media as any[] } };
    } catch {
      return { status: 500 as const, body: { error: "List failed", media: [] } };
    }
  },
    upload: async ({ body }: { body: any }, c: any) => {
    try {
      const formData = body instanceof FormData ? body : await c.req.parseBody();
      const file = formData.get ? formData.get("file") as File : formData["file"] as File;
      const folder = (formData.get ? formData.get("folder") as string : formData["folder"] as string) || "Library";

      if (!file) return { status: 400 as const, body: { error: "No file uploaded" } };

      const isLarge = file.size > 10 * 1024 * 1024;
      let buffer: ArrayBuffer | null = null;
      let headerBuffer: ArrayBuffer;
      
      if (!isLarge) {
        buffer = await file.arrayBuffer();
        headerBuffer = buffer.slice(0, 1024);
      } else {
        // Use small slice for type validation to avoid memory spike on large files
        headerBuffer = await file.slice(0, 1024).arrayBuffer();
      }
      
      if (!isValidImage(headerBuffer)) return { status: 400 as const, body: { error: "Invalid file type." } };

      const key = folder ? `${folder}/${file.name}` : file.name;
      if (c.env.ARES_STORAGE) {
        if (isLarge) {
          // Note: file.stream() might have issues if file.slice() partially consumed it in some CF worker versions
          await c.env.ARES_STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        } else {
          await c.env.ARES_STORAGE.put(key, buffer!, { httpMetadata: { contentType: file.type } });
        }
      } else {
        console.warn("[media.ts] R2Bucket not bound! Skipping physical upload.");
      }

      let altText = "ARES 23247 Team Media Image";
      const isAiSupported = ["image/jpeg", "image/png"].includes(file.type);
      if (isAiSupported && !isLarge && c.env.AI && (buffer || file.size < 2.5 * 1024 * 1024)) {
        try {
          if (!buffer) buffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          // SCA-M01: Pass Uint8Array directly to avoid Array.from memory exhaustion
          const aiRes = await c.env.AI.run('@cf/llava-1.5-7b-hf', { prompt: 'Describe for screen reader', image: uint8 as any }) as { description?: string };
          if (aiRes?.description) altText = String(aiRes.description).trim();
        } catch { /* fallback */ }
      }

      await c.env.DB.prepare("INSERT OR REPLACE INTO media_tags (key, folder, tags) VALUES (?, ?, ?)").bind(key, folder, altText).run();
      
      c.executionCtx.waitUntil(logAuditAction(c, "media_upload", "media", key, `Uploaded to ${folder}`));
      
      if (c.executionCtx?.waitUntil) {
        c.executionCtx.waitUntil((caches as any).default.delete(new Request(new URL("/api/media", c.req.url).href, { method: "GET" })));
      }

      return { status: 200 as const, body: { success: true, key, url: `/api/media/${key}`, altText } };
    } catch (err) {
      console.error("UPLOAD ERROR", err);
      return { status: 500 as const, body: { error: "Upload failed" } };
    }
  },
    move: async ({ params, body }: { params: any, body: any }, c: any) => {
    const oldKey = params.key;
    const { folder } = body;
    try {
      const fileName = oldKey.split("/").pop();
      const newKey = `${folder}/${fileName}`;

      if (c.env.ARES_STORAGE) {
        const object = await c.env.ARES_STORAGE.get(oldKey);
        if (!object) return { status: 404 as const, body: { error: "Source not found" } };

        await c.env.ARES_STORAGE.put(newKey, object.body, { httpMetadata: { contentType: object.httpMetadata?.contentType } });
        await c.env.ARES_STORAGE.delete(oldKey);
        
        await c.env.DB.prepare("UPDATE media_tags SET key = ?, folder = ? WHERE key = ?").bind(newKey, folder, oldKey).run();
      } else {
        await c.env.DB.prepare("UPDATE media_tags SET key = ?, folder = ? WHERE key = ?").bind(newKey, folder, oldKey).run();
      }
      
      c.executionCtx.waitUntil(logAuditAction(c, "media_move", "media", newKey, `Moved from ${oldKey} to ${folder}`));
      return { status: 200 as const, body: { success: true, newKey } };
    } catch {
      return { status: 500 as const, body: { error: "Move failed" } };
    }
  },
    delete: async ({ params }: { params: any }, c: any) => {
    try {
      if (c.env.ARES_STORAGE) {
        await c.env.ARES_STORAGE.delete(params.key);
      }
      await c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(params.key).run();
      c.executionCtx.waitUntil(logAuditAction(c, "media_delete", "media", params.key));
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Delete failed" } };
    }
  },
    syndicate: async ({ body }: { body: any }, c: any) => {
    try {
      const { key, caption } = body;
      const config = await getDbSettings(c);
      const baseUrl = new URL(c.req.url).origin;
      const imageUrl = `${baseUrl}/api/media/${key}`;
      const { dispatchPhotoSocials } = await import("../../utils/socialSync");
      
      c.executionCtx.waitUntil(dispatchPhotoSocials(imageUrl, caption || "", config));
      return { status: 200 as const, body: { success: true, message: "Dispatched" } };
    } catch {
      return { status: 500 as const, body: { error: "Syndicate failed" } };
    }
  },
} as any);

// Note: raw object route is now mounted AFTER ts-rest endpoints

// Protections
mediaRouter.use("/admin/*", ensureAdmin);
mediaRouter.use("/admin", ensureAdmin);

createHonoEndpoints(mediaContract, mediaTsRestRouter, mediaRouter);

// GET /media/:key — Serve raw object from R2 (Must be after createHonoEndpoints to avoid catching /admin)
mediaRouter.get("/:key{.+$}", async (c: any) => {
  const key = c.req.param("key");
  try {
    const folder = key.includes("/") ? key.split("/")[0] : "Uncategorized";
    const publicFolders = ["Gallery", "Library"];
    if (!publicFolders.includes(folder)) {
      const { getSessionUser } = await import("../middleware");
      const user = await getSessionUser(c);
      if (!user) return c.text("Unauthorized", 401);
    }
    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
    const url = new URL(c.req.url);
    url.search = "";
    const cacheKey = new Request(url.toString(), { method: "GET" });
    
    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached && publicFolders.includes(folder)) return cached;
    }

    if (!c.env.ARES_STORAGE) return c.text("R2 Not Bound", 404);
    
    const object = await c.env.ARES_STORAGE.get(key);
    if (!object) return c.text("Not Found", 404);

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);
    if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
    else headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    const response = new Response(object.body, { headers });
    if (publicFolders.includes(folder)) c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return c.text("Internal Error", 500);
  }
});

export default mediaRouter;
