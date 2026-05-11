import { z } from "zod";
import { OpenAPIHono } from "@hono/zod-openapi";
import { ApiError } from "../../middleware/errorHandler";
import {
  listVideosRoute,
  getVideoRoute,
  parseVideoUrlRoute,
  createVideoRoute,
  updateVideoRoute,
  deleteVideoRoute,
  type videoSchema,
} from "@shared/routes/videos";
import { AppEnv, ensureAdmin, getDb, logAuditAction } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";

export const videosRouter = new OpenAPIHono<AppEnv>();

// Protections
videosRouter.use("/admin/*", ensureAdmin);
videosRouter.use("/admin", ensureAdmin);

/**
 * Parse a video URL to extract platform and video ID
 * Supports YouTube, Vimeo, and generic URLs
 */
function parseVideoUrl(url: string): { platform: "youtube" | "vimeo" | "other"; videoId: string; embedUrl: string } {
  const trimmedUrl = url.trim();

  // YouTube: youtube.com/watch?v=ID or youtu.be/ID
  const ytWatchMatch = trimmedUrl.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/);
  if (ytWatchMatch) {
    return { platform: "youtube", videoId: ytWatchMatch[1], embedUrl: `https://www.youtube.com/embed/${ytWatchMatch[1]}` };
  }

  // YouTube shorts: youtube.com/shorts/ID
  const ytShortsMatch = trimmedUrl.match(/youtube\.com\/shorts\/([a-zA-Z0-9_-]+)/);
  if (ytShortsMatch) {
    return { platform: "youtube", videoId: ytShortsMatch[1], embedUrl: `https://www.youtube.com/embed/${ytShortsMatch[1]}` };
  }

  // YouTube embed: youtube.com/embed/ID
  const ytEmbedMatch = trimmedUrl.match(/youtube\.com\/embed\/([a-zA-Z0-9_-]+)/);
  if (ytEmbedMatch) {
    return { platform: "youtube", videoId: ytEmbedMatch[1], embedUrl: `https://www.youtube.com/embed/${ytEmbedMatch[1]}` };
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vimeoMatch = trimmedUrl.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)(\d+)/);
  if (vimeoMatch) {
    return { platform: "vimeo", videoId: vimeoMatch[1], embedUrl: `https://player.vimeo.com/video/${vimeoMatch[1]}` };
  }

  // Unknown platform - return URL as-is
  return { platform: "other", videoId: trimmedUrl, embedUrl: trimmedUrl };
}

const serializeVideo = (v: typeof schema.videos.$inferSelect): z.infer<typeof videoSchema> => {
  const parsed = parseVideoUrl(v.videoId);
  return {
    id: v.id,
    title: v.title,
    description: v.description ?? null,
    platform: v.platform as "youtube" | "vimeo" | "other",
    videoId: v.videoId,
    thumbnailKey: v.thumbnailKey ?? null,
    thumbnailUrl: v.thumbnailKey ? `/api/media/${v.thumbnailKey}` : null,
    embedUrl: parsed.embedUrl,
    createdAt: v.createdAt ?? new Date().toISOString(),
    updatedAt: v.updatedAt ?? new Date().toISOString(),
  };
};

// GET /videos - List all videos (public)
export const finalVideosRouter = videosRouter.openapi(listVideosRoute, async (c) => {
  const db = getDb(c);
  const results = await db.select().from(schema.videos).orderBy(schema.videos.createdAt).execute();

  const videos = results.map(serializeVideo);

  return c.json({ videos }, 200);
})

// GET /videos/:id - Get a single video (public)
.openapi(getVideoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const result = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).execute();

  if (result.length === 0) {
    throw new ApiError("Video not found", 404, "NOT_FOUND");
  }

  return c.json({ video: serializeVideo(result[0]) }, 200);
})

// POST /videos/parse-url - Parse a video URL (public, for editor convenience)
.openapi(parseVideoUrlRoute, async (c) => {
  const { url } = c.req.valid("json");

  const parsed = parseVideoUrl(url);

  return c.json(parsed, 200);
})

// POST /videos/admin - Create a video (admin only)
.openapi(createVideoRoute, async (c) => {
  const body = c.req.valid("json");
  const db = getDb(c);

  const id = `vid_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`;

  const newVideo = {
    id,
    title: body.title,
    description: body.description ?? null,
    platform: body.platform,
    videoId: body.videoId,
    thumbnailKey: body.thumbnailKey ?? null,
  };

  await db.insert(schema.videos).values(newVideo).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "video_create", "video", id, `Created video: ${body.title}`));
  }

  const result = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).execute();

  return c.json({ video: serializeVideo(result[0]) }, 200);
})

// PUT /videos/admin/:id - Update a video (admin only)
.openapi(updateVideoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");
  const db = getDb(c);

  const existing = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).execute();

  if (existing.length === 0) {
    throw new ApiError("Video not found", 404, "NOT_FOUND");
  }

  const updates: Record<string, unknown> = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description ?? null }),
    ...(body.platform !== undefined && { platform: body.platform }),
    ...(body.videoId !== undefined && { videoId: body.videoId }),
    ...(body.thumbnailKey !== undefined && { thumbnailKey: body.thumbnailKey ?? null }),
    updatedAt: new Date().toISOString(),
  };

  await db.update(schema.videos).set(updates).where(eq(schema.videos.id, id)).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "video_update", "video", id, `Updated video: ${body.title || existing[0].title}`));
  }

  const result = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).execute();

  return c.json({ video: serializeVideo(result[0]) }, 200);
})

// DELETE /videos/admin/:id - Delete a video (admin only)
.openapi(deleteVideoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const db = getDb(c);

  const existing = await db.select().from(schema.videos).where(eq(schema.videos.id, id)).execute();

  if (existing.length === 0) {
    throw new ApiError("Video not found", 404, "NOT_FOUND");
  }

  await db.delete(schema.videos).where(eq(schema.videos.id, id)).execute();

  if (c.executionCtx) {
    c.executionCtx.waitUntil(logAuditAction(c, "video_delete", "video", id, `Deleted video: ${existing[0].title}`));
  }

  return c.json({ success: true }, 200);
});

export default finalVideosRouter;
