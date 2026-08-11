import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

interface OutreachLogDocument {
  title?: unknown;
  date?: unknown;
  location?: unknown;
  hours?: unknown;
  peopleReached?: unknown;
  impactSummary?: unknown;
  eventId?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

interface OutreachWriteRequest {
  id?: string;
  title: string;
  date: string;
  location?: string | null;
  hours: number;
  peopleReached: number;
  impactSummary?: string | null;
  eventId?: string | null;
}

function toOutreachDto(id: string, data: OutreachLogDocument, includeLifecycle: boolean) {
  const dto = {
    id,
    title: typeof data.title === "string" ? data.title : "",
    date: typeof data.date === "string" ? data.date : "",
    location: typeof data.location === "string" ? data.location : null,
    hours: Number(data.hours || 0),
    peopleReached: Number(data.peopleReached || 0),
    impactSummary: typeof data.impactSummary === "string" ? data.impactSummary : null,
    eventId: typeof data.eventId === "string" ? data.eventId : null,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
  };

  if (!includeLifecycle) return dto;

  return {
    ...dto,
    isDeleted: data.isDeleted === 1 ? 1 : 0,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
  };
}

async function getOutreachLogsHelper(req: express.Request, includeArchived: boolean) {
  const limitVal = Math.min(parseInt(req.query?.limit as string) || 50, 100);
  const cursor = req.query?.cursor as string | undefined;

  let query = adminDb.collection("outreach_logs").orderBy("date", "desc").limit(limitVal + 1);

  if (cursor) {
    const cursorDoc = await adminDb.collection("outreach_logs").doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const rawDocs = snapshot.docs;
  const hasMore = rawDocs.length > limitVal;
  const docs = hasMore ? rawDocs.slice(0, limitVal) : rawDocs;

  const logs = docs
    .map((doc) => ({ id: doc.id, data: doc.data() as OutreachLogDocument }))
    .filter(({ data }) => includeArchived || data.isDeleted !== 1)
    .map(({ id, data }) => toOutreachDto(id, data, includeArchived));

  // Sort by date descending
  logs.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    logs,
    hasMore,
    nextCursor: hasMore && docs.length > 0 ? docs[docs.length - 1].id : null
  };
}

// GET /api/outreach - Fetch active outreach logs (public)
router.get("/", asyncHandler(async (req, res) => {
  const result = await getOutreachLogsHelper(req, false);
  res.json(result);
}));

// GET /api/outreach/admin - Fetch all outreach logs (admin only)
router.get("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const result = await getOutreachLogsHelper(req, true);
  res.json(result);
}));

// POST /api/outreach/admin - Create or update outreach log (admin only)
router.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const { id, title, date, location, hours, peopleReached, impactSummary, eventId } = req.body as OutreachWriteRequest;

  if (!title || !title.trim()) {
    throw new ApiError(400, "Outreach title is required.");
  }

  if (!date || !date.trim()) {
    throw new ApiError(400, "Outreach date is required.");
  }

  if (isNaN(hours) || hours < 0) {
    throw new ApiError(400, "Hours must be a non-negative number.");
  }

  if (isNaN(peopleReached) || peopleReached < 0) {
    throw new ApiError(400, "People reached must be a non-negative number.");
  }

  const logId = id && id.trim() ? id.trim() : `out_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const docRef = adminDb.collection("outreach_logs").doc(logId);
  const docSnap = await docRef.get();

  const timestamp = new Date().toISOString();

  if (docSnap.exists) {
    // Update
    await docRef.update({
      title: title.trim(),
      date: date.trim(),
      location: location || null,
      hours: Number(hours),
      peopleReached: Number(peopleReached),
      impactSummary: impactSummary || null,
      eventId: eventId || null,
      updatedAt: timestamp,
    });
  } else {
    // Create
    await docRef.set({
      id: logId,
      title: title.trim(),
      date: date.trim(),
      location: location || null,
      hours: Number(hours),
      peopleReached: Number(peopleReached),
      impactSummary: impactSummary || null,
      eventId: eventId || null,
      isDeleted: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  res.json({ success: true, id: logId });
}));

// DELETE /api/outreach/admin/:id - Archive outreach log (admin only)
router.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const docRef = adminDb.collection("outreach_logs").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Outreach log not found.");
  }

  const timestamp = new Date().toISOString();
  await docRef.update({
    isDeleted: 1,
    archivedAt: timestamp,
    updatedAt: timestamp,
  });

  res.json({ success: true, message: "Outreach log archived successfully." });
}));

// PATCH /api/outreach/admin/:id/restore - Restore an archived outreach log (admin only)
router.patch("/admin/:id/restore", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = adminDb.collection("outreach_logs").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Outreach log not found.");
  }

  await docRef.update({
    isDeleted: 0,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, message: "Outreach log restored successfully." });
}));

export default router;
