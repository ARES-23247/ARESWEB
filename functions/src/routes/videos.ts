import express from "express";
import rateLimit from "express-rate-limit";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { adminDb } from "../lib/firebase-admin";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import { logger } from "../lib/logger";

const router = express.Router();
const TEAM_UPLOADS_PLAYLIST_ID = "UUre4FN7UThyVd-biFk0n-Ig";
const SYNC_SOURCE = "youtube-playlist";
const MAX_PLAYLIST_PAGES = 20;
const BATCH_SIZE = 400;
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;

type VideoType = "video" | "short";
type VideoStatus = "draft" | "published";

interface VideoRecord {
  title?: unknown;
  description?: unknown;
  videoId?: unknown;
  thumbnailUrl?: unknown;
  type?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted?: unknown;
  archivedAt?: unknown;
  syncSource?: unknown;
  sourcePlaylistId?: unknown;
}

interface VideoInput {
  title?: unknown;
  description?: unknown;
  videoId?: unknown;
  thumbnailUrl?: unknown;
  type?: unknown;
  status?: unknown;
}

interface YoutubeThumbnail { url?: string }
interface YoutubePlaylistItem {
  snippet?: {
    title?: string;
    description?: string;
    publishedAt?: string;
    resourceId?: { videoId?: string };
    thumbnails?: Record<string, YoutubeThumbnail | undefined>;
  };
}
interface YoutubePlaylistResponse { items?: YoutubePlaylistItem[]; nextPageToken?: string }

export const videosLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many video requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(videosLimiter);

function boundedText(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new ApiError(400, `${field} must be text.`);
  const clean = value.trim();
  if (required && !clean) throw new ApiError(400, `${field} is required.`);
  if (clean.length > max) throw new ApiError(400, `${field} must be ${max} characters or fewer.`);
  return clean;
}

function parseVideoId(value: unknown): string {
  const input = boundedText(value, "YouTube video", 300, true);
  if (YOUTUBE_ID_PATTERN.test(input)) return input;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(400, "Enter a valid YouTube URL or 11-character video ID.");
  }
  const host = url.hostname.toLowerCase().replace(/^www\./, "");
  let id = "";
  if (host === "youtu.be") id = url.pathname.split("/").filter(Boolean)[0] || "";
  if (["youtube.com", "m.youtube.com"].includes(host)) {
    if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else {
      const [route, routeId] = url.pathname.split("/").filter(Boolean);
      if (["embed", "shorts", "live"].includes(route)) id = routeId || "";
    }
  }
  if (!YOUTUBE_ID_PATTERN.test(id)) throw new ApiError(400, "Enter a valid YouTube URL or 11-character video ID.");
  return id;
}

function validateThumbnail(value: unknown, videoId: string): string {
  const input = boundedText(value, "Thumbnail URL", 1_000);
  if (!input) return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new ApiError(400, "Thumbnail URL must be a valid HTTPS URL.");
  }
  const allowedHosts = new Set([
    "img.youtube.com",
    "i.ytimg.com",
    "firebasestorage.googleapis.com",
    "storage.googleapis.com",
  ]);
  if (url.protocol !== "https:" || !allowedHosts.has(url.hostname)) {
    throw new ApiError(400, "Thumbnail URL must use an approved YouTube or team storage host.");
  }
  return url.toString();
}

function parseInput(input: VideoInput): {
  title: string;
  description: string;
  videoId: string;
  thumbnailUrl: string;
  type: VideoType;
  status: VideoStatus;
} {
  const videoId = parseVideoId(input.videoId);
  const type = input.type === "short" ? "short" : input.type === "video" || input.type === undefined ? "video" : null;
  if (!type) throw new ApiError(400, "Video type must be video or short.");
  const status = input.status === "published" ? "published" : input.status === "draft" || input.status === undefined ? "draft" : null;
  if (!status) throw new ApiError(400, "Video status must be draft or published.");
  return {
    title: boundedText(input.title, "Title", 180, true),
    description: boundedText(input.description, "Description", 2_000),
    videoId,
    thumbnailUrl: validateThumbnail(input.thumbnailUrl, videoId),
    type,
    status,
  };
}

function toVideoDto(id: string, data: VideoRecord) {
  const videoId = typeof data.videoId === "string" && YOUTUBE_ID_PATTERN.test(data.videoId) ? data.videoId : "";
  let thumbnailUrl = "";
  if (videoId) {
    try {
      thumbnailUrl = validateThumbnail(data.thumbnailUrl, videoId);
    } catch {
      thumbnailUrl = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
  }
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled video",
    description: typeof data.description === "string" ? data.description : "",
    platform: "youtube" as const,
    videoId,
    thumbnailUrl,
    watchUrl: videoId ? `https://www.youtube.com/watch?v=${videoId}` : "",
    embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : "",
    type: data.type === "short" ? "short" as const : "video" as const,
    status: data.status === "published" ? "published" as const : "draft" as const,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    isArchived: data.isDeleted === 1,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : undefined,
  };
}

function parseLimit(raw: unknown, fallback: number, max: number): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
}

async function applyCursor(query: FirebaseFirestore.Query, cursor: unknown): Promise<FirebaseFirestore.Query> {
  if (typeof cursor !== "string" || !cursor) return query;
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(cursor)) throw new ApiError(400, "Invalid video cursor.");
  const snapshot = await adminDb.collection("videos").doc(cursor).get();
  if (!snapshot.exists) throw new ApiError(400, "Video cursor was not found.");
  return query.startAfter(snapshot);
}

router.get("/public", asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, 24, 50);
  let query: FirebaseFirestore.Query = adminDb.collection("videos")
    .where("status", "==", "published")
    .where("isDeleted", "==", 0)
    .orderBy("createdAt", "desc");
  query = await applyCursor(query, req.query.cursor);
  const snapshot = await query.limit(limit + 1).get();
  const visible = snapshot.docs.filter((doc) => doc.data().isDeleted !== 1);
  const page = visible.slice(0, limit);
  res.json({
    videos: page.map((doc) => toVideoDto(doc.id, doc.data())),
    hasMore: snapshot.docs.length > limit,
    nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1]?.id ?? null : null,
  });
}));

router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, 30, 50);
  const includeArchived = req.query.includeArchived === "true";
  let query: FirebaseFirestore.Query = adminDb.collection("videos").orderBy("createdAt", "desc");
  query = await applyCursor(query, req.query.cursor);
  const snapshot = await query.limit(limit + 1).get();
  const records = snapshot.docs.filter((doc) => includeArchived || doc.data().isDeleted !== 1);
  const page = records.slice(0, limit);
  res.json({
    videos: page.map((doc) => toVideoDto(doc.id, doc.data())),
    hasMore: snapshot.docs.length > limit,
    nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1]?.id ?? null : null,
  });
}));

router.post("/", ensureAdmin, asyncHandler(async (req, res) => {
  const input = parseInput(req.body as VideoInput);
  const id = `video_${input.videoId}`;
  const ref = adminDb.collection("videos").doc(id);
  const existing = await ref.get();
  if (existing.exists && existing.data()?.isDeleted !== 1) throw new ApiError(409, "This YouTube video is already in the library.");
  const now = new Date().toISOString();
  const record = {
    ...input,
    platform: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${input.videoId}`,
    createdAt: existing.data()?.createdAt || now,
    updatedAt: now,
    isDeleted: 0,
    archivedAt: null,
  };
  await ref.set(record, { merge: true });
  res.status(201).json({ success: true, video: toVideoDto(id, record) });
}));

router.patch("/:videoId", ensureAdmin, asyncHandler(async (req, res) => {
  const id = req.params.videoId;
  if (!/^video_[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ApiError(400, "Invalid video ID.");
  const ref = adminDb.collection("videos").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Video not found.");
  if (snapshot.data()?.isDeleted === 1) throw new ApiError(409, "Restore the video before editing it.");
  const input = parseInput(req.body as VideoInput);
  const updated = {
    ...input,
    platform: "youtube",
    embedUrl: `https://www.youtube-nocookie.com/embed/${input.videoId}`,
    updatedAt: new Date().toISOString(),
  };
  await ref.set(updated, { merge: true });
  res.json({ success: true, video: toVideoDto(id, { ...snapshot.data(), ...updated }) });
}));

router.delete("/:videoId", ensureAdmin, asyncHandler(async (req, res) => {
  const id = req.params.videoId;
  if (!/^video_[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ApiError(400, "Invalid video ID.");
  const ref = adminDb.collection("videos").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Video not found.");
  const archivedAt = new Date().toISOString();
  await ref.set({ isDeleted: 1, archivedAt, updatedAt: archivedAt }, { merge: true });
  res.json({ success: true, archived: true });
}));

router.post("/:videoId/restore", ensureAdmin, asyncHandler(async (req, res) => {
  const id = req.params.videoId;
  if (!/^video_[A-Za-z0-9_-]{1,200}$/.test(id)) throw new ApiError(400, "Invalid video ID.");
  const ref = adminDb.collection("videos").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Video not found.");
  const restoredAt = new Date().toISOString();
  await ref.set({ isDeleted: 0, archivedAt: null, restoredAt, updatedAt: restoredAt }, { merge: true });
  res.json({ success: true, restored: true, video: toVideoDto(id, { ...snapshot.data(), isDeleted: 0, archivedAt: null, updatedAt: restoredAt }) });
}));

async function fetchCompletePlaylist(apiKey: string): Promise<{ items: YoutubePlaylistItem[]; pagesFetched: number }> {
  const items: YoutubePlaylistItem[] = [];
  let pageToken: string | undefined;
  let pagesFetched = 0;
  do {
    if (pagesFetched >= MAX_PLAYLIST_PAGES) throw new ApiError(502, "The YouTube playlist exceeds the 1,000-video sync limit.");
    const url = new URL("https://www.googleapis.com/youtube/v3/playlistItems");
    url.searchParams.set("part", "snippet");
    url.searchParams.set("maxResults", "50");
    url.searchParams.set("playlistId", TEAM_UPLOADS_PLAYLIST_ID);
    url.searchParams.set("key", apiKey);
    if (pageToken) url.searchParams.set("pageToken", pageToken);
    let response: globalThis.Response;
    try {
      response = await fetch(url);
    } catch (error) {
      logger.error("videos", "YouTube request failed", { error: error instanceof Error ? error.message : String(error) });
      throw new ApiError(502, "YouTube is unreachable. No video records were changed.");
    }
    if (!response.ok) {
      logger.error("videos", "YouTube API failed", { status: response.status, statusText: response.statusText });
      throw new ApiError(502, `YouTube returned HTTP ${response.status}: ${response.statusText}`);
    }
    const page = await response.json() as YoutubePlaylistResponse;
    items.push(...(Array.isArray(page.items) ? page.items : []));
    pageToken = page.nextPageToken;
    pagesFetched += 1;
  } while (pageToken);
  return { items, pagesFetched };
}

async function commitBatches(operations: Array<(batch: FirebaseFirestore.WriteBatch) => void>): Promise<void> {
  for (let start = 0; start < operations.length; start += BATCH_SIZE) {
    const batch = adminDb.batch();
    for (const operation of operations.slice(start, start + BATCH_SIZE)) operation(batch);
    await batch.commit();
  }
}

router.post("/sync", ensureAdmin, asyncHandler(async (req, res) => {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) throw new ApiError(503, "YouTube sync is not configured in Secret Manager.");
  const { items, pagesFetched } = await fetchCompletePlaylist(apiKey);
  const syncedAt = new Date().toISOString();
  const records = new Map<string, Record<string, unknown>>();
  for (const item of items) {
    const snippet = item.snippet;
    const rawId = snippet?.resourceId?.videoId;
    if (!rawId || !YOUTUBE_ID_PATTERN.test(rawId)) continue;
    const title = boundedText(snippet?.title || "Untitled YouTube video", "Title", 180, true);
    const description = boundedText(snippet?.description || "", "Description", 2_000);
    const metadata = `${title} ${description}`.toLowerCase();
    const thumbnailCandidate = snippet?.thumbnails?.maxres?.url
      || snippet?.thumbnails?.standard?.url
      || snippet?.thumbnails?.high?.url
      || snippet?.thumbnails?.medium?.url
      || snippet?.thumbnails?.default?.url;
    records.set(`video_${rawId}`, {
      title,
      description,
      platform: "youtube",
      videoId: rawId,
      thumbnailUrl: validateThumbnail(thumbnailCandidate, rawId),
      embedUrl: `https://www.youtube-nocookie.com/embed/${rawId}`,
      type: metadata.includes("#shorts") || metadata.includes("#short") ? "short" : "video",
      status: "published",
      createdAt: snippet?.publishedAt || syncedAt,
      updatedAt: syncedAt,
      isDeleted: 0,
      archivedAt: null,
      syncSource: SYNC_SOURCE,
      sourcePlaylistId: TEAM_UPLOADS_PLAYLIST_ID,
      lastSyncedAt: syncedAt,
    });
  }

  const collection = adminDb.collection("videos");
  await commitBatches([...records].map(([id, data]) => (batch) => batch.set(collection.doc(id), data, { merge: true })));

  let archivedCount = 0;
  if (records.size > 0) {
    const existing = await collection.where("syncSource", "==", SYNC_SOURCE).limit(1_000).get();
    const archiveOperations: Array<(batch: FirebaseFirestore.WriteBatch) => void> = [];
    for (const doc of existing.docs) {
      const data = doc.data();
      if (data.sourcePlaylistId === TEAM_UPLOADS_PLAYLIST_ID && !records.has(doc.id) && data.isDeleted !== 1) {
        archiveOperations.push((batch) => batch.set(doc.ref, {
          isDeleted: 1,
          archivedAt: syncedAt,
          updatedAt: syncedAt,
          archiveReason: "Missing from a completed YouTube playlist sync",
        }, { merge: true }));
      }
    }
    await commitBatches(archiveOperations);
    archivedCount = archiveOperations.length;
  }

  logger.info("videos", "YouTube sync completed", {
    pagesFetched,
    upsertedCount: records.size,
    archivedCount,
  });
  res.json({
    success: true,
    pagesFetched,
    addedUpdatedCount: records.size,
    archivedCount,
    archivalSkipped: records.size === 0,
    message: records.size === 0
      ? "YouTube returned no usable videos. Existing records were preserved."
      : `Synced ${records.size} videos and archived ${archivedCount}.`,
  });
}));

export default router;
