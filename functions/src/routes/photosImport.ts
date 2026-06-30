import express from "express";
import admin, { adminDb, adminStorage } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { validateImageMagicBytes, sanitizeAlbumName } from "../lib/imageImport";
import { ensureAdmin } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

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

// POST /api/photos/import
router.post("/import", ensureAdmin, asyncHandler(async (req, res) => {
  const { items, albumId, albumName } = req.body as {
    items: Array<{
      id: string;
      baseUrl?: string;
      filename?: string;
      mimeType?: string;
      mediaFile?: {
        baseUrl?: string;
        filename?: string;
        mimeType?: string;
      };
    }>;
    albumId?: string;
    albumName?: string;
  };

  if (!items || items.length === 0) {
    throw new ApiError(400, "No items provided for import");
  }

  logger.info("photos", `Starting ingestion of ${items.length} items on Firebase`);

  interface PhotoImportResult {
    mediaItemId: string;
    status: "success" | "failed";
    filename: string;
    storagePath?: string;
    publicUrl?: string;
    error?: string;
  }

  const googleToken = await getGooglePhotosAccessToken();
  const bucket = adminStorage.bucket();
  const results: PhotoImportResult[] = [];

  const dateStr = new Date().toISOString().split("T")[0];
  const sanitizedAlbum = albumName ? sanitizeAlbumName(albumName) : "imported";
  const baseFolder = `gallery/${sanitizedAlbum}/${dateStr}`;

  let successCount = 0;
  let failedCount = 0;

  // EFF-F01 Batch Optimization: Read all existing photos in a single batch read
  const itemIds = items.map(item => item.id);
  const docRefs = itemIds.map(id => adminDb.collection("imported_photos").doc(id));
  const docSnaps = await adminDb.getAll(...docRefs);
  const docMap = new Map(docSnaps.map(snap => [snap.id, snap]));

  // We compile writes in an array of operations to commit in chunks
  const batchOperations: { ref: admin.firestore.DocumentReference; data: admin.firestore.DocumentData }[] = [];

  // Process items in parallel chunks of 4 for downloads & GCS uploads
  const chunkArray = <T>(arr: T[], size: number): T[][] => {
    const chunks: T[][] = [];
    for (let i = 0; i < arr.length; i += size) {
      chunks.push(arr.slice(i, i + size));
    }
    return chunks;
  };

  const itemChunks = chunkArray(items, 4);
  for (const chunk of itemChunks) {
    await Promise.all(
      chunk.map(async (item) => {
        const baseUrl = item.baseUrl || item.mediaFile?.baseUrl;
        let filename = item.filename || item.mediaFile?.filename || `photo-${item.id}.jpg`;

        // Google Photos API returns a JPEG when downscaling via =w2048-h2048.
        // Force mimeType to image/jpeg and map extensions to .jpg (including HEIC/PNG/WEBP).
        const lowerName = filename.toLowerCase();
        if (lowerName.endsWith(".heic") || lowerName.endsWith(".heif") || lowerName.endsWith(".png") || lowerName.endsWith(".webp") || lowerName.endsWith(".jpeg")) {
          filename = filename.replace(/\.(heic|heif|png|webp|jpeg)$/i, ".jpg");
        }
        const mimeType = "image/jpeg";

        try {
          const docSnap = docMap.get(item.id);

          if (docSnap && docSnap.exists) {
            const existingData = docSnap.data();
            results.push({
              mediaItemId: item.id,
              status: "success",
              filename,
              storagePath: existingData?.storagePath,
              publicUrl: existingData?.publicUrl,
            });
            successCount++;
            return;
          }

          if (!baseUrl) {
            throw new Error("No download URL provided for photo.");
          }

          let safeBaseUrl: string;
          try {
            const parsedUrl = new URL(baseUrl);
            if (parsedUrl.protocol !== "https:") {
              throw new Error("Invalid URL protocol");
            }
            if (parsedUrl.hostname !== "lh3.googleusercontent.com") {
              throw new Error("Invalid photo base URL domain");
            }
            safeBaseUrl = `https://${parsedUrl.hostname}${parsedUrl.pathname}`;
          } catch (err: any) {
            throw new Error(`Invalid photo base URL format: ${err.message}`);
          }

          const downloadUrl = `${safeBaseUrl}=w2048-h2048`;
          const downloadRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${googleToken}` },
          });

          if (!downloadRes.ok) {
            const errorText = await downloadRes.text().catch(() => "");
            throw new Error(`Google Photos download failed with status ${downloadRes.status}: ${errorText}`);
          }

          const buffer = await downloadRes.arrayBuffer();

          const validation = validateImageMagicBytes(buffer);
          if (!validation.valid) {
            throw new Error(validation.error ?? "File did not pass magic bytes verification");
          }

          const fileKey = `${baseFolder}/${item.id}-${filename}`;
          const storageFile = bucket.file(fileKey);

          await storageFile.save(Buffer.from(buffer), {
            metadata: {
              contentType: mimeType,
              metadata: {
                googleMediaItemId: item.id,
                importedBy: "ARES Team Picker",
              },
            },
            resumable: false,
          });

          const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(fileKey)}?alt=media`;

          const photoMeta = {
            id: item.id,
            storagePath: fileKey,
            publicUrl,
            originalFilename: filename,
            mimeType,
            fileSize: buffer.byteLength,
            importedAt: new Date().toISOString(),
            albumId: albumId || null,
          };

          const photoRef = adminDb.collection("imported_photos").doc(item.id);
          batchOperations.push({ ref: photoRef, data: photoMeta });

          if (albumId) {
            const albumPhotoRef = adminDb
              .collection("albums")
              .doc(albumId)
              .collection("photos")
              .doc(item.id);
            batchOperations.push({ ref: albumPhotoRef, data: photoMeta });
          }

          results.push({
            mediaItemId: item.id,
            status: "success",
            filename,
            storagePath: fileKey,
            publicUrl,
          });

          successCount++;
        } catch (err: any) {
          logger.error("photos", `Import item error - ID: ${item.id}, Filename: ${filename}`, err);
          results.push({
            mediaItemId: item.id,
            status: "failed",
            filename,
            error: err.message || "Unknown import error",
          });
          failedCount++;
        }
      })
    );
  }

  // Commit all Firestore writes in chunks of max 400 operations to prevent 500 limit crash
  if (batchOperations.length > 0) {
    const batchSize = 400;
    for (let i = 0; i < batchOperations.length; i += batchSize) {
      const batch = adminDb.batch();
      const slice = batchOperations.slice(i, i + batchSize);
      for (const op of slice) {
        batch.set(op.ref, op.data);
      }
      await batch.commit();
    }
    logger.info("photos", `Batch committed ${successCount} entries successfully`);
  }

  if (albumId && successCount > 0) {
    await updateAlbumMediaCount(albumId, successCount);
  }

  res.json({
    imported: successCount,
    failed: failedCount,
    results,
  });
}));

export default router;
