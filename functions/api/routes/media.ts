import { Hono } from "hono";
import { AppEnv, ensureAdmin, getDbSettings, checkRateLimit } from "../middleware";
import { initServer, createHonoEndpoints } from "ts-rest-hono";
import { mediaContract } from "../../../src/schemas/contracts/mediaContract";

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
async function listAllObjects(bucket: R2Bucket, options?: R2ListOptions) {
  let result = await bucket.list(options);
  const objects = [...result.objects];
  while (result.truncated) {
    result = await bucket.list({ ...options, cursor: result.cursor });
    objects.push(...result.objects);
  }
  return { objects };
}
const mediaTsRestRouter: any = s.router(mediaContract as any, {
    getMedia: async (_: any, c: any) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    if (c.env.DEV_BYPASS !== "true" && !checkRateLimit(ip, 30, 60)) {
      return { status: 429 as const, body: "Too many requests" as any };
    }

    try {
            const cache = (caches as any).default;
      const url = new URL(c.req.url);
      url.search = "";
      const cacheKey = new Request(url.toString(), { method: "GET" });
      const cached = await cache.match(cacheKey);
      if (cached) return cached as any;

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
    upload: async (_: any, c: any) => {
    try {
      const formData = await c.req.parseBody();
      const file = formData["file"] as File;
      const folder = (formData["folder"] as string) || "Library";

      if (!file) return { status: 400 as const, body: { error: "No file uploaded" } };

      const arrayBuffer = await file.arrayBuffer();
      if (!isValidImage(arrayBuffer)) return { status: 400 as const, body: { error: "Invalid file type." } };

      const key = folder ? `${folder}/${file.name}` : file.name;
      await c.env.ARES_STORAGE.put(key, arrayBuffer, { httpMetadata: { contentType: file.type } });

      let altText = "ARES 23247 Team Media Image";
      if (c.env.AI && arrayBuffer.byteLength < 2.5 * 1024 * 1024) {
        try {
          const uint8 = new Uint8Array(arrayBuffer);
          const aiRes = await c.env.AI.run('@cf/llava-1.5-7b-hf', { prompt: 'Describe for screen reader', image: Array.from(uint8) }) as { description?: string };
          if (aiRes?.description) altText = String(aiRes.description).trim();
        } catch { /* fallback */ }
      }

      await c.env.DB.prepare("INSERT OR REPLACE INTO media_tags (key, folder, tags) VALUES (?, ?, ?)").bind(key, folder, altText).run();
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
      const object = await c.env.ARES_STORAGE.get(oldKey);
      if (!object) return { status: 404 as const, body: { error: "Source not found" } };

      const fileName = oldKey.split("/").pop();
      const newKey = `${folder}/${fileName}`;

      await c.env.ARES_STORAGE.put(newKey, object.body, { httpMetadata: { contentType: object.httpMetadata?.contentType } });
      await c.env.ARES_STORAGE.delete(oldKey);

      await c.env.DB.prepare("UPDATE media_tags SET key = ?, folder = ? WHERE key = ?").bind(newKey, folder, oldKey).run();

      return { status: 200 as const, body: { success: true, newKey } };
    } catch {
      return { status: 500 as const, body: { error: "Move failed" } };
    }
  },
    delete: async ({ params }: { params: any }, c: any) => {
    try {
      await c.env.ARES_STORAGE.delete(params.key);
      await c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(params.key).run();
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

// GET /media/:key — Serve raw object from R2
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
        const cache = (caches as any).default;
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
    if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=3600");
    else headers.set("Cache-Control", "no-store, no-cache, must-revalidate");

    const response = new Response(object.body, { headers });
    if (publicFolders.includes(folder)) c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  } catch {
    return c.text("Internal Error", 500);
  }
});

// Protections
mediaRouter.use("/admin/*", ensureAdmin);
mediaRouter.use("/admin", ensureAdmin);

createHonoEndpoints(mediaContract, mediaTsRestRouter, mediaRouter);

export default mediaRouter;
