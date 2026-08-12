import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { ensureAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const GOOGLE_DRIVE_API_ORIGIN = "https://www.googleapis.com";
const GOOGLE_DRIVE_HOSTNAME = "drive.google.com";
const DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{10,200}$/;
const RAW_DRIVE_FILE_ID_PATTERN = /^[a-zA-Z0-9_-]{20,200}$/;
const GOOGLE_DRIVE_REQUEST_TIMEOUT_MS = 15_000;

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

/**
 * Utility: Extract Google Drive File ID from URL or raw ID
 */
export function extractDriveFileId(input: string): string | null {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();

  if (RAW_DRIVE_FILE_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== GOOGLE_DRIVE_HOSTNAME ||
    url.port !== "" ||
    url.username !== "" ||
    url.password !== ""
  ) {
    return null;
  }

  const fileDMatch = url.pathname.match(/^\/file\/d\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const folderMatch = url.pathname.match(/(?:^|\/)folders\/([a-zA-Z0-9_-]+)(?:\/|$)/);
  const candidate = fileDMatch?.[1] ?? url.searchParams.get("id") ?? folderMatch?.[1];

  return candidate && DRIVE_FILE_ID_PATTERN.test(candidate) ? candidate : null;
}

function buildDriveFileApiUrl(fileId: string, fields: string): URL {
  if (!DRIVE_FILE_ID_PATTERN.test(fileId)) {
    throw new ApiError(400, "Invalid Google Drive file ID.");
  }

  const url = new URL(`/drive/v3/files/${encodeURIComponent(fileId)}`, GOOGLE_DRIVE_API_ORIGIN);
  url.searchParams.set("fields", fields);

  if (url.origin !== GOOGLE_DRIVE_API_ORIGIN) {
    throw new ApiError(500, "Google Drive API configuration is invalid.");
  }

  return url;
}

function buildDriveFolderApiUrl(folderId: string, fields: string): URL {
  if (!DRIVE_FILE_ID_PATTERN.test(folderId)) {
    throw new ApiError(400, "Invalid Google Drive folder ID.");
  }

  const url = new URL("/drive/v3/files", GOOGLE_DRIVE_API_ORIGIN);
  url.searchParams.set("q", `'${folderId}' in parents and trashed = false`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("pageSize", "100");
  return url;
}

/**
 * Utility: Infer Document Category based on MIME type / File Name
 */
export function inferDocCategory(name: string, mimeType?: string): "spec" | "guide" | "business" {
  const lowerName = (name || "").toLowerCase();
  const lowerMime = (mimeType || "").toLowerCase();

  if (
    lowerMime.includes("spreadsheet") || 
    lowerMime.includes("presentation") || 
    lowerName.includes("business") || 
    lowerName.includes("portfolio") || 
    lowerName.includes("finance") ||
    lowerName.includes("budget") ||
    lowerName.includes("sponsor")
  ) {
    return "business";
  }

  if (
    lowerName.includes("guide") || 
    lowerName.includes("manual") || 
    lowerName.includes("tutorial") || 
    lowerName.includes("checklist") ||
    lowerName.includes("rule") ||
    lowerName.includes("handbook")
  ) {
    return "guide";
  }

  return "spec";
}

// GET /api/drive/config - Fetch team's saved Google Drive Folder ID
router.get(
  "/config",
  ensureAdmin,
  asyncHandler(async (_req, res) => {
    const docRef = adminDb.collection("system_settings").doc("drive_config");
    const snap = await docRef.get();
    const folderId = snap.exists ? snap.data()?.folderId || "" : "";
    res.json({ folderId });
  })
);

// POST /api/drive/config - Save team's Google Drive Folder ID (Admin only)
router.post(
  "/config",
  ensureAdmin,
  asyncHandler(async (req, res) => {
    const { folderId } = req.body || {};
    if (typeof folderId !== "string") {
      throw new ApiError(400, "Invalid folderId provided.");
    }

    const cleanFolderId = extractDriveFileId(folderId);
    if (!cleanFolderId) {
      throw new ApiError(400, "Valid Google Drive folder URL or ID is required.");
    }

    await adminDb.collection("system_settings").doc("drive_config").set(
      {
        folderId: cleanFolderId,
        updatedAt: new Date().toISOString()
      },
      { merge: true }
    );

    logger.info("drive", `Updated team Google Drive folderId to: ${cleanFolderId}`);
    res.json({ success: true, folderId: cleanFolderId });
  })
);

// POST /api/drive/import - Fetch metadata for a single Google Drive file URL
router.post(
  "/import",
  ensureAdmin,
  asyncHandler(async (req, res) => {
    const { url, fileId } = req.body || {};
    const targetId = extractDriveFileId(fileId || url);

    if (!targetId) {
      throw new ApiError(400, "Valid Google Drive URL or File ID is required.");
    }

    const token = await getGooglePhotosAccessToken();

    const fields = "id,name,mimeType,webViewLink,webContentLink,createdTime,modifiedTime,description";
    const driveRes = await fetch(buildDriveFileApiUrl(targetId, fields), {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(GOOGLE_DRIVE_REQUEST_TIMEOUT_MS),
    });

    if (!driveRes.ok) {
      const errorText = await driveRes.text();
      logger.error("drive", `Drive API error for file ${targetId}`, errorText);
      throw new ApiError(driveRes.status, `Google Drive API error: ${driveRes.statusText}`);
    }

    const file = (await driveRes.json()) as {
      id: string;
      name: string;
      mimeType: string;
      webViewLink: string;
      createdTime?: string;
      description?: string;
    };

    const category = inferDocCategory(file.name, file.mimeType);

    res.json({
      success: true,
      file: {
        id: file.id,
        title: file.name.replace(/\.[^/.]+$/, ""), // Strip file extension for title
        category,
        fileUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
        description: file.description || `Imported from Google Drive (${file.name})`,
        createdAt: file.createdTime ? file.createdTime.split("T")[0] : new Date().toISOString().split("T")[0]
      }
    });
  })
);

// POST /api/drive/sync - Scan Drive folder & batch-upsert into Firestore documents collection
router.post(
  "/sync",
  ensureAdmin,
  asyncHandler(async (req, res) => {
    let targetFolderId = req.body?.folderId;

    if (!targetFolderId) {
      const configSnap = await adminDb.collection("system_settings").doc("drive_config").get();
      targetFolderId = configSnap.exists ? configSnap.data()?.folderId : null;
    }

    if (!targetFolderId) {
      throw new ApiError(
        400,
        "No Google Drive Folder ID provided or configured. Please configure a Shared Drive folder first."
      );
    }

    if (typeof targetFolderId !== "string") {
      throw new ApiError(400, "Valid Google Drive folder URL or ID is required.");
    }

    const cleanFolderId = extractDriveFileId(targetFolderId);
    if (!cleanFolderId) {
      throw new ApiError(400, "Valid Google Drive folder URL or ID is required.");
    }
    const token = await getGooglePhotosAccessToken();

    const fields = "files(id,name,mimeType,webViewLink,createdTime,modifiedTime,description)";

    const driveRes = await fetch(buildDriveFolderApiUrl(cleanFolderId, fields), {
      headers: { Authorization: `Bearer ${token}` },
      redirect: "error",
      signal: AbortSignal.timeout(GOOGLE_DRIVE_REQUEST_TIMEOUT_MS),
    });

    if (!driveRes.ok) {
      const errorText = await driveRes.text();
      logger.error("drive", `Drive API folder sync error for folder ${cleanFolderId}`, errorText);
      throw new ApiError(driveRes.status, `Google Drive API sync error: ${driveRes.statusText}`);
    }

    const data = (await driveRes.json()) as {
      files?: Array<{
        id: string;
        name: string;
        mimeType: string;
        webViewLink: string;
        createdTime?: string;
        modifiedTime?: string;
        description?: string;
      }>;
    };

    const filesList = data.files || [];
    if (filesList.length === 0) {
      return res.json({
        success: true,
        syncedCount: 0,
        folderId: cleanFolderId,
        message: "No files found in the specified Google Drive folder."
      });
    }

    const batch = adminDb.batch();
    const nowIso = new Date().toISOString();
    const syncedFiles: Array<{ id: string; name: string }> = [];

    for (const file of filesList) {
      const slug = `drive_${file.id}`;
      const docRef = adminDb.collection("documents").doc(slug);
      const cleanTitle = file.name.replace(/\.[^/.]+$/, "");
      const category = inferDocCategory(file.name, file.mimeType);

      batch.set(
        docRef,
        {
          title: cleanTitle,
          category,
          sortOrder: 0,
          description: file.description || `Synced from Google Drive (${file.name})`,
          content: `Synced from Google Drive file: [${file.name}](${file.webViewLink})`,
          status: "published",
          isDeleted: 0,
          displayInAreslib: 0,
          displayInMathCorner: 0,
          displayInScienceCorner: 0,
          isPortfolio: category === "business" ? 1 : 0,
          isExecutiveSummary: 0,
          fileUrl: file.webViewLink || `https://drive.google.com/file/d/${file.id}/view`,
          createdAt: file.createdTime ? file.createdTime.split("T")[0] : nowIso.split("T")[0],
          date: file.createdTime ? file.createdTime.split("T")[0] : nowIso.split("T")[0],
          updatedAt: nowIso,
          source: "google_drive"
        },
        { merge: true }
      );

      syncedFiles.push({ id: file.id, name: cleanTitle });
    }

    await batch.commit();

    logger.info(
      "drive",
      `Successfully synced ${syncedFiles.length} documents from Google Drive folder: ${cleanFolderId}`
    );

    return res.json({
      success: true,
      syncedCount: syncedFiles.length,
      folderId: cleanFolderId,
      syncedFiles
    });
  })
);

export default router;
