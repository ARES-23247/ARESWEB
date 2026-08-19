import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const seasonsRouter = express.Router();
const awardsRouter = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
});
for (const router of [seasonsRouter, awardsRouter]) {
  router.use(limiter);
}
const SAFE_DOC_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/;

function text(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function optionalHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const url = value.trim();
  if (url.length > 2048 || !url.startsWith("https://")) {
    throw new ApiError(400, "External links must be https:// URLs.");
  }
  return url;
}

function statusValue(value: unknown): "published" | "draft" {
  return value === "draft" ? "draft" : "published";
}

function year(value: unknown, label: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 2000 || parsed > 2100) {
    throw new ApiError(400, `${label} must be a year between 2000 and 2100.`);
  }
  return parsed;
}

function isoDate(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    throw new ApiError(400, `${label} must be a YYYY-MM-DD date.`);
  }
  return value.trim();
}

function seasonDto(id: string, data: Record<string, unknown>) {
  return {
    id,
    startYear: typeof data.startYear === "number" ? data.startYear : 0,
    endYear: typeof data.endYear === "number" ? data.endYear : null,
    challengeName: text(data.challengeName, 160),
    robotName: text(data.robotName, 120) || null,
    robotImage: typeof data.robotImage === "string" ? data.robotImage : null,
    robotDescription: text(data.robotDescription, 2_000) || null,
    robotCadUrl: typeof data.robotCadUrl === "string" ? data.robotCadUrl : null,
    summary: text(data.summary, 2_000) || null,
    albumUrl: typeof data.albumUrl === "string" ? data.albumUrl : null,
    albumCover: typeof data.albumCover === "string" ? data.albumCover : null,
    status: statusValue(data.status),
  };
}

function awardDto(id: string, data: Record<string, unknown>) {
  return {
    id,
    title: text(data.title, 160),
    eventName: text(data.eventName, 160),
    date: typeof data.date === "string" ? data.date : "",
    description: text(data.description, 1_000) || null,
    iconType: text(data.iconType, 40) || "trophy",
    seasonId: typeof data.seasonId === "string" ? data.seasonId : null,
    status: statusValue(data.status),
  };
}

interface LifecycleDto {
  isDeleted: number;
  updatedAt: string | null;
  archivedAt: string | null;
}

function lifecycle(data: Record<string, unknown>): LifecycleDto {
  return {
    isDeleted: data.isDeleted === 1 ? 1 : 0,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
  };
}

interface SeasonWriteInput {
  id?: unknown;
  startYear?: unknown;
  endYear?: unknown;
  challengeName?: unknown;
  robotName?: unknown;
  robotImage?: unknown;
  robotDescription?: unknown;
  robotCadUrl?: unknown;
  summary?: unknown;
  albumUrl?: unknown;
  albumCover?: unknown;
  status?: unknown;
}

interface AwardWriteInput {
  id?: unknown;
  title?: unknown;
  eventName?: unknown;
  date?: unknown;
  description?: unknown;
  iconType?: unknown;
  seasonId?: unknown;
  status?: unknown;
}

async function listDtos(
  collection: "seasons" | "awards",
  includeArchived: boolean,
  toDto: (id: string, data: Record<string, unknown>) => Record<string, unknown>,
) {
  let query = adminDb.collection(collection).orderBy("__name__").limit(200);
  if (!includeArchived) {
    query = query.where("isDeleted", "==", 0);
  }
  const snapshot = await query.get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() || {} }))
    .filter(({ data }) => includeArchived || data.isDeleted !== 1)
    .map(({ id, data }) => ({
      ...toDto(id, data),
      ...(includeArchived ? lifecycle(data) : {}),
    }));
}

// GET /api/seasons - published seasons (public)
seasonsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json({ seasons: await listDtos("seasons", false, seasonDto) });
}));

// GET /api/awards - published awards (public)
awardsRouter.get("/", asyncHandler(async (_req, res) => {
  res.json({ awards: await listDtos("awards", false, awardDto) });
}));

// GET /api/seasons/admin - all seasons incl. archived (admin)
seasonsRouter.get("/admin", ensureAdmin, asyncHandler(async (_req, res) => {
  res.json({ seasons: await listDtos("seasons", true, seasonDto) });
}));

// GET /api/awards/admin - all awards incl. archived (admin)
awardsRouter.get("/admin", ensureAdmin, asyncHandler(async (_req, res) => {
  res.json({ awards: await listDtos("awards", true, awardDto) });
}));

// POST /api/seasons/admin - create or update a season (admin)
seasonsRouter.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const input = req.body as SeasonWriteInput;
  const startYear = year(input.startYear, "Start year");
  const endYearRaw = input.endYear === null || input.endYear === undefined || input.endYear === ""
    ? null
    : year(input.endYear, "End year");
  if (endYearRaw !== null && endYearRaw < startYear) {
    throw new ApiError(400, "End year cannot precede the start year.");
  }
  const challengeName = text(input.challengeName, 160);
  if (!challengeName) throw new ApiError(400, "A challenge name is required.");

  const seasonId =
    typeof input.id === "string" && input.id.trim() ? input.id.trim() : `season_${startYear}`;
  if (!SAFE_DOC_ID.test(seasonId)) {
    throw new ApiError(400, "Season id may only contain letters, numbers, dashes, and underscores.");
  }

  const record = {
    id: seasonId,
    startYear,
    endYear: endYearRaw,
    challengeName,
    robotName: text(input.robotName, 120) || null,
    robotImage: optionalHttpsUrl(input.robotImage),
    robotDescription: text(input.robotDescription, 2_000) || null,
    robotCadUrl: optionalHttpsUrl(input.robotCadUrl),
    summary: text(input.summary, 2_000) || null,
    albumUrl: optionalHttpsUrl(input.albumUrl),
    albumCover: optionalHttpsUrl(input.albumCover),
    status: statusValue(input.status),
    isDeleted: 0,
  };
  const now = new Date().toISOString();
  const ref = adminDb.collection("seasons").doc(seasonId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...record, updatedAt: now });
  } else {
    await ref.set({ ...record, createdAt: now, updatedAt: now });
  }
  res.json({ success: true, id: seasonId, season: seasonDto(seasonId, record) });
}));

// POST /api/awards/admin - create or update an award (admin)
awardsRouter.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const input = req.body as AwardWriteInput;
  const title = text(input.title, 160);
  if (!title) throw new ApiError(400, "An award title is required.");
  const eventName = text(input.eventName, 160);
  if (!eventName) throw new ApiError(400, "The event name is required.");
  const date = isoDate(input.date, "Award date");
  const seasonId =
    typeof input.seasonId === "string" && input.seasonId.trim() ? input.seasonId.trim() : null;
  if (seasonId && !SAFE_DOC_ID.test(seasonId)) {
    throw new ApiError(400, "Linked season id is not a valid identifier.");
  }

  const awardId =
    typeof input.id === "string" && input.id.trim() ? input.id.trim() : `award_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  if (!SAFE_DOC_ID.test(awardId)) {
    throw new ApiError(400, "Award id may only contain letters, numbers, dashes, and underscores.");
  }

  const record = {
    id: awardId,
    title,
    eventName,
    date,
    description: text(input.description, 1_000) || null,
    iconType: text(input.iconType, 40) || "trophy",
    seasonId,
    status: statusValue(input.status),
    isDeleted: 0,
  };
  const now = new Date().toISOString();
  const ref = adminDb.collection("awards").doc(awardId);
  const existing = await ref.get();
  if (existing.exists) {
    await ref.update({ ...record, updatedAt: now });
  } else {
    await ref.set({ ...record, createdAt: now, updatedAt: now });
  }
  res.json({ success: true, id: awardId, award: awardDto(awardId, record) });
}));

async function archiveOrRestore(
  family: "seasons" | "awards",
  id: unknown,
  archive: boolean,
) {
  if (typeof id !== "string" || !SAFE_DOC_ID.test(id)) {
    throw new ApiError(400, "Provide a valid record id.");
  }
  const ref = adminDb.collection(family).doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new ApiError(404, "Record not found.");
  const now = new Date().toISOString();
  await ref.update(
    archive
      ? { isDeleted: 1, archivedAt: now, updatedAt: now }
      : { isDeleted: 0, archivedAt: null, updatedAt: now },
  );
}

// DELETE /api/seasons/admin/:id - archive a season
seasonsRouter.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  await archiveOrRestore("seasons", req.params.id, true);
  res.json({ success: true });
}));

// PATCH /api/seasons/admin/:id/restore - restore a season
seasonsRouter.patch("/admin/:id/restore", ensureAdmin, asyncHandler(async (req, res) => {
  await archiveOrRestore("seasons", req.params.id, false);
  res.json({ success: true });
}));

// DELETE /api/awards/admin/:id - archive an award
awardsRouter.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  await archiveOrRestore("awards", req.params.id, true);
  res.json({ success: true });
}));

// PATCH /api/awards/admin/:id/restore - restore an award
awardsRouter.patch("/admin/:id/restore", ensureAdmin, asyncHandler(async (req, res) => {
  await archiveOrRestore("awards", req.params.id, false);
  res.json({ success: true });
}));

export default seasonsRouter;
export { awardsRouter };
