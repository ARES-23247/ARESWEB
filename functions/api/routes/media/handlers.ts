import { AppEnv } from "../../middleware";
import { getDbSettings, checkPersistentRateLimit, logAuditAction } from "../../middleware";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";



// Maximum file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;
// Maximum file size for AI processing: 2.5MB
const MAX_FILE_SIZE_FOR_AI = 2.5 * 1024 * 1024;

// IN-11: File extension mapping for validation and normalization
// Maps MIME types to their canonical file extensions
const MIME_TO_EXTENSION: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/heic': '.heic',
  'image/heif': '.heif',
};

/**
 * Get the canonical file extension for a given MIME type.
 * Returns null if the MIME type is not supported.
 */
function getExtensionForMimeType(mimeType: string): string | null {
  return MIME_TO_EXTENSION[mimeType.toLowerCase()] || null;
}

/**
 * Normalize a filename by ensuring it has the correct extension for its MIME type.
 * If the filename already ends with the correct extension (case-insensitive), it's returned as-is.
 * Otherwise, the correct extension is appended.
 */
function normalizeFileNameExtension(fileName: string, mimeType: string): string {
  const correctExt = getExtensionForMimeType(mimeType);
  if (!correctExt) return fileName;

  // Check if filename already ends with the correct extension (case-insensitive)
  if (fileName.toLowerCase().endsWith(correctExt.toLowerCase())) {
    return fileName;
  }

  // Remove any existing extension and add the correct one
  const lastDotIndex = fileName.lastIndexOf('.');
  if (lastDotIndex > 0) {
    return fileName.substring(0, lastDotIndex) + correctExt;
  }

  return fileName + correctExt;
}

/**
 * Validates whether the given buffer contains a valid image file.
 * Checks magic bytes for PNG, JPEG, GIF, WEBP, SVG, and HEIC formats.
 * @param buffer - ArrayBuffer containing the file data
 * @returns true if the buffer starts with valid image magic bytes
 */
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
    if (header4 === '3c3f786d' || header4 === '3c737667') return true; // SVG (<?xm or <svg)
  }

  // HEIC/HEIF usually have 'ftyp' at offset 4, but let's check first 16 bytes for 'ftypheic' or similar
  const checkLen = Math.min(arr.length, 16);
  if (checkLen >= 8) {
    const longerHeader = Array.from(arr.subarray(0, checkLen)).map(b => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (longerHeader.includes('66747970')) return true; // 'ftyp'
  }

  // Fallback for SVGs that might have leading whitespace or comments
  const text = new TextDecoder("utf-8").decode(arr.subarray(0, 100));
  if (text.includes("<svg") || text.includes("<?xml")) return true;

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


export const mediaHandlers = {
  getMedia: async (c: any) => {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const ua = c.req.header("user-agent") || "unknown";
    const rl = await checkPersistentRateLimit(c.get("db") as Kysely<DB>, `media_list_${ip}`, ua, 30, 60);
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
        if (cached) return cached;
      }

      const db = c.get("db") as Kysely<DB>;
      const [objects, results] = await Promise.all([
        listAllObjects(c.env.ARES_STORAGE),
        db.selectFrom("media_tags").select(["key", "folder", "tags"]).where("folder", "=", "Gallery").execute()
      ]);

      const metaMap = new Map<string, { tags: string }>();
      for (const row of results) {
        if (row.key) metaMap.set(row.key, { tags: row.tags || "" });
      }

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
  adminList: async (c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const [objects, results] = await Promise.all([
        listAllObjects(c.env.ARES_STORAGE),
        db.selectFrom("media_tags").select(["key", "folder", "tags"]).execute()
      ]);

      const metaMap = new Map<string, { folder: string, tags: string }>();
      for (const row of results) {
        if (row.key) metaMap.set(row.key, { folder: row.folder || "", tags: row.tags || "" });
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

      return { status: 200, body: { media } };
    } catch (e) {
      console.error("[Media:AdminList] Error", e);
      return { status: 500, body: { error: "List failed", media: [] } };
    }
  },
  upload: async (c: any) => {
    try {
      const formData = await c.req.parseBody();
      const file = formData["file"] as File | null;
      const folder = formData["folder"] as string | null;

      if (!file || !(file instanceof File)) {
        return { status: 400, body: { error: "No valid file uploaded" } };
      }

      if (file.size > MAX_FILE_SIZE) {
        return {
          status: 413,
          body: { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` }
        };
      }

      const isLarge = file.size > MAX_FILE_SIZE_FOR_AI;
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

      const canonicalExtension = getExtensionForMimeType(file.type);
      if (!canonicalExtension) {
        return { status: 400, body: { error: `Unsupported image type: ${file.type}` } };
      }

      const normalizedName = normalizeFileNameExtension(file.name, file.type);
      const key = folder ? `${folder}/${normalizedName}` : normalizedName;
      const finalFolder = folder || "Library";

      if (c.env.ARES_STORAGE) {
        if (isLarge) {
          await c.env.ARES_STORAGE.put(key, file.stream(), { httpMetadata: { contentType: file.type } });
        } else {
          await c.env.ARES_STORAGE.put(key, buffer!, { httpMetadata: { contentType: file.type } });
        }
      }

      let altText = "ARES 23247 Team Media Image";
      const isAiSupported = ["image/jpeg", "image/png"].includes(file.type);
      if (isAiSupported && !isLarge && c.env.AI) {
        try {
          if (!buffer) buffer = await file.arrayBuffer();
          const uint8 = new Uint8Array(buffer);
          const aiRes = (await c.env.AI.run("@cf/llava-1.5-7b-hf", {
            prompt: "Describe for screen reader",
            image: [...uint8],
          })) as { description?: string };
          if (aiRes?.description) altText = String(aiRes.description).trim();
        } catch (err) {
          console.error("[Media:Upload] AI Error", err);
        }
      }

      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("media_tags")
        .values({ key, folder: finalFolder, tags: altText })
        .onConflict(oc => oc.column("key").doUpdateSet({ folder: finalFolder, tags: altText }))
        .execute();

      if (c.executionCtx) {
        c.executionCtx.waitUntil(logAuditAction(c, "media_upload", "media", key, `Uploaded to ${finalFolder}`));

        if (typeof caches !== 'undefined') {
          c.executionCtx.waitUntil((caches as any).default.delete(new Request(new URL("/api/media", c.req.url).href, { method: "GET" })));
        }
      }

      return { status: 200, body: { success: true, key, url: `/api/media/${key}`, altText } };
    } catch (err: unknown) {
      const error = err as Error;
      console.error("[Media:Upload] Error", error.stack || error);
      return { status: 500, body: { error: "Upload failed: " + (error.message || String(error)) } };
    }
  },
  move: async (c: any) => {
    const { key } = c.req.valid("param");
    const { folder } = c.req.valid("json");
    try {
      const fileName = key.split("/").pop();
      const newKey = `${folder}/${fileName}`;

      if (c.env.ARES_STORAGE) {
        const object = await c.env.ARES_STORAGE.get(key);
        if (!object) return { status: 404, body: { error: "Source not found" } };

        await c.env.ARES_STORAGE.put(newKey, object.body, { httpMetadata: { contentType: object.httpMetadata?.contentType } });
        await c.env.ARES_STORAGE.delete(key);

        const db = c.get("db") as Kysely<DB>;
        await db.updateTable("media_tags")
          .set({ key: newKey, folder })
          .where("key", "=", key)
          .execute();
      } else {
        const db = c.get("db") as Kysely<DB>;
        await db.updateTable("media_tags")
          .set({ key: newKey, folder })
          .where("key", "=", key)
          .execute();
      }

      c.executionCtx.waitUntil(logAuditAction(c, "media_move", "media", newKey, `Moved from ${key} to ${folder}`));
      return { status: 200, body: { success: true, newKey } };
    } catch (e) {
      console.error("[Media:Move] Error", e);
      return { status: 500, body: { error: "Move failed" } };
    }
  },
  delete: async (c: any) => {
    const { key } = c.req.valid("param");
    try {
      if (c.env.ARES_STORAGE) {
        await c.env.ARES_STORAGE.delete(key);
      }
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("media_tags").where("key", "=", key).execute();
      c.executionCtx.waitUntil(logAuditAction(c, "media_delete", "media", key));
      return { status: 200, body: { success: true } };
    } catch (e) {
      console.error("[Media:Delete] Error", e);
      return { status: 500, body: { error: "Delete failed" } };
    }
  },
  syndicate: async (c: any) => {
    try {
      const { key, caption } = c.req.valid("json");
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
