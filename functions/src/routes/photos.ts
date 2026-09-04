import express from "express";
import { isPublishedContent } from "../lib/contentVisibility";
import { adminDb, adminFieldValue } from "../lib/firebase-admin";
import { ensureAdmin, ensureTeamMember, type AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import photosAuthRouter from "./photosAuth";
import albumsRouter from "./albums";
import photosImportRouter from "./photosImport";
import photosUploadRouter from "./photosUpload";
import sponsorLogoUploadRouter from "./sponsorLogoUpload";
import rateLimit from "express-rate-limit";
import { photoDerivativeDtoFields } from "../lib/photoDerivatives";
import {
  managedPhotoGatewayUrls,
  parseManagedPhotoVariant,
  safeManagedPhotoPath,
  streamManagedPhoto,
  type ManagedPhotoRecord,
} from "../lib/managedPhotoMedia";

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many photo requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
}));

interface PhotoRecord extends Record<string, unknown> {
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
  const gatewayUrls = managedPhotoGatewayUrls(id, "admin");
  const hasManagedOriginal = Boolean(safeManagedPhotoPath(data.storagePath));
  return {
    id,
    publicUrl: hasManagedOriginal ? gatewayUrls.publicUrl : safeHttpsUrl(data.publicUrl),
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
    ...photoDerivativeDtoFields(data),
    thumbnailUrl: safeManagedPhotoPath(data.thumbnailPath)
      ? gatewayUrls.thumbnailUrl
      : photoDerivativeDtoFields(data).thumbnailUrl,
    mediumUrl: safeManagedPhotoPath(data.mediumPath)
      ? gatewayUrls.mediumUrl
      : photoDerivativeDtoFields(data).mediumUrl,
  };
}

type ContentMediaCollection = "posts" | "docs" | "documents";
const CONTENT_MEDIA_COLLECTIONS = new Set<ContentMediaCollection>([
  "posts",
  "docs",
  "documents",
]);

function contentMediaCollection(value: unknown): ContentMediaCollection {
  if (typeof value !== "string" || !CONTENT_MEDIA_COLLECTIONS.has(value as ContentMediaCollection)) {
    throw new ApiError(404, "Published content not found.", "CONTENT_NOT_FOUND");
  }
  return value as ContentMediaCollection;
}

function includesPublishedPhoto(data: Record<string, unknown>, photoId: string): boolean {
  const mediaPhotoIds = Array.isArray(data.mediaPhotoIds)
    ? data.mediaPhotoIds.filter((value): value is string => typeof value === "string").slice(0, 100)
    : [];
  return isPublishedContent(data)
    && mediaPhotoIds.includes(photoId);
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

  const cursor = typeof req.query.cursor === "string" && req.query.cursor
    ? await adminDb.collection("imported_photos").doc(safeId(req.query.cursor, "photo cursor")).get()
    : null;
  if (cursor && !cursor.exists) throw new ApiError(400, "Photo cursor was not found.");

  const albumIds = [...publicAlbums.keys()];
  const albumChunks = Array.from(
    { length: Math.ceil(albumIds.length / 30) },
    (_, index) => albumIds.slice(index * 30, index * 30 + 30),
  );
  const snapshots = await Promise.all(albumChunks.map(async (ids) => {
    let query: FirebaseFirestore.Query = adminDb.collection("imported_photos")
      .where("albumId", "in", ids)
      .orderBy("importedAt", "desc");
    if (cursor) query = query.startAfter(cursor);
    return query.limit(limit + 1).get();
  }));
  const candidates = snapshots.flatMap((snapshot) => snapshot.docs)
    .filter((doc) => doc.data().isDeleted !== 1 && (Boolean(safeHttpsUrl(doc.data().publicUrl)) || Boolean(safeManagedPhotoPath(doc.data().storagePath))))
    .sort((left, right) => {
      const leftDate = typeof left.data().importedAt === "string" ? left.data().importedAt : "";
      const rightDate = typeof right.data().importedAt === "string" ? right.data().importedAt : "";
      return rightDate.localeCompare(leftDate) || right.id.localeCompare(left.id);
    });
  const page = candidates.slice(0, limit);
  const photos = page.map((doc) => {
    const data = doc.data();
    const hasStoragePath = Boolean(safeManagedPhotoPath(data.storagePath));
    const publicUrl = hasStoragePath
      ? `/api/photos/public/media/${doc.id}/original`
      : safeHttpsUrl(data.publicUrl);
    const derivativeFields = photoDerivativeDtoFields(data);
    const thumbnailUrl = Boolean(safeManagedPhotoPath(data.thumbnailPath))
      ? `/api/photos/public/media/${doc.id}/thumbnail`
      : derivativeFields.thumbnailUrl;
    const mediumUrl = Boolean(safeManagedPhotoPath(data.mediumPath))
      ? `/api/photos/public/media/${doc.id}/medium`
      : derivativeFields.mediumUrl;

    return {
      id: doc.id,
      publicUrl,
      caption: text(data.caption, 500) || undefined,
      altText: text(data.altText, 300) || undefined,
      category: typeof data.albumId === "string" ? publicAlbums.get(data.albumId) || undefined : undefined,
      capturedAt: typeof data.capturedAt === "string" ? data.capturedAt : undefined,
      location: text(data.location, 120) || undefined,
      description: text(data.description, 1_000) || undefined,
      ...derivativeFields,
      thumbnailUrl,
      mediumUrl,
    };
  }).filter((photo) => photo.publicUrl);
  res.json({
    photos,
    hasMore: candidates.length > limit || snapshots.some((snapshot) => snapshot.docs.length > limit),
    nextCursor: page.length ? page[page.length - 1].id : null,
  });
}));

router.get("/public/media/:photoId/:variant", asyncHandler(async (req, res) => {
  const photoId = safeId(req.params.photoId, "photo ID");
  const variant = parseManagedPhotoVariant(req.params.variant);

  const photoDoc = await adminDb.collection("imported_photos").doc(photoId).get();
  if (!photoDoc.exists) {
    throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
  }

  const data = (photoDoc.data() || {}) as PhotoRecord;
  if (data.isDeleted === 1) {
    throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
  }

  if (typeof data.albumId !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(data.albumId)) {
    throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
  }
  const albumDoc = await adminDb.collection("albums").doc(data.albumId).get();
  if (!albumDoc.exists || albumDoc.data()?.isPublic !== true || albumDoc.data()?.isDeleted === 1) {
    throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
  }

  await streamManagedPhoto(res, req.headers["if-none-match"], data, variant, "public");
}));

router.get(
  "/public/content/:collection/:contentId/:photoId/:variant",
  asyncHandler(async (req, res) => {
    const collection = contentMediaCollection(req.params.collection);
    const contentId = safeId(req.params.contentId, "content ID");
    const photoId = safeId(req.params.photoId, "photo ID");
    const variant = parseManagedPhotoVariant(req.params.variant);
    const [contentDoc, photoDoc] = await Promise.all([
      adminDb.collection(collection).doc(contentId).get(),
      adminDb.collection("imported_photos").doc(photoId).get(),
    ]);
    const contentData = (contentDoc.data() || {}) as Record<string, unknown>;
    const photoData = (photoDoc.data() || {}) as ManagedPhotoRecord;
    if (
      !contentDoc.exists ||
      !photoDoc.exists ||
      !includesPublishedPhoto(contentData, photoId) ||
      photoData.isDeleted === 1
    ) {
      throw new ApiError(404, "Published content media not found.", "PHOTO_NOT_FOUND");
    }
    await streamManagedPhoto(
      res,
      req.headers["if-none-match"],
      photoData,
      variant,
      "public",
    );
  }),
);

router.get(
  "/admin/media/:photoId/:variant",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const photoId = safeId(req.params.photoId, "photo ID");
    const variant = parseManagedPhotoVariant(req.params.variant);
    const photoDoc = await adminDb.collection("imported_photos").doc(photoId).get();
    if (!photoDoc.exists) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    await streamManagedPhoto(
      res,
      req.headers["if-none-match"],
      (photoDoc.data() || {}) as ManagedPhotoRecord,
      variant,
      "admin",
    );
  }),
);

router.use("/albums", albumsRouter);
router.use("/", photosImportRouter);
router.use("/", photosUploadRouter);
router.use("/", sponsorLogoUploadRouter);
router.use("/", photosAuthRouter);

router.patch("/:photoId", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
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
    // Placing media into a public album publishes it on the website, so it
    // requires a publisher role rather than general membership.
    const publisherRoles = new Set(["admin", "coach", "mentor"]);
    const isAlbumPublic = album.data()?.isPublic === 1 || album.data()?.isPublic === true;
    const changedAlbum = albumId !== (typeof current.albumId === "string" ? current.albumId : null);
    if (isAlbumPublic && changedAlbum && !publisherRoles.has(req.authorizationRole || "")) {
      throw new ApiError(403, "Only an admin, coach, or mentor can add photos to a public album.");
    }
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
    batch.update(oldAlbum, { mediaCount: adminFieldValue.increment(-1), updatedAt: now });
    batch.delete(oldAlbum.collection("photos").doc(photoId));
  }
  if (albumId) {
    const album = adminDb.collection("albums").doc(albumId);
    if (oldAlbumId !== albumId) batch.update(album, { mediaCount: adminFieldValue.increment(1), updatedAt: now });
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
    batch.update(album, { mediaCount: adminFieldValue.increment(-1), updatedAt: archivedAt });
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
    batch.update(album, { mediaCount: adminFieldValue.increment(1), updatedAt: restoredAt });
    batch.set(album.collection("photos").doc(photoId), { ...data, isDeleted: 0, archivedAt: null, restoredAt }, { merge: true });
  }
  await batch.commit();
  res.json({ success: true, restored: true, photo: photoDto(photoId, { ...data, isDeleted: 0, archivedAt: null }) });
}));

export default router;
