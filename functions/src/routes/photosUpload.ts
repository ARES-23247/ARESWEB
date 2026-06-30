import express from "express";
import admin, { adminDb, adminStorage } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { validateImageMagicBytes } from "../lib/imageImport";
import { ensureTeamMember } from "../middleware/auth";
import { generatePhotoCaptionAndLabels } from "../lib/vertex";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import rateLimit from "express-rate-limit";
import crypto from "crypto";

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
  try {
    const albumRef = adminDb.collection("albums").doc(albumId);
    await albumRef.update({
      mediaCount: admin.firestore.FieldValue.increment(delta),
      updatedAt: new Date().toISOString()
    });
  } catch (err) {
    logger.warn("photos", `Failed to update media count for album ${albumId}`, err);
  }
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

  const buffer = Buffer.from(fileBase64, "base64");

  // Validate image magic bytes
  const validation = validateImageMagicBytes(
    buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  );
  if (!validation.valid) {
    throw new ApiError(400, validation.error || "File did not pass magic bytes verification.");
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
        ...existingPhotoData,
        albumId: albumId || existingPhotoData.albumId
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
  const storageFile = bucket.file(storageKey);

  await storageFile.save(buffer, {
    metadata: {
      contentType: mimeType,
      metadata: {
        importedBy: "ARES Unified Uploader",
      },
    },
    resumable: false,
  });

  const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(storageKey)}?alt=media`;

  // AI auto-labeling and caption
  let caption = "";
  let labels: string[] = [];
  if (runAiLabeling) {
    try {
      const aiResult = await generatePhotoCaptionAndLabels(buffer, mimeType);
      caption = aiResult.caption;
      labels = aiResult.labels;
    } catch (aiErr: any) {
      logger.warn("photos", "AI labeling failed during upload", aiErr);
    }
  }

  // Optional Google Photos upload
  let googleMediaItemId: string | null = null;
  if (uploadToGoogle) {
    try {
      const googleToken = await getGooglePhotosAccessToken();
      
      // 1. Upload raw bytes
      const uploadRes = await fetch("https://photoslibrary.googleapis.com/v1/uploads", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${googleToken}`,
          "Content-Type": "application/octet-stream",
          "X-Goog-Upload-File-Name": filename,
          "X-Goog-Upload-Protocol": "raw"
        },
        body: buffer
      });

      if (!uploadRes.ok) {
        const errorText = await uploadRes.text();
        throw new Error(`Google upload failed: ${uploadRes.status} ${errorText}`);
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
        const errorText = await batchRes.text();
        throw new Error(`Google batch create failed: ${batchRes.status} ${errorText}`);
      }

      const batchData = await batchRes.json();
      const creationResult = batchData.newMediaItemResults?.[0];
      if (creationResult?.status?.message && creationResult.status.message !== "Success") {
        throw new Error(`Google creation status not success: ${creationResult.status.message}`);
      }
      googleMediaItemId = creationResult?.mediaItem?.id || null;
    } catch (gErr: any) {
      logger.warn("photos", "Google Photos sync upload error", gErr.message || gErr);
    }
  }

  // Save metadata in Firestore imported_photos
  const photoMeta = {
    id: docId,
    storagePath: storageKey,
    publicUrl,
    originalFilename: filename,
    mimeType,
    fileSize: buffer.byteLength,
    importedAt: new Date().toISOString(),
    albumId: albumId || null,
    caption,
    labels,
    googleMediaItemId,
    sha256: imageHash
  };

  await adminDb.collection("imported_photos").doc(docId).set(photoMeta);

  // If album is specified, link and increment count
  if (albumId) {
    await updateAlbumMediaCount(albumId, 1);
    const albumRef = adminDb.collection("albums").doc(albumId);
    
    // Save inside album's photos subcollection for compatibility
    await albumRef.collection("photos").doc(docId).set(photoMeta);
  }

  res.json({ success: true, photo: photoMeta });
}));

export default router;
