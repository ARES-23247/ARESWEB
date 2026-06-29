import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { ensureAuth, AuthenticatedRequest } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";
import { NextFunction, Response } from "express";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many robot requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

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
export const robotVersionSchema = z.object({
  versionNumber: z.string().min(1, "Version number is required"),
  notes: z.string().optional(),
  cadViewerUrl: z.string().optional(),
});

export const createRobotSchema = z.object({
  name: z.string().min(1, "Name is required"),
  seasonName: z.string().min(1, "Season name is required"),
  challengeName: z.string().min(1, "Challenge name is required"),
  drivetrainType: z.string().min(1, "Drivetrain type is required"),
  cadViewerUrl: z.string().optional(),
  versions: z.array(robotVersionSchema).optional().default([]),
});

export const updateRobotSchema = createRobotSchema.partial();

// GET /api/robots
router.get("/", asyncHandler(async (req, res) => {
  const limitVal = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 10));
  const startAfterId = req.query.startAfter as string;

  let query = adminDb.collection("robots")
    .where("isDeleted", "==", 0)
    .orderBy("createdAt", "desc");

  if (startAfterId) {
    const startAfterDoc = await adminDb.collection("robots").doc(startAfterId).get();
    if (startAfterDoc.exists) {
      query = query.startAfter(startAfterDoc);
    }
  }

  const snapshot = await query.limit(limitVal).get();
  const robots = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      seasonName: data.seasonName,
      challengeName: data.challengeName,
      drivetrainType: data.drivetrainType,
      cadViewerUrl: data.cadViewerUrl || null,
      versions: data.versions || [],
      isDeleted: data.isDeleted,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  });

  const nextCursor = robots.length === limitVal ? robots[robots.length - 1].id : null;

  res.json({ success: true, robots, nextCursor });
}));

// GET /api/robots/:id
router.get("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docSnap = await adminDb.collection("robots").doc(id).get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Robot not found");
  }

  const data = docSnap.data()!;
  res.json({
    success: true,
    robot: {
      id: docSnap.id,
      name: data.name,
      seasonName: data.seasonName,
      challengeName: data.challengeName,
      drivetrainType: data.drivetrainType,
      cadViewerUrl: data.cadViewerUrl || null,
      versions: data.versions || [],
      isDeleted: data.isDeleted,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }
  });
}));

// POST /api/robots
router.post("/", ensureAuth, ensureAdminOrCoach, validate(createRobotSchema), asyncHandler(async (req, res) => {
  const docRef = adminDb.collection("robots").doc();
  const robotId = docRef.id;
  const timestamp = new Date().toISOString();

  const robotData = {
    id: robotId,
    ...req.body,
    isDeleted: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await docRef.set(robotData);
  res.status(201).json({ success: true, robot: robotData });
}));

// PUT /api/robots/:id
router.put("/:id", ensureAuth, ensureAdminOrCoach, validate(updateRobotSchema), asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = adminDb.collection("robots").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Robot not found");
  }

  const timestamp = new Date().toISOString();
  const updateData = {
    ...req.body,
    updatedAt: timestamp,
  };

  await docRef.update(updateData);
  res.json({
    success: true,
    message: "Robot updated successfully",
    robot: {
      ...docSnap.data(),
      ...updateData,
    }
  });
}));

// DELETE /api/robots/:id
router.delete("/:id", ensureAuth, ensureAdminOrCoach, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const docRef = adminDb.collection("robots").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists || docSnap.data()?.isDeleted === 1) {
    throw new ApiError(404, "Robot not found");
  }

  const timestamp = new Date().toISOString();
  await docRef.update({
    isDeleted: 1,
    updatedAt: timestamp,
  });

  res.json({ success: true, message: "Robot deleted successfully" });
}));

export default router;
