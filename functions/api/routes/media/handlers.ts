
import { AppEnv, getDbSettings, checkRateLimit, logAuditAction } from "../../middleware";
import { initServer } from "ts-rest-hono";

const _s = initServer<AppEnv>();


export function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer);
  
  if (arr.length >= 8) {
    const header8 = Array.from(arr.subarray(0, 8)).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header8 === '89504e470d0a1a0a') return true; // PNG
  }
  
  if (arr.length >= 4) {
    const header4 = Array.from(arr.subarray(0, 4)).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header4.startsWith('ffd8ff') || header4 === 'ffd8ffe0' || header4 === 'ffd8ffe1') return true; // JPEG
    if (header4.startsWith('47494638')) return true; // GIF
    if (header4 === '52494646') return true; // WEBP
  }
  
  // HEIC/HEIF usually have 'ftyp' at offset 4, but let's check first 16 bytes for 'ftypheic' or similar
  const checkLen = Math.min(arr.length, 16);
  if (checkLen >= 8) {
    const longerHeader = Array.from(arr.subarray(0, checkLen)).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (longerHeader.includes('66747970')) return true; // 'ftyp'
  }

  return false;
}

async function listAllObjects(bucket: R2Bucket | undefined, options?: R2ListOptions) {
  if (!bucket) {
    console.warn("[media/handlers.ts] R2Bucket not bound! Returning empty list.");
    return { objects: [] };
  }
  let result = await bucket.list({ ...options, limit: 100 });
  const objects = [...result.objects];
  while (result.truncated) {
    result = await bucket.list({ ...options, cursor: result.cursor, limit: 100 });
    objects.push(...result.objects);
  }
  return { objects };
}

export const mediaHandlers: any = {
  getMedia: async (_input: any, c: any) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const ua = c.req.header("user-agent") || "unknown";
    const rl = await checkRateLimit(c, `media_list_${ip}_${ua}`, 30, 60);
    if (!rl) {
      return { status: 429, body: { error: "Rate limit exceeded", media: [] } };
    }

    try {
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
        c.env.DB.prepare("SELECT key, folder, tags FROM media_tags WHERE folder = 'Gallery'").all()
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
      if (cache && c.executionCtx) {
        c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
      }

      return { status: 200, body: payload };
    } catch (e) {
      console.error("[Media:GetMedia] Error", e);
      return { status: 500, body: { error: "List failed", media: [] } };
    }
  },
  adminList: async (_input: any, c: any) => {
    try {
      const [objects, dbRes] = await Promise.all([
        listAllObjects(c.env.ARES_STORAGE),
        c.env.DB.prepare("SELECT key, folder, tags FROM media_tags").all()
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
        folder: metaMap.get(obj.key)?.folder || "Uncategorized",
        tags: metaMap.get(obj.key)?.tags || ""
      }));

      return { status: 200, body: { media: media as any[] } };
    } catch (e) {
      console.error("[Media:AdminList] Error", e);
      return { status: 500, body: { error: "List failed", media: [] } };
    }
  },
  upload: async (input: any, c: any) => {
    try {
      const { body } = input;
      const formData = body as any;
      const file = formData.file as File;
      const folder = (formData.folder as string) || "Library";

      if (!file) return { status: 400, body: { error: "No file uploaded" } };

      const isLarge = file.size > 10 * 1024 * 1024;
      let buffer: ArrayBuffer | null = null;
      let headerBuffer: ArrayBuffer;
      
      if (!isLarge) {
        buffer = await file.arrayBuffer();
        headerBuffer = buffer.slice(0, 1024);
      } else {
        headerBuffer = await file.slice(0, 1024).arrayBuffer();
      }
      
      if (!isValidImage(headerBuffer)) {
        return { status: 400, body: { error: "Invalid file type. Only standard images are supported." } };
      }

      const key = folder ? `${folder}/${file.name}` : file.name;
      if (c.env.ARES_STORAGE) {
        if (isLarge) {
          await c.env.ARES_STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        } else {
          await c.env.ARES_STORAGE.put(key, buffer!, { httpMetadata: { contentType: file.type } });
        }
      }

      let altText = "ARES 23247 Team Media Image";
      const isAiSupported = ["image/jpeg", "image/png"].includes(file.type);
      if (isAiSupported && !isLarge && c.env.AI && (buffer || file.size < 2.5 * 1024 * 1024)) {
        try {
          if (!buffer) buffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          const aiRes = await c.env.AI.run('@cf/llava-1.5-7b-hf', { prompt: 'Describe for screen reader', image: uint8 as any }) as { description?: string };
          if (aiRes?.description) altText = String(aiRes.description).trim();
        } catch (err) { 
          console.error("[Media:Upload] AI Error", err);
        }
      }

      await c.env.DB.prepare("INSERT OR REPLACE INTO media_tags (key, folder, tags) VALUES (?, ?, ?)").bind(key, folder, altText).run();
      
      if (c.executionCtx) {
        c.executionCtx.waitUntil(logAuditAction(c, "media_upload", "media", key, `Uploaded to ${folder}`));
        
        if (typeof caches !== 'undefined') {
          c.executionCtx.waitUntil((caches as any).default.delete(new Request(new URL("/api/media", c.req.url).href, { method: "GET" })));
        }
      }

      return { status: 200, body: { success: true, key, url: `/api/media/${key}`, altText } };
    } catch (err) {
      console.error("[Media:Upload] Error", err);
      return { status: 500, body: { error: "Upload failed" } };
    }
  },
  move: async (input: any, c: any) => {
    const { params, body } = input;
    const oldKey = params.key;
    const { folder } = body;
    try {
      const fileName = oldKey.split("/").pop();
      const newKey = `${folder}/${fileName}`;

      if (c.env.ARES_STORAGE) {
        const object = await c.env.ARES_STORAGE.get(oldKey);
        if (!object) return { status: 404, body: { error: "Source not found" } };

        await c.env.ARES_STORAGE.put(newKey, object.body, { httpMetadata: { contentType: object.httpMetadata?.contentType } });
        await c.env.ARES_STORAGE.delete(oldKey);
        
        await c.env.DB.prepare("UPDATE media_tags SET key = ?, folder = ? WHERE key = ?").bind(newKey, folder, oldKey).run();
      } else {
        await c.env.DB.prepare("UPDATE media_tags SET key = ?, folder = ? WHERE key = ?").bind(newKey, folder, oldKey).run();
      }
      
      c.executionCtx.waitUntil(logAuditAction(c, "media_move", "media", newKey, `Moved from ${oldKey} to ${folder}`));
      return { status: 200, body: { success: true, newKey } };
    } catch (e) {
      console.error("[Media:Move] Error", e);
      return { status: 500, body: { error: "Move failed" } };
    }
  },
  delete: async (input: any, c: any) => {
    const { params } = input;
    try {
      if (c.env.ARES_STORAGE) {
        await c.env.ARES_STORAGE.delete(params.key);
      }
      await c.env.DB.prepare("DELETE FROM media_tags WHERE key = ?").bind(params.key).run();
      c.executionCtx.waitUntil(logAuditAction(c, "media_delete", "media", params.key));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Media:Delete] Error", e);
      return { status: 500, body: { error: "Delete failed" } };
    }
  },
  syndicate: async (input: any, c: any) => {
    try {
      const { body } = input;
      const { key, caption } = body;
      const config = await getDbSettings(c);
      const baseUrl = new URL(c.req.url).origin;
      const imageUrl = `${baseUrl}/api/media/${key}`;
      const { dispatchPhotoSocials } = await import("../../../utils/socialSync");
      
      c.executionCtx.waitUntil(dispatchPhotoSocials(imageUrl, caption || "", config));
      return { status: 200, body: { success: true, message: "Dispatched" } };
    } catch (e) {
      console.error("[Media:Syndicate] Error", e);
      return { status: 500, body: { error: "Syndicate failed" } };
    }
  },
};
