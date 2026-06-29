import express, { Response } from "express";
import rateLimit from "express-rate-limit";
import { ensureAuth, AuthenticatedRequest } from "../middleware/auth";
import { adminDb } from "../lib/firebase-admin";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import { logger } from "../lib/logger";

const router = express.Router();

export const videosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(videosLimiter);

// Helper to get YouTube API key from settings collection or process.env
async function getYoutubeApiKey(): Promise<string | undefined> {
  try {
    const docSnap = await adminDb.collection("settings").doc("YOUTUBE_API_KEY").get();
    if (docSnap.exists) {
      const data = docSnap.data();
      if (data?.value) return data.value;
    }
  } catch (err) {
    logger.error("videos", "Failed to fetch YOUTUBE_API_KEY from settings collection", { error: err });
  }
  return process.env.YOUTUBE_API_KEY;
}

// POST /api/videos/sync
router.post("/sync", ensureAuth, asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    throw new ApiError(401, "Unauthorized");
  }

  // Check user role
  const userDoc = await adminDb.collection("authorized_users").doc(req.user.uid).get();
  if (!userDoc.exists) {
    throw new ApiError(403, "Forbidden: User not authorized");
  }
  
  const userData = userDoc.data();
  if (userData?.role !== "admin" && userData?.role !== "coach" && userData?.role !== "mentor") {
    throw new ApiError(403, "Forbidden: Insufficient privileges");
  }

  const apiKey = await getYoutubeApiKey();
  if (!apiKey) {
    throw new ApiError(400, "YouTube API key is not configured in settings");
  }

  const playlistId = "UUre4FN7UThyVd-biFk0n-Ig";
  const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}`;

  let response: globalThis.Response;
  try {
    response = await fetch(url);
  } catch (err: any) {
    logger.error("videos", "Failed to contact YouTube API", { error: err.message });
    throw new ApiError(500, "Failed to connect to YouTube API");
  }

  if (!response.ok) {
    const errText = await response.text();
    logger.error("videos", "YouTube API response error", { status: response.status, body: errText });
    throw new ApiError(400, `YouTube API error: ${response.statusText}`);
  }

  const data = await response.json();
  const items = data.items || [];

  const playlistVideoIds = new Set<string>();
  let addedUpdatedCount = 0;

  for (const item of items) {
    const snippet = item.snippet;
    const videoId = snippet?.resourceId?.videoId;
    if (!videoId) continue;

    const videoDocId = `video_${videoId}`;
    playlistVideoIds.add(videoDocId);

    const title = snippet.title || "";
    const description = snippet.description || "";
    const platform = "youtube";
    const thumbnailUrl = snippet.thumbnails?.maxres?.url || 
                         snippet.thumbnails?.standard?.url || 
                         snippet.thumbnails?.high?.url || 
                         snippet.thumbnails?.medium?.url || 
                         snippet.thumbnails?.default?.url || 
                         "";
    const embedUrl = `https://www.youtube.com/embed/${videoId}`;
    
    // Determine video type (shorts vs standard video)
    const isShort = title.toLowerCase().includes("#shorts") || 
                    description.toLowerCase().includes("#shorts") ||
                    title.toLowerCase().includes("#short") || 
                    description.toLowerCase().includes("#short");
    const type = isShort ? "short" : "video";
    
    const createdAt = snippet.publishedAt || new Date().toISOString();

    await adminDb.collection("videos").doc(videoDocId).set({
      title,
      description,
      platform,
      videoId,
      thumbnailUrl,
      embedUrl,
      type,
      createdAt,
    }, { merge: true });

    addedUpdatedCount++;
  }

  // Remove videos of platform 'youtube' that are no longer in the playlist
  const existingVideosQuery = await adminDb.collection("videos").where("platform", "==", "youtube").get();
  let deletedCount = 0;

  for (const doc of existingVideosQuery.docs) {
    if (!playlistVideoIds.has(doc.id)) {
      await adminDb.collection("videos").doc(doc.id).delete();
      deletedCount++;
    }
  }

  res.json({
    success: true,
    addedUpdatedCount,
    deletedCount,
  });
}));

export default router;
