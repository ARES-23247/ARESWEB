import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAuth, AuthenticatedRequest } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";
import { NextFunction, Response } from "express";

const router = express.Router();

// Custom role verification middleware
export async function ensureAdminOrCoach(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }
    const userDoc = await adminDb.collection("authorized_users").doc(req.user.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }
    const userData = userDoc.data();
    if (userData?.role !== "admin" && userData?.role !== "coach") {
      return next(new ApiError(403, "Forbidden: Insufficient privileges"));
    }
    next();
  } catch (err: any) {
    next(err);
  }
}

// Zod schemas
export const createTournamentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  seasonName: z.string().min(1, "Season name is required"),
  challengeName: z.string().min(1, "Challenge name is required"),
  date: z.string().optional(),
  location: z.string().optional(),
});

export const updateTournamentSchema = createTournamentSchema.partial();

// GET /api/tournaments
router.get("/", asyncHandler(async (req, res) => {
  const limitVal = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const startAfterId = req.query.startAfter as string;

  let query = adminDb.collection("tournaments")
    .where("isDeleted", "==", 0)
    .orderBy("createdAt", "desc");

  if (startAfterId) {
    const startAfterDoc = await adminDb.collection("tournaments").doc(startAfterId).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const snapshot = await query.limit(limitVal).get();
  const tournaments = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      seasonName: data.seasonName,
      challengeName: data.challengeName,
      date: data.date || null,
      location: data.location || null,
      isDeleted: data.isDeleted,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  const nextCursor = tournaments.length === limitVal ? tournaments[tournaments.length - 1].id : null;

  res.json({ success: true, tournaments, nextCursor });
}));

// GET /api/tournaments/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docSnap = await adminDb.collection("tournaments").doc(id).get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Tournament not found");
  }

  const data = docSnap.data()!;
  res.json({
    success: true,
    tournament: {
      id: docSnap.id,
      name: data.name,
      seasonName: data.seasonName,
      challengeName: data.challengeName,
      date: data.date || null,
      location: data.location || null,
      isDeleted: data.isDeleted,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  });
}));

// POST /api/tournaments
router.post("/", ensureAuth, ensureAdminOrCoach, validate(createTournamentSchema), asyncHandler(async (req, res) => {
  const docRef = adminDb.collection("tournaments").doc();
  const tournamentId = docRef.id;
  const timestamp = new Date().toISOString();

  const tournamentData = {
    id: tournamentId,
    ...req.body,
    isDeleted: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docRef.set(tournamentData);
  res.status(201).json({ success: true, tournament: tournamentData });
}));

// PUT /api/tournaments/:id
router.put("/:id", ensureAuth, ensureAdminOrCoach, validate(updateTournamentSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = adminDb.collection("tournaments").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Tournament not found");
  }

  const timestamp = new Date().toISOString();
  const updateData = {
    ...req.body,
    updatedAt: timestamp,
  };

  await docRef.update(updateData);
  res.json({
    success: true,
    message: "Tournament updated successfully",
    tournament: {
      ...docSnap.data(),
      ...updateData,
    }
  });
}));

// DELETE /api/tournaments/:id
router.delete("/:id", ensureAuth, ensureAdminOrCoach, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = adminDb.collection("tournaments").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Tournament not found");
  }

  const timestamp = new Date().toISOString();
  await docRef.update({
    isDeleted: 1,
    updatedAt: timestamp,
  });

  res.json({ success: true, message: "Tournament deleted successfully" });
}));

export default router;
