import express from "express";
import rateLimit from "express-rate-limit";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { ensureAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const PICKER_API_BASE = "https://photospicker.googleapis.com/v1";
const MAX_PICKER_PAGES = 10;
const MAX_MEDIA_BYTES = 15 * 1024 * 1024;

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many photo connection requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

interface PickerSessionResponse {
  id?: string;
  pickerUri?: string;
  pickerUrl?: string;
  mediaItemsSet?: boolean;
}

interface PickerMediaItem {
  id?: string;
  baseUrl?: string;
  filename?: string;
  mimeType?: string;
  mediaFile?: {
    baseUrl?: string;
    filename?: string;
    mimeType?: string;
  };
}

interface PickerItemsResponse {
  mediaItems?: PickerMediaItem[];
  nextPageToken?: string;
}

function hasGooglePhotosSecrets(): boolean {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET
    && process.env.GOOGLE_PHOTOS_REFRESH_TOKEN,
  );
}

function requireSessionId(value: string, invalidStatus = 400): string {
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(value)) {
    throw new ApiError(invalidStatus, "Invalid picker session ID.");
  }
  return value;
}

function requireMediaItemId(value: string): string {
  if (!/^[A-Za-z0-9_-]{1,300}$/.test(value)) {
    throw new ApiError(400, "Invalid picker media item ID.");
  }
  return value;
}

function safePickerUri(value: unknown): string {
  if (typeof value !== "string") throw new ApiError(502, "Google Photos did not return a picker link.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ApiError(502, "Google Photos returned an invalid picker link.");
  }
  if (url.protocol !== "https:" || !["photos.google.com", "photospicker.googleapis.com"].includes(url.hostname)) {
    throw new ApiError(502, "Google Photos returned an untrusted picker link.");
  }
  return url.toString();
}

function safePickerItem(item: PickerMediaItem): PickerMediaItem | null {
  const id = typeof item.id === "string" && /^[A-Za-z0-9_-]{1,300}$/.test(item.id) ? item.id : undefined;
  const source = item.mediaFile ?? item;
  let baseUrl: string | undefined;
  if (typeof source.baseUrl === "string") {
    try {
      const candidate = new URL(source.baseUrl);
      if (
        candidate.protocol === "https:"
        && candidate.hostname === "lh3.googleusercontent.com"
        && !candidate.port
        && !candidate.username
        && !candidate.password
      ) {
        baseUrl = candidate.toString();
      }
    } catch {
      baseUrl = undefined;
    }
  }
  if (!id || !baseUrl) return null;

  const filename = typeof source.filename === "string" ? source.filename.slice(0, 180) : undefined;
  const mimeType = typeof source.mimeType === "string" && source.mimeType.startsWith("image/")
    ? source.mimeType
    : undefined;
  return { id, mediaFile: { baseUrl, filename, mimeType } };
}

async function pickerFetch(path: string, init?: RequestInit): Promise<globalThis.Response> {
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${googleToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    logger.error("photos", "Google Photos Picker request failed", {
      path,
      status: response.status,
      statusText: response.statusText,
    });
    throw new ApiError(502, `Google Photos Picker returned HTTP ${response.status}.`);
  }
  return response;
}

async function fetchPickerMediaItems(sessionId: string): Promise<PickerMediaItem[]> {
  const mediaItems: PickerMediaItem[] = [];
  let nextPageToken: string | undefined;
  let page = 0;

  do {
    const query = new URLSearchParams({ sessionId, pageSize: "100" });
    if (nextPageToken) query.set("pageToken", nextPageToken);
    const response = await pickerFetch(`/mediaItems?${query.toString()}`);
    const data = await response.json() as PickerItemsResponse;
    for (const item of Array.isArray(data.mediaItems) ? data.mediaItems : []) {
      const safe = safePickerItem(item);
      if (safe) mediaItems.push(safe);
    }
    nextPageToken = data.nextPageToken;
    page += 1;
  } while (nextPageToken && page < MAX_PICKER_PAGES);

  if (nextPageToken) throw new ApiError(422, "The picker selection exceeds the 1,000-photo import limit.");
  return mediaItems;
}

// The team account is authorized out-of-band and stored in Secret Manager.
// This DTO reports connection state without exposing account names, IDs,
// scopes, tokens, or credential records.
router.get("/auth/status", ensureAdmin, asyncHandler(async (_req, res) => {
  const configured = hasGooglePhotosSecrets();
  res.json({
    provider: "google-photos",
    accountOwner: "team",
    configured,
    credentialStorage: "secret-manager",
    capabilities: configured ? ["picker-import", "team-library-upload"] : [],
  });
}));

// Keep stale clients safe. Browser OAuth linking is intentionally disabled so
// a refresh token can never pass through Firestore or a client-visible flow.
router.get("/auth/init", asyncHandler(async (_req, res) => {
  res.redirect("/dashboard/photos?auth_status=error&error_msg=Google%20Photos%20uses%20the%20team%20account%20configured%20by%20an%20operator.");
}));

router.post("/auth/init", ensureAdmin, asyncHandler(async (_req, res) => {
  if (!hasGooglePhotosSecrets()) {
    throw new ApiError(503, "Google Photos is not configured in Secret Manager.");
  }
  res.json({
    provider: "google-photos",
    accountOwner: "team",
    configured: true,
    credentialStorage: "secret-manager",
    message: "The team Google Photos connection is ready.",
  });
}));

router.get("/auth", asyncHandler(async (_req, res) => {
  res.redirect("/dashboard/photos?auth_status=error&error_msg=Browser%20linking%20is%20disabled.%20Use%20the%20team%20Google%20account%20set%20up%20by%20an%20operator.");
}));

router.get("/picker/media-proxy", ensureAdmin, asyncHandler(async (req, res) => {
  const sessionId = requireSessionId(typeof req.query.sessionId === "string" ? req.query.sessionId : "");
  const itemId = requireMediaItemId(typeof req.query.itemId === "string" ? req.query.itemId : "");
  const mediaItems = await fetchPickerMediaItems(sessionId);
  const selected = mediaItems.find(item => item.id === itemId);
  const baseUrl = selected?.mediaFile?.baseUrl;
  if (!baseUrl) throw new ApiError(404, "The selected Google Photos item was not found.");

  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${baseUrl}=w1024`, {
    headers: { Authorization: `Bearer ${googleToken}` },
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    logger.error("photos", "Google Photos media proxy failed", { status: response.status });
    throw new ApiError(502, `Google Photos media returned HTTP ${response.status}.`);
  }
  const contentType = response.headers.get("Content-Type") || "image/jpeg";
  if (!contentType.startsWith("image/")) throw new ApiError(502, "Google Photos returned a non-image file.");
  const buffer = await response.arrayBuffer();
  if (buffer.byteLength > MAX_MEDIA_BYTES) throw new ApiError(413, "The selected image is too large to preview.");
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.send(Buffer.from(buffer));
}));

router.get("/picker/:sessionId/items", ensureAdmin, asyncHandler(async (req, res) => {
  const sessionId = requireSessionId(req.params.sessionId);
  const mediaItems = await fetchPickerMediaItems(sessionId);
  res.json({ mediaItems, count: mediaItems.length });
}));

router.get("/picker/:sessionId", ensureAdmin, asyncHandler(async (req, res) => {
  const sessionId = requireSessionId(req.params.sessionId);
  const response = await pickerFetch(`/sessions/${sessionId}`);
  const data = await response.json() as PickerSessionResponse;
  res.json({ mediaItemsSet: data.mediaItemsSet === true });
}));

router.post("/picker", ensureAdmin, asyncHandler(async (_req, res) => {
  if (!hasGooglePhotosSecrets()) throw new ApiError(503, "Google Photos is not configured in Secret Manager.");
  const response = await pickerFetch("/sessions", { method: "POST", body: "{}" });
  const data = await response.json() as PickerSessionResponse;
  if (!data.id) throw new ApiError(502, "Google Photos did not return a picker session.");
  res.json({
    sessionId: requireSessionId(data.id, 502),
    pickerUri: safePickerUri(data.pickerUri ?? data.pickerUrl),
    mediaItemsSet: data.mediaItemsSet === true,
  });
}));

// Picker sessions are transient upstream state, so bounded cleanup is an
// intentional hard delete and not a team-content deletion.
router.delete("/picker/:sessionId", ensureAdmin, asyncHandler(async (req, res) => {
  const sessionId = requireSessionId(req.params.sessionId);
  const googleToken = await getGooglePhotosAccessToken();
  const response = await fetch(`${PICKER_API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${googleToken}` },
  });
  if (!response.ok && response.status !== 404) {
    logger.warn("photos", "Google Photos picker cleanup failed", { status: response.status });
    throw new ApiError(502, `Google Photos Picker returned HTTP ${response.status}.`);
  }
  res.json({ success: true });
}));

export default router;
