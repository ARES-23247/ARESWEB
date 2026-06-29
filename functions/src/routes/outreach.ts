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

async function getOutreachLogsHelper(req: express.Request) {
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
  
  const logs = docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      date: data.date,
      location: data.location || null,
      hours: Number(data.hours || 0),
      peopleReached: Number(data.peopleReached || 0),
      impactSummary: data.impactSummary || null,
      eventId: data.eventId || null,
      createdAt: data.createdAt || null,
    };
  });

  // Sort by date descending
  logs.sort((a, b) => b.date.localeCompare(a.date));

  return {
    success: true,
    logs,
    hasMore,
    nextCursor: hasMore ? logs[logs.length - 1].id : null
  };
}

// GET /api/outreach - Fetch active outreach logs (public)
router.get("/", asyncHandler(async (req, res) => {
  const result = await getOutreachLogsHelper(req);
  res.json(result);
}));

// GET /api/outreach/admin - Fetch all outreach logs (admin only)
router.get("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const result = await getOutreachLogsHelper(req);
  res.json(result);
}));

// POST /api/outreach/admin - Create or update outreach log (admin only)
router.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const { id, title, date, location, hours, peopleReached, impactSummary, eventId } = req.body as {
    id?: string;
    title: string;
    date: string;
    location?: string | null;
    hours: number;
    peopleReached: number;
    impactSummary?: string | null;
    eventId?: string | null;
  };

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
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  res.json({ success: true, id: logId });
}));

// DELETE /api/outreach/admin/:id - Delete outreach log (admin only)
router.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const docRef = adminDb.collection("outreach_logs").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Outreach log not found.");
  }

  await docRef.delete();

  res.json({ success: true, message: "Outreach log deleted successfully." });
}));

export default router;
