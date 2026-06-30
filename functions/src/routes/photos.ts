import express from "express";
import admin, { adminDb, adminStorage } from "../lib/firebase-admin";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import photosAuthRouter from "./photosAuth";
import albumsRouter from "./albums";
import photosImportRouter from "./photosImport";
import photosUploadRouter from "./photosUpload";
import rateLimit from "express-rate-limit";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

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
  const albumId = req.query.albumId as string | undefined;

  let query: admin.firestore.Query = adminDb.collection("imported_photos");

  if (albumId) {
    query = query.where("albumId", "==", albumId);
  }

  // Filter out soft-deleted items if applicable, order by import time
  query = query.orderBy("importedAt", "desc");

  if (cursor) {
    const cursorSnap = await adminDb.collection("imported_photos").doc(cursor).get();
    if (cursorSnap.exists) {
      query = query.startAfter(cursorSnap);
    }
  }

  // Fetch limit + 1 to check if there is a next page
  const snapshot = await query.limit(limit + 1).get();

  const rawPhotos: any[] = [];
  snapshot.docs.forEach((doc) => {
    rawPhotos.push({
      id: doc.id,
      ...doc.data()
    });
  });

  const hasMore = rawPhotos.length > limit;
  const photos = rawPhotos.slice(0, limit);

  res.json({
    photos,
    hasMore,
    nextCursor: hasMore ? photos[photos.length - 1].id : null
  });
}));

// GET /api/photos/public (fetch public photos across public albums)
router.get("/public", asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const cursor = req.query.cursor as string | undefined;

  // 1. Fetch public albums
  const albumsSnap = await adminDb
    .collection("albums")
    .where("isPublic", "==", true)
    .get();

  if (albumsSnap.empty) {
    res.json({ photos: [], hasMore: false, nextCursor: null });
    return;
  }

  const publicAlbumIds = albumsSnap.docs.map((doc) => doc.id);

  // 2. Fetch photos belonging to any public albums in chunks of 30 due to Firestore in limits
  const chunks: string[][] = [];
  const chunkSize = 30;
  for (let i = 0; i < publicAlbumIds.length; i += chunkSize) {
    chunks.push(publicAlbumIds.slice(i, i + chunkSize));
  }

  const rawPhotos: any[] = [];
  for (const chunk of chunks) {
    let query: admin.firestore.Query = adminDb.collection("imported_photos").where("albumId", "in", chunk);

    // Filter using cursor
    if (cursor) {
      const cursorSnap = await adminDb.collection("imported_photos").doc(cursor).get();
      if (cursorSnap.exists) {
        query = query.startAfter(cursorSnap);
      }
    }

    const snapshot = await query.orderBy("importedAt", "desc").limit(limit + 1).get();
    snapshot.docs.forEach((doc) => {
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

// Mount Ingestion Sub-Router
router.use("/", photosImportRouter);

// Mount Upload Sub-Router
router.use("/", photosUploadRouter);

// Mount Google Auth & Media Picker session endpoints
router.use("/", photosAuthRouter);

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
