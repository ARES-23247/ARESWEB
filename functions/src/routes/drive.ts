import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  getGoogleDriveFile,
  GOOGLE_DRIVE_FOLDER_MIME_TYPE,
  isDriveItemWithinRoot,
} from "../lib/googleDrive";
import {
  browseDriveFolder,
  configureDriveRoot,
  getDriveConfiguration,
  importDriveDrafts,
  inferDriveDocumentCategory,
  syncImportedDriveChanges,
} from "../lib/googleDriveLibrary";
import { ensureAdmin } from "../middleware/auth";
import { distributedQuota } from "../middleware/distributedQuota";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../lib/utils";

const router = express.Router();
const GOOGLE_DRIVE_HOSTNAME = "drive.google.com";
const DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{10,200}$/;
const RAW_DRIVE_FILE_ID_PATTERN = /^[A-Za-z0-9_-]{20,200}$/;

const driveIdSchema = z.string().trim().regex(DRIVE_FILE_ID_PATTERN, "Invalid Google Drive ID.");
const configureSchema = z.object({ folderId: z.string().trim().min(1).max(500) }).strict();
const browseSchema = z.object({
  folderId: driveIdSchema.optional(),
  pageToken: z.string().trim().min(1).max(2_048).optional(),
  pageSize: z.number().int().min(1).max(50).default(25),
}).strict();
const importDraftsSchema = z.object({
  folderId: driveIdSchema,
  fileIds: z.array(driveIdSchema).min(1).max(10).refine(
    (values) => new Set(values).size === values.length,
    "Selected Google Drive files must be unique.",
  ),
  includeGoogleDocText: z.boolean().default(true),
}).strict();
const singleImportSchema = z.object({
  url: z.string().trim().max(500).optional(),
  fileId: z.string().trim().max(500).optional(),
}).strict();

router.use(rateLimit({
  windowMs: 15 * 60 * 1_000,
  max: 100,
  message: { error: "Too many Google Drive requests. Try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

/** Extract a Drive file or folder ID from an exact Google Drive URL or raw ID. */
export function extractDriveFileId(input: string): string | null {
  if (typeof input !== "string" || !input.trim()) return null;
  const trimmed = input.trim();
  if (RAW_DRIVE_FILE_ID_PATTERN.test(trimmed)) return trimmed;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (
    url.protocol !== "https:"
    || url.hostname !== GOOGLE_DRIVE_HOSTNAME
    || url.port !== ""
    || url.username !== ""
    || url.password !== ""
  ) return null;
  const fileMatch = url.pathname.match(/^\/file\/d\/([A-Za-z0-9_-]+)(?:\/|$)/u);
  const folderMatch = url.pathname.match(/(?:^|\/)folders\/([A-Za-z0-9_-]+)(?:\/|$)/u);
  const candidate = fileMatch?.[1] ?? folderMatch?.[1] ?? url.searchParams.get("id");
  return candidate && DRIVE_FILE_ID_PATTERN.test(candidate) ? candidate : null;
}

export const inferDocCategory = inferDriveDocumentCategory;

router.get("/status", ensureAdmin, asyncHandler(async (_req, res) => {
  const config = await getDriveConfiguration();
  const credentialConfigured = Boolean(
    process.env.GOOGLE_CLIENT_ID
    && process.env.GOOGLE_CLIENT_SECRET
    && process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
  res.json({
    provider: "google-drive",
    accountOwner: "dedicated-team-storage-account",
    credentialConfigured,
    credentialStorage: "secret-manager",
    folderConfigured: Boolean(config.folderId),
    folderName: config.folderName || null,
    oauthClientId: process.env.GOOGLE_CLIENT_ID || null,
    pickerAppId: "205869391101",
    capabilities: credentialConfigured
      ? ["folder-picker", "paginated-preview", "draft-import", "incremental-change-check"]
      : ["folder-picker"],
  });
}));

router.get("/config", ensureAdmin, asyncHandler(async (_req, res) => {
  res.json(await getDriveConfiguration());
}));

router.post(
  "/config",
  ensureAdmin,
  distributedQuota({ scope: "drive-config", limit: 10, windowMs: 60 * 60 * 1_000 }),
  validate(configureSchema),
  asyncHandler(async (req, res) => {
    const folderId = extractDriveFileId(req.body.folderId);
    if (!folderId) throw new ApiError(400, "Select a valid Google Drive folder.");
    res.json({ success: true, config: await configureDriveRoot(folderId) });
  }),
);

router.post(
  "/browse",
  ensureAdmin,
  distributedQuota({ scope: "drive-browse", limit: 120, windowMs: 15 * 60 * 1_000 }),
  validate(browseSchema),
  asyncHandler(async (req, res) => {
    res.json(await browseDriveFolder(req.body));
  }),
);

router.post(
  "/import-drafts",
  ensureAdmin,
  distributedQuota({ scope: "drive-import-drafts", limit: 20, windowMs: 15 * 60 * 1_000 }),
  validate(importDraftsSchema),
  asyncHandler(async (req, res) => {
    const imported = await importDriveDrafts(req.body);
    res.status(201).json({ success: true, imported });
  }),
);

router.post(
  "/changes/check",
  ensureAdmin,
  distributedQuota({ scope: "drive-change-check", limit: 10, windowMs: 60 * 60 * 1_000 }),
  asyncHandler(async (_req, res) => {
    res.json({ success: true, ...(await syncImportedDriveChanges()) });
  }),
);

// Preserve single-link metadata import for the manual document editor. It is
// read-only and uses the dedicated Drive credential rather than Photos access.
router.post(
  "/import",
  ensureAdmin,
  distributedQuota({ scope: "drive-single-import", limit: 30, windowMs: 15 * 60 * 1_000 }),
  validate(singleImportSchema),
  asyncHandler(async (req, res) => {
    const targetId = extractDriveFileId(req.body.fileId || req.body.url || "");
    if (!targetId) throw new ApiError(400, "Select a valid Google Drive file.");
    const config = await getDriveConfiguration();
    if (!config.folderId) {
      throw new ApiError(409, "Configure a Google Drive root folder before importing files.");
    }
    if (!(await isDriveItemWithinRoot(targetId, config.folderId))) {
      throw new ApiError(403, "The selected file is outside the configured Google Drive root.");
    }
    const file = await getGoogleDriveFile(targetId);
    if (file.trashed || file.mimeType === GOOGLE_DRIVE_FOLDER_MIME_TYPE) {
      throw new ApiError(400, "Select an active Google Drive file.");
    }
    res.json({
      success: true,
      file: {
        id: file.id,
        title: file.name.replace(/\.[^/.]+$/u, ""),
        category: inferDriveDocumentCategory(file.name, file.mimeType),
        fileUrl: file.webViewLink,
        description: file.description ?? `Linked from Google Drive (${file.name})`,
        createdAt: file.createdTime?.split("T")[0] ?? new Date().toISOString().split("T")[0],
      },
    });
  }),
);

// The former endpoint auto-published every file it saw. Fail explicitly so an
// old client cannot revive that behavior during a rolling deployment.
router.post("/sync", ensureAdmin, (_req, _res, next) => {
  next(new ApiError(410, "Automatic Drive publishing was retired. Browse the folder and import selected files as drafts."));
});

export default router;
