import { OpenAPIHono, createRoute } from "@hono/zod-openapi";
import type { AppEnv } from "../../../middleware/utils";
import { ensureAdmin, getDb } from "../../../middleware";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { ApiError } from "../../../middleware/errorHandler";
import { z } from "zod";
import { client as youtubeClient } from "../youtube";
import { standardErrors } from "../../../../shared/routes/common";

/**
 * Request schema for uploading Google Photos videos to YouTube
 */
const googlePhotosToYoutubeSchema = z.object({
  videos: z.array(z.object({
    id: z.string().openapi({ description: "Google Photos media item ID" }),
    baseUrl: z.string().url().openapi({ description: "Base URL for video download (valid for 60 minutes)" }),
    filename: z.string().openapi({ description: "Original filename" }),
    mimeType: z.string().openapi({ description: "MIME type of the video" }),
  })).min(1).openapi({ description: "Videos to upload from Google Photos" }),
  title: z.string().min(1).openapi({ description: "YouTube video title (will be numbered for batch)" }),
  description: z.string().optional().openapi({ description: "YouTube video description" }),
  privacyStatus: z.enum(["public", "unlisted", "private"]).optional().default("private").openapi({
    description: "Privacy status for uploaded videos",
  }),
  mediaType: z.enum(["video", "short"]).optional().default("video").openapi({
    description: "Media type (standard video or YouTube Short)",
  }),
});

/**
 * Response schema for Google Photos to YouTube upload
 */
const googlePhotosToYoutubeResponseSchema = z.object({
  results: z.array(z.object({
    googlePhotosId: z.string().openapi({ description: "Original Google Photos media item ID" }),
    filename: z.string().openapi({ description: "Original filename" }),
    status: z.enum(["success", "failed"]).openapi({ description: "Upload status" }),
    youtubeVideoId: z.string().optional().openapi({ description: "YouTube video ID (on success)" }),
    error: z.string().optional().openapi({ description: "Error message (on failure)" }),
  })).openapi({ description: "Per-video upload results" }),
  summary: z.object({
    total: z.number().openapi({ description: "Total videos processed" }),
    successful: z.number().openapi({ description: "Number of successful uploads" }),
    failed: z.number().openapi({ description: "Number of failed uploads" }),
  }).openapi({ description: "Upload summary" }),
});

/**
 * POST /picker/videos-to-youtube — Upload Google Photos videos to YouTube
 */
export const uploadGooglePhotosToYoutubeRoute = createRoute({
  method: "post",
  path: "/picker/videos-to-youtube",
  request: {
    body: {
      content: {
        "application/json": {
          schema: googlePhotosToYoutubeSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: googlePhotosToYoutubeResponseSchema,
        },
      },
      description: "Videos uploaded successfully with per-video results",
    },
  },
  tags: ["google-photos", "youtube", "admin"],
});

export const handler = async (c: any) => {
  const db = getDb(c);
  const env = c.env;
  const body = c.req.valid("json");

  const { videos, title, description = "", privacyStatus = "private", mediaType = "video" } = body;

  const token = await getUnifiedOAuthToken(env, db);

  const results = await Promise.all(videos.map(async (video, index) => {
    const googlePhotosId = video.id;
    const filename = video.filename;
    const baseUrl = video.baseUrl;
    const mimeType = video.mimeType;

    try {
      // Step 1: Download the video from Google Photos
      // Append =dv (download video) to get the actual video file
      const videoUrl = `${baseUrl}=dv`;

      const downloadResponse = await fetch(videoUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        signal: AbortSignal.timeout(300000), // 5 minute timeout per video
      });

      if (!downloadResponse.ok) {
        throw new Error(`Failed to download video from Google Photos: ${downloadResponse.statusText}`);
      }

      // Get file size from Content-Length header
      const contentLength = downloadResponse.headers.get("Content-Length");
      const fileSize = contentLength ? parseInt(contentLength, 10) : 0;

      // Step 2: Get YouTube resumable upload URL
      const videoTitle = videos.length > 1 ? `${title} (${index + 1}/${videos.length})` : title;
      const finalDescription = mediaType === "short" && !description.toLowerCase().includes("#shorts")
        ? `${description}\n\n#Shorts`
        : description;

      const resumableUrlResponse = await youtubeClient.youtube.resumable.$post({
        json: {
          title: videoTitle,
          description: finalDescription,
          privacyStatus,
          fileSize,
          mimeType: mimeType || "video/mp4",
        },
      });

      if (!resumableUrlResponse.ok) {
        const errorText = await resumableUrlResponse.text();
        throw new Error(`Failed to get YouTube resumable URL: ${errorText}`);
      }

      const { uploadUrl } = await resumableUrlResponse.json();

      // Step 3: Stream the video directly to YouTube
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Type": mimeType || "video/mp4",
        },
        body: downloadResponse.body, // Stream directly without buffering
        credentials: "omit",
        mode: "cors",
        signal: AbortSignal.timeout(600000), // 10 minute timeout for upload
      });

      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        let detail = uploadResponse.statusText;
        try {
          const res = JSON.parse(errorText);
          if (res.error?.message) detail = res.error.message;
        } catch {
          if (errorText) detail = errorText.substring(0, 200);
        }
        throw new Error(`YouTube upload failed: ${uploadResponse.status} ${detail}`);
      }

      // Step 4: Get the uploaded video ID
      const uploadedVideo = await uploadResponse.json() as {
        id: string;
        snippet?: { thumbnails?: { high?: { url?: string } } };
      };
      const youtubeVideoId = uploadedVideo.id;
      const thumbnailKey = uploadedVideo.snippet?.thumbnails?.high?.url || null;

      // Step 5: Sync to ARES dashboard database
      try {
        await youtubeClient.videos.admin.$post({
          json: {
            title: videoTitle,
            description: finalDescription,
            platform: "youtube",
            videoId: youtubeVideoId,
            thumbnailKey,
            type: mediaType,
            createBlogPost: false,
            crossPostSocial: false,
          }
        });
      } catch (dbError) {
        console.error("[GooglePhotos->YouTube] Failed to sync video to dashboard:", dbError);
        // Don't fail the upload if DB sync fails
      }

      return {
        googlePhotosId,
        filename,
        status: "success" as const,
        youtubeVideoId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error(`[GooglePhotos->YouTube] Failed to upload video ${googlePhotosId}:`, error);

      return {
        googlePhotosId,
        filename,
        status: "failed" as const,
        error: errorMessage,
      };
    }
  }));

  const summary = {
    total: results.length,
    successful: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
  };

  return c.json({
    results,
    summary,
  }, 200);
};
