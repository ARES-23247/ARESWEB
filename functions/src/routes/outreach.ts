import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

// GET /api/outreach - Fetch active outreach logs (public)
router.get("/", asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("outreach_logs").get();
  
  const logs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      date: data.date,
      location: data.location || null,
      hours: Number(data.hours || 0),
      peopleReached: Number(data.peopleReached || 0),
      impactSummary: data.impactSummary || null,
      createdAt: data.createdAt || null,
    };
  });

  // Sort by date descending
  logs.sort((a, b) => b.date.localeCompare(a.date));

  res.json({ success: true, logs });
}));

// GET /api/outreach/admin - Fetch all outreach logs (admin only)
router.get("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("outreach_logs").get();
  
  const logs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      title: data.title,
      date: data.date,
      location: data.location || null,
      hours: Number(data.hours || 0),
      peopleReached: Number(data.peopleReached || 0),
      impactSummary: data.impactSummary || null,
      createdAt: data.createdAt || null,
    };
  });

  // Sort by date descending
  logs.sort((a, b) => b.date.localeCompare(a.date));

  res.json({ success: true, logs });
}));

// POST /api/outreach/admin - Create or update outreach log (admin only)
router.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const { id, title, date, location, hours, peopleReached, impactSummary } = req.body as {
    id?: string;
    title: string;
    date: string;
    location?: string | null;
    hours: number;
    peopleReached: number;
    impactSummary?: string | null;
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
