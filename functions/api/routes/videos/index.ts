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
import { AppEnv, ensureAdmin, getDb, audit, logAuditAction } from "../../middleware";
import { eq } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import { findOneById, insertAndFetch, updateAndFetch } from "../../../../src/db/query-helpers";
import { postHandlers } from "../posts/handlers";
import { nanoid } from "nanoid";
import { getSessionUser } from "../../middleware";

const baseRouter = new OpenAPIHono<AppEnv>();

// Admin routes sub-router
const _adminRouter = new OpenAPIHono<AppEnv>();
_adminRouter.use("*", ensureAdmin);

/**
 * Parse a video URL to extract platform and video ID
 * Supports YouTube, Vimeo, and generic URLs
 */
function parseVideoUrl(url: string): { platform: "youtube" | "other"; videoId: string; embedUrl: string } {
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

    // Unknown platform - return URL as-is
    return { platform: "other", videoId: trimmedUrl, embedUrl: trimmedUrl };
}

const serializeVideo = (v: typeof schema.videos.$inferSelect): z.infer<typeof videoSchema> => {
    let embedUrl = v.videoId;
    if (v.platform === "youtube") {
        embedUrl = `https://www.youtube.com/embed/${v.videoId}`;
    } else if (!embedUrl.startsWith("http")) {
        embedUrl = `https://${embedUrl}`;
    }

    return {
        id: v.id,
        title: v.title,
        description: v.description ?? null,
        platform: v.platform as "youtube" | "other",
        videoId: v.videoId,
        thumbnailKey: v.thumbnailKey ?? null,
        thumbnailUrl: v.thumbnailKey ? `/api/media/${v.thumbnailKey}` : null,
        embedUrl,
        type: (v.type as "video" | "short") ?? "video",
        createdAt: v.createdAt ?? new Date().toISOString(),
        updatedAt: v.updatedAt ?? new Date().toISOString(),
    };
};

// GET / - List all videos (public)
const appRoutes = baseRouter.openapi(listVideosRoute, async (c) => {
    const db = getDb(c);
    const results = await db.select().from(schema.videos).orderBy(schema.videos.createdAt).execute();

    const videos = results.map(serializeVideo);

    return c.json({ videos }, 200);
})

    // GET /:id - Get a single video (public)
    .openapi(getVideoRoute, async (c) => {
        const { id } = c.req.valid("param");
        const db = getDb(c);
        const video = await findOneById<typeof schema.videos.$inferSelect>(db, schema.videos, id, "Video not found");

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
  const db = getDb(c);
  const user = await getSessionUser(c);

  try {
    const now = new Date().toISOString();
    
    // Auto-detect shorts if #shorts is in the title or description
    let type = body.type ?? "video";
    if (
      (body.title && body.title.toLowerCase().includes("#shorts")) ||
      (body.description && body.description.toLowerCase().includes("#shorts"))
    ) {
      type = "short";
    }

    const video = await insertAndFetch<typeof schema.videos.$inferSelect>(db, schema.videos, {
      title: body.title,
      description: body.description ?? null,
      platform: body.platform,
      videoId: body.videoId,
      thumbnailKey: body.thumbnailKey ?? null,
      type,
      createdAt: now,
      updatedAt: now,
    }, "vid_");

    audit(c, "video_create", "video", video.id, `Created video: ${body.title}`);

    // Handle Syndication
    if (body.createBlogPost) {
      // Create blog post with embedded video
      const ast = {
        type: "doc",
        content: [
          {
            type: "paragraph",
            content: body.description ? [{ type: "text", text: body.description }] : []
          },
          {
            type: "youtube",
            attrs: {
              src: `https://www.youtube.com/watch?v=${video.videoId}`
            }
          }
        ]
      };

      const postBody = {
        title: video.title,
        ast,
        isDraft: false,
        thumbnail: video.thumbnailKey ? `/api/media/${video.thumbnailKey}` : undefined,
        socials: body.crossPostSocial ? undefined : { discord: false, instagram: false, bluesky: false, facebook: false }
      };

      await postHandlers.savePost({ query: {}, params: {}, body: postBody }, c);
    } else if (body.crossPostSocial) {
      // Create generic social queue entry if no blog post is being generated
      await db.insert(schema.socialQueue).values({
        id: nanoid(),
        content: `${video.title}\n\nWatch our new video: https://youtu.be/${video.videoId}`,
        platforms: JSON.stringify({ bluesky: true, facebook: true }),
        status: "pending",
        scheduledFor: now,
        createdBy: user?.id || "system",
        linkedType: "video",
        linkedId: video.id,
        createdAt: now,
      }).execute();
    }

    return c.json({ video: serializeVideo(video) }, 200);
  } catch (error) {
    console.error("Failed to create video:", error);
    throw new ApiError(
      `Failed to create video: ${error instanceof Error ? error.message : "Unknown database error"}`,
      500,
      "VIDEO_CREATE_FAILED"
    );
  }
})

    // PATCH /:id - Update a video
    .openapi(updateVideoRoute, async (c) => {
      const { id } = c.req.valid("param");
      const body = c.req.valid("json");
      const db = getDb(c);

      try {
        const updates: Record<string, unknown> = {
          ...(body.title !== undefined && { title: body.title }),
          ...(body.description !== undefined && { description: body.description ?? null }),
          ...(body.platform !== undefined && { platform: body.platform }),
          ...(body.videoId !== undefined && { videoId: body.videoId }),
          ...(body.thumbnailKey !== undefined && { thumbnailKey: body.thumbnailKey ?? null }),
          ...(body.type !== undefined && { type: body.type }),
          updatedAt: new Date().toISOString(),
        };

        const video = await updateAndFetch<typeof schema.videos.$inferSelect>(db, schema.videos, id, updates);

        audit(c, "video_update", "video", id, `Updated video: ${body.title || video.title}`);

        return c.json({ video: serializeVideo(video) }, 200);
      } catch (error) {
        console.error("Failed to update video:", error);
        throw new ApiError(
          `Failed to update video: ${error instanceof Error ? error.message : "Unknown database error"}`,
          500,
          "VIDEO_UPDATE_FAILED"
        );
      }
    })

    // DELETE /:id - Delete a video
    .openapi(deleteVideoRoute, async (c) => {
      const { id } = c.req.valid("param");
      const db = getDb(c);

      try {
        const existing = await findOneById<typeof schema.videos.$inferSelect>(db, schema.videos, id, "Video not found");

        await db.delete(schema.videos).where(eq(schema.videos.id, id)).execute();
        audit(c, "video_delete", "video", id, `Deleted video: ${existing.title}`);

        return c.json({ success: true }, 200);
      } catch (error) {
        console.error("Failed to delete video:", error);
        throw new ApiError(
          `Failed to delete video: ${error instanceof Error ? error.message : "Unknown database error"}`,
          500,
          "VIDEO_DELETE_FAILED"
        );
      }
    })

    // POST /sync - Sync videos from YouTube
    .openapi(syncYoutubeVideosRoute, async (c) => {
        const db = getDb(c);
        const apiKey = c.env.YOUTUBE_API_KEY;

        if (!apiKey) {
            throw new ApiError("YouTube API Key not configured. Please add YOUTUBE_API_KEY to your environment variables.", 500, "YOUTUBE_API_KEY_MISSING");
        }

        const playlistId = "UUre4FN7UThyVd-biFk0n-Ig";
        let addedCount = 0;
        let deletedCount = 0;
        
        interface YouTubePlaylistItem {
            snippet: {
                title: string;
                description: string;
                publishedAt: string;
                resourceId?: {
                    videoId?: string;
                };
            };
        }
        const allItems: YouTubePlaylistItem[] = [];
        let nextPageToken: string | undefined = undefined;

        try {
            do {
                const pageTokenParam = nextPageToken ? `&pageToken=${nextPageToken}` : '';
                const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${pageTokenParam}`;
                const response = await fetch(url);

                if (!response.ok) {
                    const errText = await response.text();
                    console.error("YouTube API Error:", response.status, errText);
                    
                    let ytError: { error?: { errors?: Array<{ reason?: string; message?: string }>; message?: string; code?: number } } | undefined;
                    try { ytError = JSON.parse(errText); } catch { /* ignore */ }

                    const ytReason = ytError?.error?.errors?.[0]?.reason;
                    const ytMessage = ytError?.error?.message;

                    // Re-throw with our ApiError mappings
                    if (ytReason === "quotaExceeded" || ytReason === "dailyLimitExceeded") {
                        throw new ApiError("YouTube API quota exceeded.", 429, "YOUTUBE_QUOTA_EXCEEDED", { reason: ytReason });
                    } else if (response.status === 403) {
                        throw new ApiError("YouTube API access denied.", 403, "YOUTUBE_ACCESS_DENIED", { reason: ytReason });
                    }
                    throw new ApiError(`YouTube API error: ${ytMessage || response.statusText}`, response.status, "YOUTUBE_API_ERROR");
                }

                const data = await response.json() as { items?: YouTubePlaylistItem[]; nextPageToken?: string };
                if (data.items) {
                    allItems.push(...data.items);
                }
                nextPageToken = data.nextPageToken;

            } while (nextPageToken);
        } catch (error) {
            if (error instanceof ApiError) throw error;
            throw new ApiError("Failed to communicate with YouTube API", 500, "YOUTUBE_API_FAILED", { error: String(error) });
        }

        const existingVideos = await db.select({ videoId: schema.videos.videoId, id: schema.videos.id }).from(schema.videos).where(eq(schema.videos.platform, "youtube")).execute();
        const existingIds = new Set(existingVideos.map(v => v.videoId));
        
        // Track the video IDs we found on YouTube
        const fetchedVideoIds = new Set<string>();
        const newVideosToInsert = [];

        for (const item of allItems) {
            const snippet = item.snippet;
            const videoId = snippet.resourceId?.videoId;

            if (!videoId) continue;
            fetchedVideoIds.add(videoId);

            if (!existingIds.has(videoId)) {
                const id = `vid_${crypto.randomUUID?.() || Math.random().toString(36).substring(2)}`;
                
                const titleStr = (snippet.title || "").toLowerCase();
                const descStr = (snippet.description || "").toLowerCase();
                const isShort = titleStr.includes("#shorts") || descStr.includes("#shorts");

                newVideosToInsert.push({
                    id,
                    title: snippet.title,
                    description: snippet.description || null,
                    platform: "youtube" as const,
                    videoId: videoId,
                    thumbnailKey: null,
                    type: isShort ? "short" : "video",
                    createdAt: snippet.publishedAt,
                    updatedAt: new Date().toISOString()
                });

                existingIds.add(videoId);
            }
        }

        if (newVideosToInsert.length > 0) {
            await db.insert(schema.videos).values(newVideosToInsert).execute();
            addedCount = newVideosToInsert.length;
        }

        // Delete videos that are no longer in the playlist
        const videosToDelete = existingVideos.filter(v => !fetchedVideoIds.has(v.videoId));
        if (videosToDelete.length > 0) {
            // Drizzle 'inArray' works, but we can do a loop or bulk delete. Let's do a bulk delete if inArray is imported, or loop since it's safer.
            for (const vid of videosToDelete) {
                await db.delete(schema.videos).where(eq(schema.videos.id, vid.id)).execute();
            }
            deletedCount = videosToDelete.length;
        }

        if (c.executionCtx && (addedCount > 0 || deletedCount > 0)) {
            c.executionCtx.waitUntil(logAuditAction(c, "youtube_sync", "video", null, `Synced YouTube: added ${addedCount}, deleted ${deletedCount} videos`));
        }

        return c.json({ success: true, added: addedCount, deleted: deletedCount, total: allItems.length }, 200);
    });

// Mount admin router at /admin
export const videosRouter = appRoutes.route("/admin", adminApp);

export default videosRouter;
