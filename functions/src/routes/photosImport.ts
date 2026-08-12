import express from "express";
import admin, { adminDb, adminStorage } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { validateImageMagicBytes, sanitizeAlbumName } from "../lib/imageImport";
import { ensureAdmin } from "../middleware/auth";
import { distributedQuota } from "../middleware/distributedQuota";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import {
  deleteStoredPhotoAssets,
  generatePhotoDerivatives,
  storePhotoAssets,
  type StoredPhotoAssets,
} from "../lib/photoDerivatives";

const router = express.Router();

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

// POST /api/photos/import
router.post(
  "/import",
  ensureAdmin,
  distributedQuota({ scope: "photo-import", limit: 4, windowMs: 60 * 60 * 1000 }),
  asyncHandler(async (req, res) => {
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

  if (!Array.isArray(items) || items.length === 0 || items.length > 100) {
    throw new ApiError(400, "Choose between 1 and 100 photos per import.");
  }
  if (albumId && !/^[A-Za-z0-9_-]{1,200}$/.test(albumId)) throw new ApiError(400, "Invalid album ID.");
  if (albumId) {
    const album = await adminDb.collection("albums").doc(albumId).get();
    if (!album.exists || album.data()?.isDeleted === 1) throw new ApiError(400, "Choose an active album.");
  }

  logger.info("photos", `Starting ingestion of ${items.length} items on Firebase`);

  interface PhotoImportResult {
    mediaItemId: string;
    status: "success" | "failed";
    filename: string;
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
  let createdCount = 0;
  const storedAssetSets: StoredPhotoAssets[] = [];

  // EFF-F01 Batch Optimization: Read all existing photos in a single batch read
  const itemIds = items.map((item) => {
    if (!/^[A-Za-z0-9_-]{1,300}$/.test(item.id)) throw new ApiError(400, "A selected photo has an invalid ID.");
    return item.id;
  });
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

        let storedForItem: StoredPhotoAssets | null = null;
        try {
          const docSnap = docMap.get(item.id);

          if (docSnap && docSnap.exists) {
            results.push({
              mediaItemId: item.id,
              status: "success",
              filename,
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
          } catch (err: unknown) {
            throw new Error(`Invalid photo base URL format: ${errorMessage(err, "invalid URL")}`);
          }

          const downloadUrl = `${safeBaseUrl}=w2048-h2048`;
          const downloadRes = await fetch(downloadUrl, {
            headers: { Authorization: `Bearer ${googleToken}` },
            signal: AbortSignal.timeout(20_000),
          });

          if (!downloadRes.ok) {
            const errorText = await downloadRes.text().catch(() => "");
            throw new Error(`Google Photos download failed with status ${downloadRes.status}: ${errorText}`);
          }

          const buffer = await downloadRes.arrayBuffer();

          const validation = validateImageMagicBytes(buffer, 8 * 1024 * 1024, ["jpg", "png", "webp"]);
          if (!validation.valid) {
            throw new Error(validation.error ?? "File did not pass magic bytes verification");
          }
          if (validation.format !== "jpg") {
            throw new Error("Google Photos returned content that did not match its declared JPEG type");
          }

          const fileKey = `${baseFolder}/${item.id}-${filename}`;
          const imageBuffer = Buffer.from(buffer);
          const derivatives = await generatePhotoDerivatives(imageBuffer);
          storedForItem = await storePhotoAssets(
            bucket,
            {
              path: fileKey,
              mimeType,
              metadata: {
                googleMediaItemId: item.id,
                importedBy: "ARES Team Picker",
              },
            },
            `gallery/derivatives/${sanitizedAlbum}/${dateStr}/${item.id}`,
            derivatives,
          );

          const photoMeta = {
            id: item.id,
            ...storedForItem,
            originalFilename: filename,
            mimeType,
            fileSize: derivatives.original.fileSize,
            importedAt: new Date().toISOString(),
            albumId: albumId || null,
            isDeleted: 0,
            updatedAt: new Date().toISOString(),
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
          });

          successCount++;
          createdCount++;
          storedAssetSets.push(storedForItem);
        } catch (err: unknown) {
          if (storedForItem) await deleteStoredPhotoAssets(bucket, storedForItem);
          logger.error("photos", "A Google Photos import item failed", err);
          results.push({
            mediaItemId: item.id,
            status: "failed",
            filename,
            error: errorMessage(err, "Unknown import error"),
          });
          failedCount++;
        }
      })
    );
  }

  // The request is bounded to 100 items, so even with album mirrors this is at
  // most 200 document writes plus one album update—well below Firestore's 500
  // operation limit. Keep them atomic with the album count.
  if (batchOperations.length > 0) {
    try {
      const batch = adminDb.batch();
      for (const op of batchOperations) {
        batch.set(op.ref, op.data);
      }
      if (albumId && createdCount > 0) {
        batch.update(adminDb.collection("albums").doc(albumId), {
          mediaCount: admin.firestore.FieldValue.increment(createdCount),
          updatedAt: new Date().toISOString(),
        });
      }
      await batch.commit();
    } catch (error) {
      await Promise.all(storedAssetSets.map((assets) => deleteStoredPhotoAssets(bucket, assets)));
      throw error;
    }
    logger.info("photos", `Batch committed ${createdCount} new entries successfully`);
  }

  res.json({
    imported: successCount,
    failed: failedCount,
    results,
  });
  }),
);

export default router;
