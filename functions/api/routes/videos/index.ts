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
  syncYoutubeVideosRoute,
  type videoSchema,
} from "@shared/routes/videos";
import { AppEnv, ensureAdmin, getDb, logAuditAction } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { findOne, findMany, insertOne, updateOne, deleteOneAndReturn, logAudit } from "../../utils/drizzle-helpers";

const baseRouter = new OpenAPIHono<AppEnv>();

// Admin routes sub-router
const _adminRouter = new OpenAPIHono<AppEnv>();
_adminRouter.use("*", ensureAdmin);

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
  let embedUrl = v.videoId;
  if (v.platform === "youtube") {
    embedUrl = `https://www.youtube.com/embed/${v.videoId}`;
  } else if (v.platform === "vimeo") {
    embedUrl = `https://player.vimeo.com/video/${v.videoId}`;
  } else if (!embedUrl.startsWith("http")) {
    embedUrl = `https://${embedUrl}`;
  }

  return {
    id: v.id,
    title: v.title,
    description: v.description ?? null,
    platform: v.platform as "youtube" | "vimeo" | "other",
    videoId: v.videoId,
    thumbnailKey: v.thumbnailKey ?? null,
    thumbnailUrl: v.thumbnailKey ? `/api/media/${v.thumbnailKey}` : null,
    embedUrl,
    createdAt: v.createdAt ?? new Date().toISOString(),
    updatedAt: v.updatedAt ?? new Date().toISOString(),
  };
};

// GET / - List all videos (public)
const appRoutes = baseRouter.openapi(listVideosRoute, async (c) => {
  const videos = await findMany(c, schema.videos, {
    orderBy: schema.videos.createdAt,
  });

  return c.json({ videos: videos.map(serializeVideo) }, 200);
})

// GET /:id - Get a single video (public)
.openapi(getVideoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const video = await findOne(c, schema.videos, id);

  return c.json({ video: serializeVideo(video) }, 200);
})

// POST /parse-url - Parse a video URL (public, for editor convenience)
.openapi(parseVideoUrlRoute, async (c) => {
  const { url } = c.req.valid("json");

  const parsed = parseVideoUrl(url);

  return c.json(parsed, 200);
});

// Admin routes - mounted at /admin
// POST / - Create a video
const adminApp = _adminRouter.openapi(createVideoRoute, async (c) => {
  const body = c.req.valid("json");

  const video = await insertOne(c, schema.videos, {
    title: body.title,
    description: body.description ?? null,
    platform: body.platform,
    videoId: body.videoId,
    thumbnailKey: body.thumbnailKey ?? null,
  }, { idPrefix: "vid_" });

  logAudit(c, "video_create", "video", video.id, `Created video: ${body.title}`);

  return c.json({ video: serializeVideo(video) }, 200);
})

// PATCH /:id - Update a video
.openapi(updateVideoRoute, async (c) => {
  const { id } = c.req.valid("param");
  const body = c.req.valid("json");

  const updates: Record<string, unknown> = {
    ...(body.title !== undefined && { title: body.title }),
    ...(body.description !== undefined && { description: body.description ?? null }),
    ...(body.platform !== undefined && { platform: body.platform }),
    ...(body.videoId !== undefined && { videoId: body.videoId }),
    ...(body.thumbnailKey !== undefined && { thumbnailKey: body.thumbnailKey ?? null }),
    updatedAt: new Date().toISOString(),
  };

  const video = await updateOne(c, schema.videos, id, updates);

  logAudit(c, "video_update", "video", id, `Updated video: ${body.title || video.title}`);

  return c.json({ video: serializeVideo(video) }, 200);
})

// DELETE /:id - Delete a video
.openapi(deleteVideoRoute, async (c) => {
  const { id } = c.req.valid("param");

  const video = await deleteOneAndReturn(c, schema.videos, id);

  logAudit(c, "video_delete", "video", id, `Deleted video: ${video.title}`);

  return c.json({ success: true }, 200);
})

// POST /sync - Sync videos from YouTube
.openapi(syncYoutubeVideosRoute, async (c) => {
  const db = getDb(c);
  const apiKey = c.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    throw new ApiError("YouTube API Key not configured. Please add YOUTUBE_API_KEY to your environment variables.", 500, "YOUTUBE_API_KEY_MISSING");
  }

  // ARESFTC Uploads playlist ID (replace UC with UU in the channel ID)
  const playlistId = "UUre4FN7UThyVd-biFk0n-Ig";
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;

  let addedCount = 0;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error("YouTube API Error:", response.status, errText);

      // Parse YouTube API error for better error messages
      let ytError: { error?: { errors?: Array<{ reason?: string; message?: string }>; message?: string; code?: number } } | undefined;
      try {
        ytError = JSON.parse(errText);
      } catch {
        // Failed to parse error JSON, fall back to status text
      }

      const ytReason = ytError?.error?.errors?.[0]?.reason;
      const ytMessage = ytError?.error?.message;

      // Map common YouTube API errors to user-friendly messages
      switch (ytReason) {
        case "quotaExceeded":
        case "dailyLimitExceeded":
          throw new ApiError(
            "YouTube API quota exceeded. The daily limit has been reached. Try again tomorrow or contact an admin to increase the quota.",
            429,
            "YOUTUBE_QUOTA_EXCEEDED",
            { reason: ytReason, originalMessage: ytMessage }
          );
        case "keyInvalid":
          throw new ApiError(
            "YouTube API key is invalid. Please check the YOUTUBE_API_KEY environment variable.",
            500,
            "YOUTUBE_API_KEY_INVALID",
            { reason: ytReason, originalMessage: ytMessage }
          );
        case "forbidden":
          throw new ApiError(
            "Access to the YouTube playlist is forbidden. The API key may not have access to this resource.",
            403,
            "YOUTUBE_ACCESS_FORBIDDEN",
            { reason: ytReason, originalMessage: ytMessage }
          );
        case "playlistNotFound":
          throw new ApiError(
            "YouTube playlist not found. The playlist ID may be incorrect or the playlist may have been deleted.",
            404,
            "YOUTUBE_PLAYLIST_NOT_FOUND",
            { reason: ytReason, originalMessage: ytMessage }
          );
        default:
          if (response.status === 403) {
            throw new ApiError(
              `YouTube API access denied: ${ytMessage || response.statusText}`,
              403,
              "YOUTUBE_ACCESS_DENIED",
              { reason: ytReason, originalMessage: ytMessage }
            );
          }
          if (response.status === 404) {
            throw new ApiError(
              `YouTube resource not found: ${ytMessage || response.statusText}`,
              404,
              "YOUTUBE_NOT_FOUND",
              { reason: ytReason, originalMessage: ytMessage }
            );
          }
          throw new ApiError(
            `YouTube API error (${response.status}): ${ytMessage || response.statusText}`,
            response.status,
            "YOUTUBE_API_ERROR",
            { reason: ytReason, originalMessage: ytMessage, status: response.status }
          );
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any = await response.json();

    // Check for YouTube API errors in response body
    if (data.error) {
      console.error("YouTube API Error in response:", data.error);
      const ytReason = data.error.errors?.[0]?.reason;
      const ytMessage = data.error.message;

      throw new ApiError(
        `YouTube API error: ${ytMessage || data.error.code}`,
        500,
        "YOUTUBE_API_ERROR",
        { reason: ytReason, details: data.error }
      );
    }

    const items = data.items || [];

    // Fetch existing video IDs to prevent duplicates
    const existingVideos = await findMany(c, schema.videos, {
      where: eq(schema.videos.platform, "youtube"),
    });
    const existingIds = new Set(existingVideos.map((v) => v.videoId));

    const newVideosToInsert = [];

    for (const item of items) {
      const snippet = item.snippet;
      const videoId = snippet.resourceId?.videoId;

      if (!videoId) {
        console.warn("Skipping item without videoId:", item);
        continue;
      }

      if (!existingIds.has(videoId)) {
        const id = `vid_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`;

        newVideosToInsert.push({
          id,
          title: snippet.title,
          description: snippet.description || null,
          platform: "youtube" as const,
          videoId: videoId,
          thumbnailKey: null,
          createdAt: snippet.publishedAt,
          updatedAt: new Date().toISOString()
        });

        existingIds.add(videoId);
      }
    }

    if (newVideosToInsert.length > 0) {
      await db.insert(schema.videos).values(newVideosToInsert).execute();
      addedCount = newVideosToInsert.length;

      logAudit(c, "youtube_sync", "video", null, `Synced ${addedCount} new videos from YouTube`);
    }

    return c.json({ success: true, added: addedCount, total: items.length }, 200);
  } catch (error) {
    console.error("Error syncing YouTube videos:", error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      `An unexpected error occurred during YouTube sync: ${error instanceof Error ? error.message : String(error)}`,
      500,
      "YOUTUBE_SYNC_ERROR"
    );
  }
});

// Mount admin router at /admin
export const videosRouter = appRoutes.route("/admin", adminApp);

export default videosRouter;
