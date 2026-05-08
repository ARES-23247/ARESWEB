import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "../../middleware/errorHandler";
import {
  getMediaRoute,
  getAdminMediaRoute,
  uploadMediaRoute,
  moveMediaRoute,
  deleteMediaRoute,
  syndicateMediaRoute
} from "../../../../shared/routes/media";
import { AppEnv, ensureAdmin, getSessionUser, checkPersistentRateLimit, logAuditAction, getDb, getDbSettings } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { typedHandler } from "../../utils/handler";
import { errorResponses } from "../../../../shared/errors/api";
import type { R2Bucket, R2Object, R2ListOptions } from "@cloudflare/workers-types";

export const mediaRouter = new OpenAPIHono<AppEnv>();

// Protections
mediaRouter.use("/admin/*", ensureAdmin);
mediaRouter.use("/admin", ensureAdmin);

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
function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer);

  if (arr.length >= 8) {
    const header8 = Array.from(arr.subarray(0, 8)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header8 === '89504e470d0a1a0a') return true; // PNG
  }

  if (arr.length >= 4) {
    const header4 = Array.from(arr.subarray(0, 4)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (header4.startsWith('ffd8ff') || header4 === 'ffd8ffe0' || header4 === 'ffd8ffe1') return true; // JPEG
    if (header4.startsWith('47494638')) return true; // GIF
    if (header4 === '52494646') return true; // WEBP
    if (header4 === '3c3f786d' || header4 === '3c737667') return true; // SVG (<?xm or <svg)
  }

  // HEIC/HEIF usually have 'ftyp' at offset 4, but let's check first 16 bytes for 'ftypheic' or similar
  const checkLen = Math.min(arr.length, 16);
  if (checkLen >= 8) {
    const longerHeader = Array.from(arr.subarray(0, checkLen)).map((b: number) => b.toString(16).padStart(2, '0')).join('').toLowerCase();
    if (longerHeader.includes('66747970')) return true; // 'ftyp'
  }

  // Fallback for SVGs that might have leading whitespace or comments
  const text = new TextDecoder("utf-8").decode(arr.subarray(0, 100));
  if (text.includes("<svg") || text.includes("<?xml")) return true;

  return false;
}

type MediaTagRow = {
  key: string;
  folder: string | null;
  tags: string | null;
};

interface ListAllObjectsResult {
  objects: R2Object[];
}

async function listAllObjects(bucket: R2Bucket | undefined, options?: R2ListOptions): Promise<ListAllObjectsResult> {
  if (!bucket) {
    console.warn("[media] R2Bucket not bound! Returning empty list.");
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

// Register OpenAPI routes with typedHandler
mediaRouter.openapi(getMediaRoute, typedHandler<typeof getMediaRoute>(async (c) => {
  const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
  const ua = c.req.header("user-agent") || "unknown";
  const rl = await checkPersistentRateLimit(getDb(c), `media_list_${ip}`, ua, 30, 60);
  if (!rl) {
    throw new ApiError("Too many requests", 429, "RATE_LIMIT_EXCEEDED");
  }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cloudflare Cache API is not in standard types
    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;
    const url = new URL(c.req.url);
    url.search = "";
    const cacheKey = new Request(url.toString(), { method: "GET" });

    if (cache) {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
    }

    const db = getDb(c);
    const [objects, results] = await Promise.all([
      listAllObjects(c.env.ARES_STORAGE),
      db.select({
        key: schema.mediaTags.key,
        folder: schema.mediaTags.folder,
        tags: schema.mediaTags.tags
      })
      .from(schema.mediaTags)
      .where(eq(schema.mediaTags.folder, "Gallery"))
      .execute()
    ]);

    const metaMap = new Map<string, { tags: string }>();
    for (const row of results) {
      if (row.key) metaMap.set(row.key, { tags: row.tags || "" });
    }

    const publicKeys = new Set(results.map((r: MediaTagRow) => r.key));

    const media = objects.objects
      .filter((obj: R2Object) => publicKeys.has(obj.key))
      .map((obj: R2Object) => ({
        key: obj.key,
        size: obj.size,
        uploaded: obj.uploaded.toISOString(),
        url: `/api/media/${obj.key}`,
        httpEtag: obj.httpEtag,
        folder: "Gallery",
        tags: metaMap.get(obj.key)?.tags || ""
      }));

    const response = c.json({ media }, 200);
    response.headers.set("Cache-Control", "public, max-age=300");
    response.headers.set("Vary", "Accept");
    if (cache && c.executionCtx) {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }

    return response;
}));

mediaRouter.openapi(getAdminMediaRoute, typedHandler<typeof getAdminMediaRoute>(async (c) => {
    const db = getDb(c);
    const [objects, results] = await Promise.all([
      listAllObjects(c.env.ARES_STORAGE),
      db.select({
        key: schema.mediaTags.key,
        folder: schema.mediaTags.folder,
        tags: schema.mediaTags.tags
      })
      .from(schema.mediaTags)
      .execute()
    ]);

    const metaMap = new Map<string, { folder: string, tags: string }>();
    for (const row of results) {
      if (row.key) metaMap.set(row.key, { folder: row.folder || "", tags: row.tags || "" });
    }

    const media = objects.objects.map((obj: R2Object) => ({
      key: obj.key,
      size: obj.size,
      uploaded: obj.uploaded.toISOString(),
      url: `/api/media/${obj.key}`,
      httpEtag: obj.httpEtag,
      folder: metaMap.get(obj.key)?.folder || "Uncategorized",
      tags: metaMap.get(obj.key)?.tags || ""
    }));

    return c.json({ media }, 200);
}));

mediaRouter.openapi(uploadMediaRoute, typedHandler<typeof uploadMediaRoute>(async (c) => {
    const formData = await c.req.parseBody();
    const file = formData["file"] as File | undefined;
    const folder = formData["folder"] as string | undefined;

    if (!file || !(file instanceof File)) {
      throw new ApiError("No valid file uploaded", 400, "VALIDATION_ERROR");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new ApiError(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`, 400);
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
      throw new ApiError("Invalid file type. Only standard images are supported.", 400, "VALIDATION_ERROR");
    }

    const canonicalExtension = getExtensionForMimeType(file.type);
    if (!canonicalExtension) {
      throw new ApiError(`Unsupported image type: ${file.type}`, 400);
    }

    const normalizedName = normalizeFileNameExtension(file.name, file.type);
    const key = folder ? `${folder}/${normalizedName}` : normalizedName;
    const finalFolder = folder || "Library";

    if (c.env.ARES_STORAGE) {
      if (isLarge) {
        await c.env.ARES_STORAGE.put(key, file.stream() as any, { httpMetadata: { contentType: file.type } });
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
        type AiResponse = { description?: string };
        const aiRes = await c.env.AI.run("@cf/llava-1.5-7b-hf", {
          prompt: "Describe for screen reader",
          image: [...uint8],
        }) as AiResponse;
        if (aiRes?.description) altText = String(aiRes.description).trim();
      } catch (err) {
        console.error("[Media:Upload] AI Error", err);
      }
    }

    const db = getDb(c);
    await db.insert(schema.mediaTags)
      .values({ key, folder: finalFolder, tags: altText })
      .onConflictDoUpdate({
        target: schema.mediaTags.key,
        set: { folder: finalFolder, tags: altText }
      })
      .execute();

    if (c.executionCtx) {
      c.executionCtx.waitUntil(logAuditAction(c, "media_upload", "media", key, `Uploaded to ${finalFolder}`));

      if (typeof caches !== 'undefined') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cloudflare Cache API is not in standard types
        c.executionCtx.waitUntil((caches as any).default.delete(new Request(new URL("/api/media", c.req.url).href, { method: "GET" })));
      }
    }

    return c.json({ success: true, key, url: `/api/media/${key}`, altText }, 200);
}));

mediaRouter.openapi(moveMediaRoute, typedHandler<typeof moveMediaRoute>(async (c) => {
  const { key } = c.req.valid("param");
  const { folder } = c.req.valid("json");

    const fileName = key.split("/").pop();
    if (!fileName) {
      throw new ApiError("Invalid key format", 400, "VALIDATION_ERROR");
    }
    const newKey = `${folder}/${fileName}`;

    if (c.env.ARES_STORAGE) {
      const object = await c.env.ARES_STORAGE.get(key);
      if (!object) throw new ApiError("Source file", 404, "NOT_FOUND");

      await c.env.ARES_STORAGE.put(newKey, object.body, { httpMetadata: { contentType: object.httpMetadata?.contentType } });
      await c.env.ARES_STORAGE.delete(key);

      const db = getDb(c);
      await db.update(schema.mediaTags)
        .set({ key: newKey, folder })
        .where(eq(schema.mediaTags.key, key))
        .execute();
    } else {
      const db = getDb(c);
      await db.update(schema.mediaTags)
        .set({ key: newKey, folder })
        .where(eq(schema.mediaTags.key, key))
        .execute();
    }

    if (c.executionCtx) {
      c.executionCtx.waitUntil(logAuditAction(c, "media_move", "media", newKey, `Moved from ${key} to ${folder}`));
    }

    return c.json({ success: true, newKey }, 200);
}));

mediaRouter.openapi(deleteMediaRoute, typedHandler<typeof deleteMediaRoute>(async (c) => {
  const { key } = c.req.valid("param");

    if (c.env.ARES_STORAGE) {
      await c.env.ARES_STORAGE.delete(key);
    }
    const db = getDb(c);
    await db.delete(schema.mediaTags).where(eq(schema.mediaTags.key, key)).execute();
    if (c.executionCtx) {
      c.executionCtx.waitUntil(logAuditAction(c, "media_delete", "media", key));
    }
    return c.json({ success: true }, 200);
}));

mediaRouter.openapi(syndicateMediaRoute, typedHandler<typeof syndicateMediaRoute>(async (c) => {
  const { key, caption } = c.req.valid("json");

    const config = await getDbSettings(c);
    const baseUrl = new URL(c.req.url).origin;
    const imageUrl = `${baseUrl}/api/media/${key}`;
    const { dispatchPhotoSocials } = await import("../../../utils/socialSync");

    if (c.executionCtx) {
      c.executionCtx.waitUntil(dispatchPhotoSocials(imageUrl, caption || "", config));
    }

    return c.json({ success: true, message: "Dispatched" }, 200);
}));

// GET /media/:key - Serve raw object from R2 (This is NOT an OpenAPI route because it returns binary/raw data)
mediaRouter.get("/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  try {
    const folder = key.includes("/") ? key.split("/")[0] : "Uncategorized";
    const publicFolders = ["Gallery", "Library"];
    if (!publicFolders.includes(folder)) {
      const user = await getSessionUser(c);
      if (!user) {
        throw new ApiError("Unauthorized", 401);
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cloudflare Cache API is not in standard types
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
    if (!object || !object.body) return c.text("Not Found", 404);

    const headers = new Headers();

    object.writeHttpMetadata(headers as any);
    headers.set("etag", object.httpEtag);
    if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=2592000, stale-while-revalidate=86400");
    else headers.set("Cache-Control", "no-store, no-cache, must-revalidate");


    const response = new Response(object.body as any, { headers });
    if (cache && publicFolders.includes(folder) && c.executionCtx) {
      c.executionCtx.waitUntil(cache.put(cacheKey, response.clone()));
    }
    return response;
  } catch (e) {
    console.error("[Media:Raw] Error", e);
    throw new ApiError("Internal Error", 500);
  }
});

export default mediaRouter;
