import express from "express";
import { adminDb, adminFieldValue, adminStorage } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
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

async function updateAlbumMediaCount(albumId: string, delta: number) {
  if (!albumId) return;
  const albumRef = adminDb.collection("albums").doc(albumId);
  await albumRef.update({
    mediaCount: adminFieldValue.increment(delta),
    updatedAt: new Date().toISOString()
  });
}

// POST /api/photos/upload-unified
// Accepts base64 encoded photo and metadata, performs storage upload, optional Google Photos upload, and optional AI labeling
router.post("/upload-unified", ensureTeamMember, uploadUnifiedLimiter, asyncHandler(async (req, res) => {
  const { fileBase64, filename, mimeType, albumId, uploadToGoogle, runAiLabeling } = req.body as {
    fileBase64: string;
    filename: string;
    mimeType: string;
    albumId?: string | null;
    uploadToGoogle?: boolean;
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
      const batch = adminDb.batch();
      
      // Update photo doc in imported_photos
      batch.update(existingPhotoDoc.ref, { albumId });
      
      // Copy to new album's photos subcollection
      const albumRef = adminDb.collection("albums").doc(albumId);
      const newAlbumPhotoRef = albumRef.collection("photos").doc(existingPhotoDoc.id);
      batch.set(newAlbumPhotoRef, { ...existingPhotoData, albumId });
      
      await batch.commit();
      await updateAlbumMediaCount(albumId, 1);
      
      // Decrement the old album count if it was previously assigned elsewhere
      if (existingPhotoData.albumId) {
        await updateAlbumMediaCount(existingPhotoData.albumId, -1);
        const oldAlbumRef = adminDb.collection("albums").doc(existingPhotoData.albumId);
        await oldAlbumRef.collection("photos").doc(existingPhotoDoc.id).delete();
      }
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

  // Optional Google Photos upload
  let googleMediaItemId: string | null = null;
  let googleSyncWarning: string | null = null;
  if (uploadToGoogle) {
    try {
      const googleToken = await getGooglePhotosAccessToken();
      
      // 1. Upload full-resolution bytes after camera metadata removal.
      const uploadRes = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/octet-stream",
          "X-Goog-Upload-File-Name": filename,
          "X-Goog-Upload-Protocol": "raw"
        },
        body: new Uint8Array(derivatives.original.buffer)
      });

      if (!uploadRes.ok) {
        throw new Error(`Google upload failed with HTTP ${uploadRes.status}: ${uploadRes.statusText}`);
      }

      const uploadToken = await uploadRes.text();

      // 2. Register media item in Google Photos library
      interface GoogleBatchCreateBody {
        newMediaItems: {
          description?: string;
          simpleMediaItem: {
            uploadToken: string;
            fileName: string;
          };
        }[];
        albumId?: string;
      }
      const batchCreateBody: GoogleBatchCreateBody = {
        newMediaItems: [
          {
            description: caption || "Uploaded via ARES Portal",
            simpleMediaItem: {
              uploadToken,
              fileName: filename
            }
          }
        ]
      };

      const batchRes = await fetch("https://photoslibrary.googleapis.com/v1/mediaItems:batchCreate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(batchCreateBody)
      });

      if (!batchRes.ok) {
        throw new Error(`Google batch create failed with HTTP ${batchRes.status}: ${batchRes.statusText}`);
      }

      const batchData = await batchRes.json() as {
        newMediaItemResults?: Array<{
          status?: { message?: string };
          mediaItem?: { id?: string };
        }>;
      };
      const creationResult = batchData.newMediaItemResults?.[0];
      if (creationResult?.status?.message && creationResult.status.message !== "Success") {
        throw new Error(`Google creation status not success: ${creationResult.status.message}`);
      }
      googleMediaItemId = creationResult?.mediaItem?.id || null;
    } catch (gErr: unknown) {
      logger.warn("photos", "Google Photos sync upload error", gErr);
      googleSyncWarning = "The image was saved to the team site, but Google Photos sync failed.";
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
    googleMediaItemId,
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
      isSynced: Boolean(googleMediaItemId),
      isArchived: false,
      ...photoDerivativeDtoFields(storedAssets),
    },
    googleSync: {
      requested: uploadToGoogle === true,
      succeeded: Boolean(googleMediaItemId),
      warning: googleSyncWarning,
    },
  });
}));

export default router;
