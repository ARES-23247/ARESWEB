import express from "express";
import admin, { adminDb } from "../lib/firebase-admin";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import photosAuthRouter from "./photosAuth";
import albumsRouter from "./albums";
import photosImportRouter from "./photosImport";
import photosUploadRouter from "./photosUpload";
import rateLimit from "express-rate-limit";

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many photo requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

interface PhotoRecord {
  publicUrl?: unknown;
  originalFilename?: unknown;
  mimeType?: unknown;
  fileSize?: unknown;
  importedAt?: unknown;
  albumId?: unknown;
  caption?: unknown;
  altText?: unknown;
  labels?: unknown;
  capturedAt?: unknown;
  location?: unknown;
  description?: unknown;
  googleMediaItemId?: unknown;
  isDeleted?: unknown;
  archivedAt?: unknown;
}

function parseLimit(value: unknown, fallback: number, max: number): number {
  const parsed = typeof value === "string" ? Number.parseInt(value, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, max)) : fallback;
}

function safeId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return value;
}

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function safeHttpsUrl(value: unknown): string {
  if (typeof value !== "string") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : "";
  } catch {
    return "";
  }
}

function photoDto(id: string, data: PhotoRecord) {
  return {
    id,
    publicUrl: safeHttpsUrl(data.publicUrl),
    caption: text(data.caption, 500),
    altText: text(data.altText, 300),
    labels: Array.isArray(data.labels)
      ? data.labels.filter((label): label is string => typeof label === "string").slice(0, 20).map((label) => label.slice(0, 40))
      : [],
    albumId: typeof data.albumId === "string" ? data.albumId : null,
    mimeType: typeof data.mimeType === "string" && data.mimeType.startsWith("image/") ? data.mimeType : "image/jpeg",
    fileSize: typeof data.fileSize === "number" && data.fileSize >= 0 ? data.fileSize : 0,
    importedAt: typeof data.importedAt === "string" ? data.importedAt : "",
    capturedAt: typeof data.capturedAt === "string" ? data.capturedAt : undefined,
    isSynced: typeof data.googleMediaItemId === "string" && data.googleMediaItemId.length > 0,
    isArchived: data.isDeleted === 1,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : undefined,
  };
}

async function withCursor(query: FirebaseFirestore.Query, cursor: unknown): Promise<FirebaseFirestore.Query> {
  if (typeof cursor !== "string" || !cursor) return query;
  const id = safeId(cursor, "photo cursor");
  const snapshot = await adminDb.collection("imported_photos").doc(id).get();
  if (!snapshot.exists) throw new ApiError(400, "Photo cursor was not found.");
  return query.startAfter(snapshot);
}

router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, 30, 50);
  const includeArchived = req.query.includeArchived === "true";
  const albumId = typeof req.query.albumId === "string" && req.query.albumId
    ? safeId(req.query.albumId, "album ID")
    : undefined;
  let query: FirebaseFirestore.Query = adminDb.collection("imported_photos");
  if (albumId) query = query.where("albumId", "==", albumId);
  query = query.orderBy("importedAt", "desc");
  query = await withCursor(query, req.query.cursor);
  const snapshot = await query.limit(limit + 1).get();
  const visible = snapshot.docs.filter((doc) => includeArchived || doc.data().isDeleted !== 1);
  const page = visible.slice(0, limit);
  res.json({
    photos: page.map((doc) => photoDto(doc.id, doc.data())),
    hasMore: snapshot.docs.length > limit,
    nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1]?.id ?? null : null,
  });
}));

router.get("/public", asyncHandler(async (req, res) => {
  const limit = parseLimit(req.query.limit, 24, 50);
  const albumsSnapshot = await adminDb.collection("albums").where("isPublic", "==", true).limit(50).get();
  const publicAlbums = new Map<string, string>();
  for (const album of albumsSnapshot.docs) {
    const data = album.data();
    if (data.isDeleted !== 1) publicAlbums.set(album.id, text(data.category, 60));
  }
  if (publicAlbums.size === 0) {
    res.json({ photos: [], hasMore: false, nextCursor: null });
    return;
  }

  let query: FirebaseFirestore.Query = adminDb.collection("imported_photos").orderBy("importedAt", "desc");
  query = await withCursor(query, req.query.cursor);
  const snapshot = await query.limit(250).get();
  const visible = snapshot.docs.filter((doc) => {
    const data = doc.data();
    return data.isDeleted !== 1 && typeof data.albumId === "string" && publicAlbums.has(data.albumId);
  });
  const page = visible.slice(0, limit);
  const photos = page.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      publicUrl: safeHttpsUrl(data.publicUrl),
      caption: text(data.caption, 500) || undefined,
      altText: text(data.altText, 300) || undefined,
      category: typeof data.albumId === "string" ? publicAlbums.get(data.albumId) || undefined : undefined,
      capturedAt: typeof data.capturedAt === "string" ? data.capturedAt : undefined,
      location: text(data.location, 120) || undefined,
      description: text(data.description, 1_000) || undefined,
    };
  }).filter((photo) => photo.publicUrl);
  res.json({
    photos,
    hasMore: visible.length > limit || snapshot.docs.length === 250,
    nextCursor: page.length ? page[page.length - 1].id : null,
  });
}));

router.use("/albums", albumsRouter);
router.use("/", photosImportRouter);
router.use("/", photosUploadRouter);
router.use("/", photosAuthRouter);

router.patch("/:photoId", ensureTeamMember, asyncHandler(async (req, res) => {
  const photoId = safeId(req.params.photoId, "photo ID");
  const input = req.body as { albumId?: unknown; caption?: unknown; labels?: unknown; altText?: unknown };
  const photoRef = adminDb.collection("imported_photos").doc(photoId);
  const snapshot = await photoRef.get();
  if (!snapshot.exists) throw new ApiError(404, "Photo not found.");
  const current = snapshot.data() as PhotoRecord;
  if (current.isDeleted === 1) throw new ApiError(409, "Restore the photo before editing it.");

  const albumId = input.albumId === null || input.albumId === ""
    ? null
    : input.albumId === undefined
      ? (typeof current.albumId === "string" ? current.albumId : null)
      : safeId(input.albumId, "album ID");
  if (albumId) {
    const album = await adminDb.collection("albums").doc(albumId).get();
    if (!album.exists || album.data()?.isDeleted === 1) throw new ApiError(400, "Choose an active album.");
  }
  const labels = input.labels === undefined
    ? (Array.isArray(current.labels) ? current.labels : [])
    : Array.isArray(input.labels)
      ? input.labels.map((value) => text(value, 40)).filter(Boolean).slice(0, 20)
      : null;
  if (!labels) throw new ApiError(400, "Labels must be a list of text values.");
  const now = new Date().toISOString();
  const update = {
    caption: input.caption === undefined ? text(current.caption, 500) : text(input.caption, 500),
    altText: input.altText === undefined ? text(current.altText, 300) : text(input.altText, 300),
    labels,
    albumId,
    updatedAt: now,
  };

  const oldAlbumId = typeof current.albumId === "string" ? current.albumId : null;
  const batch = adminDb.batch();
  batch.set(photoRef, update, { merge: true });
  if (oldAlbumId && oldAlbumId !== albumId) {
    const oldAlbum = adminDb.collection("albums").doc(oldAlbumId);
    batch.update(oldAlbum, { mediaCount: admin.firestore.FieldValue.increment(-1), updatedAt: now });
    batch.delete(oldAlbum.collection("photos").doc(photoId));
  }
  if (albumId) {
    const album = adminDb.collection("albums").doc(albumId);
    if (oldAlbumId !== albumId) batch.update(album, { mediaCount: admin.firestore.FieldValue.increment(1), updatedAt: now });
    batch.set(album.collection("photos").doc(photoId), { ...current, ...update }, { merge: true });
  }
  await batch.commit();
  res.json({ success: true, photo: photoDto(photoId, { ...current, ...update }) });
}));

router.delete("/:photoId", ensureAdmin, asyncHandler(async (req, res) => {
  const photoId = safeId(req.params.photoId, "photo ID");
  const photoRef = adminDb.collection("imported_photos").doc(photoId);
  const snapshot = await photoRef.get();
  if (!snapshot.exists) throw new ApiError(404, "Photo not found.");
  const data = snapshot.data() as PhotoRecord;
  if (data.isDeleted === 1) {
    res.json({ success: true, archived: true, alreadyArchived: true });
    return;
  }
  const archivedAt = new Date().toISOString();
  const batch = adminDb.batch();
  batch.set(photoRef, { isDeleted: 1, archivedAt, updatedAt: archivedAt }, { merge: true });
  if (typeof data.albumId === "string") {
    const album = adminDb.collection("albums").doc(data.albumId);
    batch.update(album, { mediaCount: admin.firestore.FieldValue.increment(-1), updatedAt: archivedAt });
    batch.set(album.collection("photos").doc(photoId), { isDeleted: 1, archivedAt }, { merge: true });
  }
  await batch.commit();
  res.json({ success: true, archived: true });
}));

router.post("/:photoId/restore", ensureAdmin, asyncHandler(async (req, res) => {
  const photoId = safeId(req.params.photoId, "photo ID");
  const photoRef = adminDb.collection("imported_photos").doc(photoId);
  const snapshot = await photoRef.get();
  if (!snapshot.exists) throw new ApiError(404, "Photo not found.");
  const data = snapshot.data() as PhotoRecord;
  if (data.isDeleted !== 1) {
    res.json({ success: true, restored: true, photo: photoDto(photoId, data) });
    return;
  }
  const restoredAt = new Date().toISOString();
  const batch = adminDb.batch();
  batch.set(photoRef, { isDeleted: 0, archivedAt: null, restoredAt, updatedAt: restoredAt }, { merge: true });
  if (typeof data.albumId === "string") {
    const album = adminDb.collection("albums").doc(data.albumId);
    batch.update(album, { mediaCount: admin.firestore.FieldValue.increment(1), updatedAt: restoredAt });
    batch.set(album.collection("photos").doc(photoId), { ...data, isDeleted: 0, archivedAt: null, restoredAt }, { merge: true });
  }
  await batch.commit();
  res.json({ success: true, restored: true, photo: photoDto(photoId, { ...data, isDeleted: 0, archivedAt: null }) });
}));

export default router;
