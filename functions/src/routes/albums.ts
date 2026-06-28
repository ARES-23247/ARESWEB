import express from "express";
import admin, { adminDb } from "../lib/firebase-admin";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

const router = express.Router();

async function updateAlbumMediaCount(albumId: string, delta: number) {
  if (!albumId) return;
  try {
    const albumRef = adminDb.collection("albums").doc(albumId);
    await albumRef.update({
      mediaCount: admin.firestore.FieldValue.increment(delta),
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    logger.warn("photos", `Failed to update media count for album ${albumId}`, err.message);
  }
}

// GET /api/photos/albums
router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const albumsSnap = await adminDb
    .collection("albums")
    .orderBy("createdAt", "desc")
    .limit(100)
    .get();

  const albums = albumsSnap.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  }));

  res.json({ albums });
}));

// POST /api/photos/albums
router.post("/", ensureAdmin, asyncHandler(async (req, res) => {
  const { title, description, category, coverImageUrl, isPublic } = req.body as {
    title: string;
    description?: string;
    category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
    coverImageUrl?: string;
    isPublic?: boolean;
  };

  if (!title || !category) {
    throw new ApiError(400, "Missing required fields: title, category");
  }

  const albumId = title
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");

  const albumDocRef = adminDb.collection("albums").doc(albumId);
  const existing = await albumDocRef.get();

  if (existing.exists) {
    throw new ApiError(400, "An album with this title slug already exists.");
  }

  const newAlbum = {
    id: albumId,
    title,
    description: description || "",
    category,
    coverImageUrl: coverImageUrl || "",
    isPublic: isPublic ?? false,
    mediaCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await albumDocRef.set(newAlbum);
  res.json({ success: true, album: newAlbum });
}));

// PATCH /api/photos/albums/:albumId
router.patch("/:albumId", ensureAdmin, asyncHandler(async (req, res) => {
  const { albumId } = req.params;
  const { title, description, category, coverImageUrl, isPublic } = req.body as {
    title?: string;
    description?: string;
    category?: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
    coverImageUrl?: string;
    isPublic?: boolean;
  };

  const albumRef = adminDb.collection("albums").doc(albumId);
  const albumSnap = await albumRef.get();

  if (!albumSnap.exists) {
    throw new ApiError(404, "Album not found.");
  }

  const currentAlbum = albumSnap.data()!;
  const updatedAlbum = {
    ...currentAlbum,
    title: title !== undefined ? title : currentAlbum.title,
    description: description !== undefined ? description : currentAlbum.description,
    category: category !== undefined ? category : currentAlbum.category,
    coverImageUrl: coverImageUrl !== undefined ? coverImageUrl : (currentAlbum.coverImageUrl || ""),
    isPublic: isPublic !== undefined ? isPublic : (currentAlbum.isPublic ?? false),
    updatedAt: new Date().toISOString()
  };

  await albumRef.set(updatedAlbum);
  res.json({ success: true, album: updatedAlbum });
}));

// DELETE /api/photos/albums/:albumId
router.delete("/:albumId", ensureAdmin, asyncHandler(async (req, res) => {
  const { albumId } = req.params;
  const albumRef = adminDb.collection("albums").doc(albumId);
  const albumSnap = await albumRef.get();

  if (!albumSnap.exists) {
    throw new ApiError(404, "Album not found.");
  }

  // 1. Unassign all photos associated with this album
  const photosSnap = await adminDb
    .collection("imported_photos")
    .where("albumId", "==", albumId)
    .get();

  if (!photosSnap.empty) {
    const batchSize = 400;
    const docs = photosSnap.docs;
    for (let i = 0; i < docs.length; i += batchSize) {
      const batch = adminDb.batch();
      const chunk = docs.slice(i, i + batchSize);
      chunk.forEach((doc) => {
        batch.update(doc.ref, { albumId: null });
      });
      await batch.commit();
    }
  }

  // 2. Delete album from Firestore
  await albumRef.delete();

  res.json({ success: true });
}));

// POST /api/photos/albums/:albumId/add-photos
router.post("/:albumId/add-photos", ensureAdmin, asyncHandler(async (req, res) => {
  const { albumId } = req.params;
  const { photoIds } = req.body as { photoIds: string[] };

  if (!photoIds || !Array.isArray(photoIds) || photoIds.length === 0) {
    throw new ApiError(400, "Missing or invalid 'photoIds' array.");
  }

  const albumRef = adminDb.collection("albums").doc(albumId);
  const albumSnap = await albumRef.get();

  if (!albumSnap.exists) {
    throw new ApiError(404, "Album not found.");
  }

  let updatedCount = 0;
  const batch = adminDb.batch();

  for (const photoId of photoIds) {
    const photoRef = adminDb.collection("imported_photos").doc(photoId);
    const photoSnap = await photoRef.get();

    if (photoSnap.exists) {
      const photoData = photoSnap.data();
      const oldAlbumId = photoData?.albumId;

      if (oldAlbumId !== albumId) {
        // Decrement count in old album
        if (oldAlbumId) {
          try {
            await updateAlbumMediaCount(oldAlbumId, -1);
            const oldAlbumRef = adminDb.collection("albums").doc(oldAlbumId);
            await oldAlbumRef.collection("photos").doc(photoId).delete();
          } catch (err: any) {
            logger.warn("photos", `Failed to decrement count for old album ${oldAlbumId}`, err.message);
          }
        }

        // Update photo doc
        batch.update(photoRef, { albumId });

        // Copy to new album's photos subcollection
        const newAlbumPhotoRef = albumRef.collection("photos").doc(photoId);
        batch.set(newAlbumPhotoRef, { ...photoData, albumId });

        updatedCount++;
      }
    }
  }

  if (updatedCount > 0) {
    await batch.commit();
    await updateAlbumMediaCount(albumId, updatedCount);
  }

  res.json({ success: true, addedCount: updatedCount });
}));

export default router;
