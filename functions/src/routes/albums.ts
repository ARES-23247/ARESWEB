import express from "express";
import admin, { adminDb } from "../lib/firebase-admin";
import { ensureAdmin, ensureTeamMember } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const CATEGORIES = ["Robot Specs", "Outreach", "Competition", "CAD Design", "Practice"] as const;
type AlbumCategory = typeof CATEGORIES[number];

interface AlbumRecord {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  coverImageUrl?: unknown;
  isPublic?: unknown;
  mediaCount?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  isDeleted?: unknown;
  archivedAt?: unknown;
}

interface AlbumInput {
  title?: unknown;
  description?: unknown;
  category?: unknown;
  coverImageUrl?: unknown;
  isPublic?: unknown;
}

function safeId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(value)) throw new ApiError(400, `Invalid ${label}.`);
  return value;
}

function text(value: unknown, field: string, max: number, required = false): string {
  if (value === undefined && !required) return "";
  if (typeof value !== "string") throw new ApiError(400, `${field} must be text.`);
  const clean = value.trim();
  if (required && !clean) throw new ApiError(400, `${field} is required.`);
  if (clean.length > max) throw new ApiError(400, `${field} must be ${max} characters or fewer.`);
  return clean;
}

function coverUrl(value: unknown): string {
  const input = text(value, "Cover image URL", 1_000);
  if (!input) return "";
  try {
    const url = new URL(input);
    if (url.protocol !== "https:") throw new Error();
    return url.toString();
  } catch {
    throw new ApiError(400, "Cover image URL must use HTTPS.");
  }
}

function category(value: unknown): AlbumCategory {
  if (typeof value !== "string" || !CATEGORIES.includes(value as AlbumCategory)) {
    throw new ApiError(400, "Choose a valid album category.");
  }
  return value as AlbumCategory;
}

function albumDto(id: string, data: AlbumRecord) {
  let safeCover = "";
  try { safeCover = coverUrl(data.coverImageUrl); } catch { safeCover = ""; }
  return {
    id,
    title: typeof data.title === "string" ? data.title : "Untitled album",
    description: typeof data.description === "string" ? data.description : "",
    category: CATEGORIES.includes(data.category as AlbumCategory) ? data.category as AlbumCategory : "Practice" as const,
    coverImageUrl: safeCover,
    isPublic: data.isPublic === true && data.isDeleted !== 1,
    mediaCount: typeof data.mediaCount === "number" ? Math.max(0, data.mediaCount) : 0,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : "",
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : undefined,
    isArchived: data.isDeleted === 1,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : undefined,
  };
}

function parseInput(input: AlbumInput, partial = false) {
  const result: Partial<{
    title: string;
    description: string;
    category: AlbumCategory;
    coverImageUrl: string;
    isPublic: boolean;
  }> = {};
  if (!partial || input.title !== undefined) result.title = text(input.title, "Title", 120, true);
  if (!partial || input.description !== undefined) result.description = text(input.description, "Description", 1_000);
  if (!partial || input.category !== undefined) result.category = category(input.category);
  if (!partial || input.coverImageUrl !== undefined) result.coverImageUrl = coverUrl(input.coverImageUrl);
  if (!partial || input.isPublic !== undefined) {
    if (input.isPublic !== undefined && typeof input.isPublic !== "boolean") throw new ApiError(400, "Public visibility must be true or false.");
    result.isPublic = input.isPublic === true;
  }
  return result;
}

function slugify(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  if (!slug) throw new ApiError(400, "Album title must contain letters or numbers.");
  return slug;
}

router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const parsed = typeof req.query.limit === "string" ? Number.parseInt(req.query.limit, 10) : Number.NaN;
  const limit = Number.isFinite(parsed) ? Math.max(1, Math.min(parsed, 50)) : 30;
  const includeArchived = req.query.includeArchived === "true";
  let query: FirebaseFirestore.Query = adminDb.collection("albums").orderBy("createdAt", "desc");
  if (typeof req.query.cursor === "string" && req.query.cursor) {
    const cursor = await adminDb.collection("albums").doc(safeId(req.query.cursor, "album cursor")).get();
    if (!cursor.exists) throw new ApiError(400, "Album cursor was not found.");
    query = query.startAfter(cursor);
  }
  const snapshot = await query.limit(limit + 1).get();
  const visible = snapshot.docs.filter((doc) => includeArchived || doc.data().isDeleted !== 1);
  const page = visible.slice(0, limit);
  res.json({
    albums: page.map((doc) => albumDto(doc.id, doc.data())),
    hasMore: snapshot.docs.length > limit,
    nextCursor: snapshot.docs.length > limit ? snapshot.docs[limit - 1]?.id ?? null : null,
  });
}));

router.post("/", ensureAdmin, asyncHandler(async (req, res) => {
  const input = parseInput(req.body as AlbumInput);
  const id = slugify(input.title!);
  const ref = adminDb.collection("albums").doc(id);
  const existing = await ref.get();
  if (existing.exists) throw new ApiError(409, "An album with this title already exists, including the archive.");
  const now = new Date().toISOString();
  const record = { ...input, mediaCount: 0, isDeleted: 0, createdAt: now, updatedAt: now };
  await ref.set(record);
  res.status(201).json({ success: true, album: albumDto(id, record) });
}));

router.patch("/:albumId", ensureAdmin, asyncHandler(async (req, res) => {
  const albumId = safeId(req.params.albumId, "album ID");
  const ref = adminDb.collection("albums").doc(albumId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Album not found.");
  if (snapshot.data()?.isDeleted === 1) throw new ApiError(409, "Restore the album before editing it.");
  const update = { ...parseInput(req.body as AlbumInput, true), updatedAt: new Date().toISOString() };
  await ref.set(update, { merge: true });
  res.json({ success: true, album: albumDto(albumId, { ...snapshot.data(), ...update }) });
}));

router.delete("/:albumId", ensureAdmin, asyncHandler(async (req, res) => {
  const albumId = safeId(req.params.albumId, "album ID");
  const ref = adminDb.collection("albums").doc(albumId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Album not found.");
  const archivedAt = new Date().toISOString();
  await ref.set({ isDeleted: 1, isPublic: false, archivedAt, updatedAt: archivedAt }, { merge: true });
  res.json({ success: true, archived: true });
}));

router.post("/:albumId/restore", ensureAdmin, asyncHandler(async (req, res) => {
  const albumId = safeId(req.params.albumId, "album ID");
  const ref = adminDb.collection("albums").doc(albumId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Album not found.");
  const restoredAt = new Date().toISOString();
  const update = { isDeleted: 0, isPublic: false, archivedAt: null, restoredAt, updatedAt: restoredAt };
  await ref.set(update, { merge: true });
  res.json({ success: true, restored: true, album: albumDto(albumId, { ...snapshot.data(), ...update }) });
}));

router.post("/:albumId/add-photos", ensureAdmin, asyncHandler(async (req, res) => {
  const albumId = safeId(req.params.albumId, "album ID");
  const rawPhotoIds = (req.body as { photoIds?: unknown }).photoIds;
  if (!Array.isArray(rawPhotoIds) || rawPhotoIds.length === 0 || rawPhotoIds.length > 100) {
    throw new ApiError(400, "Choose between 1 and 100 photos.");
  }
  const photoIds = [...new Set(rawPhotoIds.map((id) => safeId(id, "photo ID")))];
  const albumRef = adminDb.collection("albums").doc(albumId);
  const album = await albumRef.get();
  if (!album.exists || album.data()?.isDeleted === 1) throw new ApiError(404, "Active album not found.");

  const refs = photoIds.map((id) => adminDb.collection("imported_photos").doc(id));
  const snapshots = await adminDb.getAll(...refs);
  const batch = adminDb.batch();
  let addedCount = 0;
  const oldAlbumCounts = new Map<string, number>();
  for (const photo of snapshots) {
    if (!photo.exists || photo.data()?.isDeleted === 1) continue;
    const data = photo.data()!;
    const oldAlbumId = typeof data.albumId === "string" ? data.albumId : null;
    if (oldAlbumId === albumId) continue;
    batch.update(photo.ref, { albumId, updatedAt: new Date().toISOString() });
    batch.set(albumRef.collection("photos").doc(photo.id), { ...data, albumId }, { merge: true });
    if (oldAlbumId) {
      oldAlbumCounts.set(oldAlbumId, (oldAlbumCounts.get(oldAlbumId) || 0) + 1);
      batch.delete(adminDb.collection("albums").doc(oldAlbumId).collection("photos").doc(photo.id));
    }
    addedCount += 1;
  }
  const now = new Date().toISOString();
  if (addedCount) batch.update(albumRef, { mediaCount: admin.firestore.FieldValue.increment(addedCount), updatedAt: now });
  for (const [oldAlbumId, count] of oldAlbumCounts) {
    batch.update(adminDb.collection("albums").doc(oldAlbumId), { mediaCount: admin.firestore.FieldValue.increment(-count), updatedAt: now });
  }
  await batch.commit();
  res.json({ success: true, addedCount });
}));

export default router;
