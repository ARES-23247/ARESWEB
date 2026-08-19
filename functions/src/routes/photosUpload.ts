import express from "express";
import { adminDb, adminFieldValue, adminStorage } from "../lib/firebase-admin";
import { validateImageMagicBytes } from "../lib/imageImport";
import { ensureTeamMember } from "../middleware/auth";
import { generatePhotoCaptionAndLabels } from "../lib/vertex";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import rateLimit from "express-rate-limit";
import crypto from "crypto";
import {
  deleteStoredPhotoAssets,
  generatePhotoDerivatives,
  photoDerivativeDtoFields,
  storePhotoAssets,
} from "../lib/photoDerivatives";

const router = express.Router();

const uploadUnifiedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { error: "Too many upload requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/photos/upload-unified
// Accepts base64 encoded photo and metadata, performs storage upload and optional AI labeling (uploads do not push to Google Photos; imports use the picker route)
router.post("/upload-unified", ensureTeamMember, uploadUnifiedLimiter, asyncHandler(async (req, res) => {
  const { fileBase64, filename, mimeType, albumId, runAiLabeling } = req.body as {
    fileBase64: string;
    filename: string;
    mimeType: string;
    albumId?: string | null;
    runAiLabeling?: boolean;
  };

  if (!fileBase64 || !filename || !mimeType) {
    throw new ApiError(400, "Missing required fields: fileBase64, filename, mimeType");
  }

  if (filename.length > 180 || !["image/jpeg", "image/png", "image/webp"].includes(mimeType)) {
    throw new ApiError(400, "Upload a JPEG, PNG, or WebP image with a filename under 180 characters.");
  }
  if (albumId && !/^[A-Za-z0-9_-]{1,200}$/.test(albumId)) throw new ApiError(400, "Invalid album ID.");
  if (albumId) {
    const album = await adminDb.collection("albums").doc(albumId).get();
    if (!album.exists || album.data()?.isDeleted === 1) throw new ApiError(400, "Choose an active album.");
  }

  const buffer = Buffer.from(fileBase64, "base64");
  if (buffer.byteLength === 0 || buffer.byteLength > 8 * 1024 * 1024) {
    throw new ApiError(413, "Each image must be 8 MB or smaller after compression.");
  }

  // Validate image magic bytes
  const validation = validateImageMagicBytes(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    8 * 1024 * 1024,
    ["jpg", "png", "webp"],
  );
  if (!validation.valid) {
    throw new ApiError(400, validation.error || "File did not pass magic bytes verification.");
  }
  const declaredFormat = mimeType === "image/jpeg" ? "jpg" : mimeType.slice("image/".length);
  if (validation.format !== declaredFormat) {
    throw new ApiError(400, "The declared image type does not match the file contents.");
  }

  // Calculate SHA-256 hash of the image buffer
  const imageHash = crypto.createHash("sha256").update(buffer).digest("hex");

  // Check if a photo with this hash already exists in imported_photos
  const existingPhotoSnap = await adminDb
    .collection("imported_photos")
    .where("sha256", "==", imageHash)
    .limit(1)
    .get();

  if (!existingPhotoSnap.empty) {
    const existingPhotoDoc = existingPhotoSnap.docs[0];
    const existingPhotoData = existingPhotoDoc.data();
    
    if (existingPhotoData.isDeleted === 1) {
      throw new ApiError(409, "This image is already in the archive. Restore it before uploading it again.");
    }

    // If an albumId is provided and the existing photo isn't already in it, assign it
    if (albumId && existingPhotoData.albumId !== albumId) {
      const previousAlbumId = typeof existingPhotoData.albumId === "string" ? existingPhotoData.albumId : null;
      const batch = adminDb.batch();

      // Update photo doc in imported_photos
      batch.update(existingPhotoDoc.ref, { albumId });

      // Copy to new album's photos subcollection and move both album counts in
      // the same batch so a partial failure cannot desync mediaCount or leave
      // duplicate photo docs behind.
      const albumRef = adminDb.collection("albums").doc(albumId);
      const newAlbumPhotoRef = albumRef.collection("photos").doc(existingPhotoDoc.id);
      batch.set(newAlbumPhotoRef, { ...existingPhotoData, albumId });
      batch.update(albumRef, {
        mediaCount: adminFieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
      if (previousAlbumId) {
        const oldAlbumRef = adminDb.collection("albums").doc(previousAlbumId);
        batch.update(oldAlbumRef, {
          mediaCount: adminFieldValue.increment(-1),
          updatedAt: new Date().toISOString(),
        });
        batch.delete(oldAlbumRef.collection("photos").doc(existingPhotoDoc.id));
      }

      await batch.commit();
    }
    
    res.json({
      success: true,
      photo: {
        id: existingPhotoDoc.id,
        publicUrl: existingPhotoData.publicUrl,
        caption: existingPhotoData.caption || "",
        altText: existingPhotoData.altText || "",
        labels: Array.isArray(existingPhotoData.labels) ? existingPhotoData.labels : [],
        albumId: albumId || existingPhotoData.albumId || null,
        mimeType: existingPhotoData.mimeType || "image/jpeg",
        fileSize: existingPhotoData.fileSize || 0,
        importedAt: existingPhotoData.importedAt || "",
        isSynced: Boolean(existingPhotoData.googleMediaItemId),
        isArchived: false,
        ...photoDerivativeDtoFields(existingPhotoData),
      },
      cached: true
    });
    return;
  }

  // Save to Firebase Storage
  const dateStr = new Date().toISOString().split("T")[0];
  const sanitizedFilename = filename.toLowerCase().replace(/[^a-z0-9.]/g, "-");
  const docId = `photo-${Date.now()}-${crypto.randomUUID().substring(0, 8)}`;
  const storageKey = `gallery/uploads/${dateStr}/${docId}-${sanitizedFilename}`;
  const bucket = adminStorage.bucket();
  let derivatives;
  try {
    derivatives = await generatePhotoDerivatives(buffer);
  } catch (error) {
    logger.warn("photos", "A validated upload could not be decoded for responsive image generation", error);
    throw new ApiError(400, "The image could not be decoded safely.");
  }
  const storedAssets = await storePhotoAssets(
    bucket,
    {
      path: storageKey,
      mimeType,
      metadata: { importedBy: "ARES Unified Uploader" },
    },
    `gallery/derivatives/${dateStr}/${docId}`,
    derivatives,
  );

  // AI auto-labeling and caption
  let caption = "";
  let labels: string[] = [];
  if (runAiLabeling) {
    try {
      const aiResult = await generatePhotoCaptionAndLabels(derivatives.original.buffer, mimeType);
      caption = aiResult.caption;
      labels = aiResult.labels;
    } catch (aiErr: unknown) {
      logger.warn("photos", "AI labeling failed during upload", aiErr);
    }
  }

  // Save metadata in Firestore imported_photos
  const photoMeta = {
    id: docId,
    ...storedAssets,
    originalFilename: filename,
    mimeType,
    fileSize: derivatives.original.fileSize,
    importedAt: new Date().toISOString(),
    albumId: albumId || null,
    caption,
    labels,
    sha256: imageHash,
    isDeleted: 0,
    updatedAt: new Date().toISOString(),
  };

  try {
    const batch = adminDb.batch();
    batch.set(adminDb.collection("imported_photos").doc(docId), photoMeta);

    // Commit metadata, the album link, and its count atomically so a failed
    // database write cannot leave an orphaned record or inflated count.
    if (albumId) {
      const albumRef = adminDb.collection("albums").doc(albumId);
      batch.update(albumRef, {
        mediaCount: adminFieldValue.increment(1),
        updatedAt: new Date().toISOString(),
      });
      batch.set(albumRef.collection("photos").doc(docId), photoMeta);
    }
    await batch.commit();
  } catch (error) {
    await deleteStoredPhotoAssets(bucket, storedAssets);
    throw error;
  }

  res.status(201).json({
    success: true,
    photo: {
      id: docId,
      publicUrl: storedAssets.publicUrl,
      caption,
      altText: "",
      labels,
      albumId: albumId || null,
      mimeType,
      fileSize: derivatives.original.fileSize,
      importedAt: photoMeta.importedAt,
      isSynced: false,
      isArchived: false,
      ...photoDerivativeDtoFields(storedAssets),
    },
  });
}));

export default router;
