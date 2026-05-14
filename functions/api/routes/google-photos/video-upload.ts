import { getDb } from "../../middleware";
import { getUnifiedOAuthToken } from "../../../utils/googleAuth";
import { ApiError } from "../../middleware/errorHandler";
import * as schema from "../../../../src/db/schema";

import { uploadGooglePhotosToYoutubeRoute } from "../../../../shared/routes/google-photos";

// Re-export the route from the shared types
export { uploadGooglePhotosToYoutubeRoute };

type GooglePhotosVideo = {
  id: string;
  baseUrl: string;
  filename: string;
  mimeType: string;
};

/**
 * Get YouTube resumable upload URL
 * Based on the implementation in routes/youtube/index.ts
 */
async function getYouTubeResumableUrl(
  accessToken: string,
  title: string,
  description: string,
  privacyStatus: string,
  fileSize: number,
  mimeType: string,
  origin: string
): Promise<string> {
  const metadata = {
    snippet: {
      title,
      description,
    },
    status: {
      privacyStatus,
    },
  };

  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": fileSize.toString(),
        "X-Upload-Content-Type": mimeType,
        "Origin": origin,
      },
      body: JSON.stringify(metadata),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Failed to initiate resumable upload session:", errorText);
    throw new ApiError("Failed to initiate YouTube upload session.", 500, "YOUTUBE_SESSION_FAILED");
  }

  const uploadUrl = response.headers.get("Location");
  if (!uploadUrl) {
    throw new ApiError("YouTube did not provide a resumable upload URL.", 500, "YOUTUBE_SESSION_FAILED");
  }

  return uploadUrl;
}

import type { RouteHandler } from "@hono/zod-openapi";
import type { AppEnv } from "../../middleware/utils";

export const handler: RouteHandler<typeof uploadGooglePhotosToYoutubeRoute, AppEnv> = async (c) => {
  const db = getDb(c);
  const env = c.env;
  const body = c.req.valid("json");

  const { videos, title, description = "", privacyStatus = "private", mediaType = "video" } = body;

  const token = await getUnifiedOAuthToken(env, db);

  const results = await Promise.all(
    videos.map(async (video: GooglePhotosVideo, index: number) => {
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
        const finalDescription =
          mediaType === "short" && !description.toLowerCase().includes("#shorts")
            ? `${description}\n\n#Shorts`
            : description;

        const origin = new URL(c.req.url).origin;
        const uploadUrl = await getYouTubeResumableUrl(
          token,
          videoTitle,
          finalDescription,
          privacyStatus,
          fileSize,
          mimeType || "video/mp4",
          origin
        );

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
        const uploadedVideo = (await uploadResponse.json()) as {
          id: string;
          snippet?: { thumbnails?: { high?: { url?: string } } };
        };
        const youtubeVideoId = uploadedVideo.id;
        const thumbnailKey = uploadedVideo.snippet?.thumbnails?.high?.url || null;

        // Step 5: Sync to ARES dashboard database
        try {
          const now = new Date().toISOString();
          await db
            .insert(schema.videos)
            .values({
              id: `vid_${crypto.randomUUID()}`,
              title: videoTitle,
              description: finalDescription,
              platform: "youtube",
              videoId: youtubeVideoId,
              thumbnailKey,
              type: mediaType,
              createdAt: now,
              updatedAt: now,
            })
            .execute();
        } catch (dbError) {
          console.error("[GooglePhotos->YouTube] Failed to sync video to dashboard:", dbError);
          // Don't fail the upload if DB sync fails
        }

        return {
          googlePhotosId,
          filename,
          status: ("success" as const),
          youtubeVideoId,
        };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error";
        console.error(`[GooglePhotos->YouTube] Failed to upload video ${googlePhotosId}:`, error);

        return {
          googlePhotosId,
          filename,
          status: ("failed" as const),
          error: errorMessage,
        };
      }
    })
  );

  interface UploadResult {
    googlePhotosId: string;
    filename: string;
    status: "success" | "failed";
    youtubeVideoId?: string;
    error?: string;
  }

  const summary = {
    total: results.length,
    successful: results.filter((r: UploadResult) => r.status === "success").length,
    failed: results.filter((r: UploadResult) => r.status === "failed").length,
  };

  return c.json(
    {
      results,
      summary,
    },
    200
  );
};
