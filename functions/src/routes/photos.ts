import express from "express";
import admin, { adminDb, adminStorage } from "../lib/firebase-admin";
import { getGooglePhotosAccessToken } from "../lib/googleAuth";
import { validateImageMagicBytes, sanitizeAlbumName } from "../lib/imageImport";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { generatePhotoCaptionAndLabels } from "../lib/vertex";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import photosAuthRouter from "./photosAuth";
import albumsRouter from "./albums";
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

// Helper to increment/decrement album media count atomically
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

// GET /api/photos
router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  let query = adminDb.collection("imported_photos")
    .orderBy("importedAt", "desc")
    .limit(limit + 1);  // +1 to detect hasMore

  if (cursor) {
    const cursorDoc = await adminDb.collection("imported_photos").doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snap = await query.get();
  const hasMore = snap.docs.length > limit;
  const photos = snap.docs.slice(0, limit).map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  res.json({
    photos,
    hasMore,
    nextCursor: hasMore ? photos[photos.length - 1].id : null,
  });
}));

// GET /api/photos/public
router.get("/public", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const cursor = req.query.cursor as string | undefined;

  const publicAlbumsSnap = await adminDb
    .collection("albums")
    .where("isPublic", "==", true)
    .limit(100)
    .get();

  const publicAlbumIds = publicAlbumsSnap.docs.map(doc => doc.id);

  if (publicAlbumIds.length === 0) {
    res.json({ photos: [], hasMore: false, nextCursor: null });
    return;
  }

  let cursorDoc: admin.firestore.DocumentSnapshot | null = null;
  if (cursor) {
    cursorDoc = await adminDb.collection("imported_photos").doc(cursor).get();
  }

  // Chunk publicAlbumIds in sizes of 30 for Firestore 'in' query
  const chunks = [];
  for (let i = 0; i < publicAlbumIds.length; i += 30) {
    chunks.push(publicAlbumIds.slice(i, i + 30));
  }

  let rawPhotos: admin.firestore.DocumentData[] = [];
  for (const chunk of chunks) {
    let q = adminDb.collection("imported_photos")
      .where("albumId", "in", chunk)
      .orderBy("importedAt", "desc")
      .limit(limit + 1);
    
    if (cursorDoc && cursorDoc.exists) {
      q = q.startAfter(cursorDoc);
    }
    
    const snap = await q.get();
    snap.docs.forEach(doc => {
      rawPhotos.push({
        id: doc.id,
        ...doc.data()
      });
    });
  }

  // Sort if multiple chunks
  if (chunks.length > 1) {
    rawPhotos.sort((a, b) => {
      const timeA = new Date(a.importedAt).getTime();
      const timeB = new Date(b.importedAt).getTime();
      return timeB - timeA;
    });
  }

  const hasMore = rawPhotos.length > limit;
  const photos = rawPhotos.slice(0, limit);

  res.json({
    photos,
    hasMore,
    nextCursor: hasMore ? photos[photos.length - 1].id : null
  });
}));

// Mount Albums Sub-Router
router.use("/albums", albumsRouter);



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

          if (!baseUrl.startsWith("https://lh3.googleusercontent.com/")) {
            throw new Error("Invalid photo base URL domain");
          }

          // Downscale to max 2048px on Google Photos side (which also transcodes to JPEG)
          const downloadUrl = `${baseUrl}=w2048-h2048`;
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

// Mount Google Auth & Media Picker session endpoints
router.use("/", photosAuthRouter);

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

// PATCH /api/photos/:photoId
// Update photo metadata: albumId, caption, labels, altText
router.patch("/:photoId", ensureTeamMember, asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  const { albumId, caption, labels, altText } = req.body as {
    albumId?: string | null;
    caption?: string;
    labels?: string[];
    altText?: string;
  };

  const photoRef = adminDb.collection("imported_photos").doc(photoId);
  const photoSnap = await photoRef.get();

  if (!photoSnap.exists) {
    throw new ApiError(404, "Photo not found.");
  }

  const currentPhoto = photoSnap.data()!;
  const oldAlbumId = currentPhoto.albumId || null;
  const newAlbumId = albumId !== undefined ? albumId : oldAlbumId;

  // Build updated metadata object
  const updatedPhoto = {
    ...currentPhoto,
    caption: caption !== undefined ? caption : (currentPhoto.caption || ""),
    labels: labels !== undefined ? labels : (currentPhoto.labels || []),
    altText: altText !== undefined ? altText : (currentPhoto.altText || ""),
    albumId: newAlbumId
  };

  // Update in root imported_photos collection
  await photoRef.set(updatedPhoto);

  // Handle album association changes
  if (oldAlbumId !== newAlbumId) {
    // 1. Decrement old album count and delete subcollection doc
    if (oldAlbumId) {
      await updateAlbumMediaCount(oldAlbumId, -1);
      const oldAlbumRef = adminDb.collection("albums").doc(oldAlbumId);
      await oldAlbumRef.collection("photos").doc(photoId).delete();
    }

    // 2. Increment new album count and set subcollection doc
    if (newAlbumId) {
      await updateAlbumMediaCount(newAlbumId, 1);
      const newAlbumRef = adminDb.collection("albums").doc(newAlbumId);
      await newAlbumRef.collection("photos").doc(photoId).set(updatedPhoto);
    }
  } else {
    // If album is unchanged and exists, update the copy inside the album's photos subcollection
    if (newAlbumId) {
      const albumRef = adminDb.collection("albums").doc(newAlbumId);
      await albumRef.collection("photos").doc(photoId).set(updatedPhoto);
    }
  }

  res.json({ success: true, photo: updatedPhoto });
}));

// DELETE /api/photos/:photoId
router.delete("/:photoId", ensureAdmin, asyncHandler(async (req, res) => {
  const { photoId } = req.params;
  const photoRef = adminDb.collection("imported_photos").doc(photoId);
  const photoSnap = await photoRef.get();

  if (!photoSnap.exists) {
    throw new ApiError(404, "Photo not found.");
  }

  const photoData = photoSnap.data();
  const storagePath = photoData?.storagePath;
  const albumId = photoData?.albumId;

  // 1. Delete from Firebase Storage
  if (storagePath) {
    try {
      const bucket = adminStorage.bucket();
      await bucket.file(storagePath).delete();
    } catch (storageErr: any) {
      logger.warn("photos", "Storage file delete failed or didn't exist", storageErr.message);
    }
  }

  // 2. If part of an album, decrement count and delete from subcollection
  if (albumId) {
    try {
      await updateAlbumMediaCount(albumId, -1);
      const albumRef = adminDb.collection("albums").doc(albumId);
      await albumRef.collection("photos").doc(photoId).delete();
    } catch (albumErr: any) {
      logger.warn("photos", "Failed to update album metadata during delete", albumErr.message);
    }
  }

  // 3. Delete from Firestore imported_photos
  await photoRef.delete();

  res.json({ success: true });
}));



export default router;
