import express, { NextFunction, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../lib/utils";

const router = express.Router();
const ROBOT_EDITOR_ROLES = new Set(["admin", "coach", "mentor"]);
const ROBOT_PAGE_LIMIT = 100;
const ROBOT_TEXT_LIMIT = 20_000;

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many robot requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
}));

function isHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.username === "" && url.password === "";
  } catch {
    return false;
  }
}

export function isTrustedOnshapeUrl(value: string): boolean {
  if (!isHttpsUrl(value)) return false;
  const url = new URL(value);
  return url.hostname.toLowerCase() === "cad.onshape.com" && url.port === "";
}

const optionalText = (max: number) => z.string().trim().max(max).optional().default("");
const trustedOnshapeUrl = z.string().trim().refine(
  (value) => value === "" || isTrustedOnshapeUrl(value),
  "Must be an HTTPS URL on cad.onshape.com",
).optional().default("");

export const robotVersionSchema = z.object({
  name: z.string().trim().min(1, "Version name is required").max(120),
  content: optionalText(ROBOT_TEXT_LIMIT),
  weightLbs: z.number().finite().positive().max(100).optional(),
  drivetrainType: optionalText(160),
  primaryMechanism: optionalText(240),
  cadViewerUrl: trustedOnshapeUrl,
});

export const createRobotSchema = z.object({
  id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Robot ID must be a lowercase slug").max(80).optional(),
  name: z.string().trim().min(1, "Name is required").max(120),
  seasonName: z.string().trim().min(1, "Season name is required").max(80),
  challengeName: z.string().trim().min(1, "Challenge name is required").max(120),
  weightLbs: z.number().finite().positive().max(100).optional(),
  drivetrainType: z.string().trim().min(1, "Drivetrain type is required").max(160),
  programmingLanguage: optionalText(120),
  revealVideoId: z.string().trim().regex(/^[A-Za-z0-9_-]{11}$/, "Invalid YouTube video ID").or(z.literal("")).optional().default(""),
  onshapeUrl: trustedOnshapeUrl,
  cadViewerUrl: trustedOnshapeUrl,
  primaryMechanism: optionalText(240),
  content: optionalText(ROBOT_TEXT_LIMIT),
  versions: z.array(robotVersionSchema).max(30).optional().default([]),
});

export const updateRobotSchema = createRobotSchema.omit({ id: true }).partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

interface RobotDocument {
  name?: unknown;
  seasonName?: unknown;
  challengeName?: unknown;
  weightLbs?: unknown;
  drivetrainType?: unknown;
  programmingLanguage?: unknown;
  revealVideoId?: unknown;
  onshapeUrl?: unknown;
  cadViewerUrl?: unknown;
  primaryMechanism?: unknown;
  content?: unknown;
  versions?: unknown;
  isDeleted?: unknown;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function versionDto(value: unknown) {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  return {
    name: stringValue(data.name),
    content: stringValue(data.content),
    weightLbs: optionalNumber(data.weightLbs),
    drivetrainType: stringValue(data.drivetrainType),
    primaryMechanism: stringValue(data.primaryMechanism),
    cadViewerUrl: isHttpsUrl(stringValue(data.cadViewerUrl)) ? stringValue(data.cadViewerUrl) : "",
  };
}

export function robotDto(id: string, value: RobotDocument, includeArchiveState = false) {
  const dto = {
    id,
    name: stringValue(value.name),
    seasonName: stringValue(value.seasonName),
    challengeName: stringValue(value.challengeName),
    weightLbs: optionalNumber(value.weightLbs),
    drivetrainType: stringValue(value.drivetrainType),
    programmingLanguage: stringValue(value.programmingLanguage),
    revealVideoId: /^[A-Za-z0-9_-]{11}$/.test(stringValue(value.revealVideoId)) ? stringValue(value.revealVideoId) : "",
    onshapeUrl: isTrustedOnshapeUrl(stringValue(value.onshapeUrl)) ? stringValue(value.onshapeUrl) : "",
    cadViewerUrl: isHttpsUrl(stringValue(value.cadViewerUrl)) ? stringValue(value.cadViewerUrl) : "",
    primaryMechanism: stringValue(value.primaryMechanism),
    content: stringValue(value.content),
    versions: Array.isArray(value.versions) ? value.versions.slice(0, 30).map(versionDto) : [],
  };

  return includeArchiveState ? { ...dto, isDeleted: value.isDeleted === 1 ? 1 : 0 } : dto;
}

export async function ensureRobotEditor(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  try {
    if (!req.user) throw new ApiError(401, "Unauthorized: User not authenticated");
    const userDoc = await adminDb.collection("authorized_users").doc(req.user.uid).get();
    if (!userDoc.exists) throw new ApiError(403, "Forbidden: User not authorized");
    const role = String(userDoc.data()?.role || "");
    if (!ROBOT_EDITOR_ROLES.has(role)) {
      throw new ApiError(403, "Forbidden: Requires admin, coach, or mentor role");
    }
    req.authorizationRole = role;
    next();
  } catch (error) {
    next(error);
  }
}

function boundedLimit(raw: unknown): number {
  const parsed = typeof raw === "string" ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) ? Math.min(ROBOT_PAGE_LIMIT, Math.max(1, parsed)) : 24;
}

router.get("/", asyncHandler(async (req, res) => {
  const pageSize = boundedLimit(req.query.limit);
  let robotsQuery = adminDb.collection("robots")
    .where("isDeleted", "==", 0)
    .orderBy("createdAt", "desc");

  const startAfterId = typeof req.query.startAfter === "string" ? req.query.startAfter : "";
  if (startAfterId) {
    const cursor = await adminDb.collection("robots").doc(startAfterId).get();
    if (!cursor.exists || cursor.data()?.isDeleted === 1) throw new ApiError(400, "Invalid robot cursor");
    robotsQuery = robotsQuery.startAfter(cursor);
  }

  const snapshot = await robotsQuery.limit(pageSize).get();
  const robots = snapshot.docs.map((doc) => robotDto(doc.id, doc.data()));
  res.json({ success: true, robots, nextCursor: robots.length === pageSize ? robots.at(-1)?.id ?? null : null });
}));

router.get("/admin", ensureAuth, ensureRobotEditor, asyncHandler(async (req, res) => {
  const pageSize = boundedLimit(req.query.limit);
  const snapshot = await adminDb.collection("robots").orderBy("createdAt", "desc").limit(pageSize).get();
  const robots = snapshot.docs.map((doc) => robotDto(doc.id, doc.data(), true));
  res.json({ success: true, robots, nextCursor: null });
}));

router.get("/:id", asyncHandler(async (req, res) => {
  const robotSnapshot = await adminDb.collection("robots").doc(req.params.id).get();
  if (!robotSnapshot.exists || robotSnapshot.data()?.isDeleted === 1) throw new ApiError(404, "Robot not found");
  res.json({ success: true, robot: robotDto(robotSnapshot.id, robotSnapshot.data() || {}) });
}));

router.post("/", ensureAuth, ensureRobotEditor, validate(createRobotSchema), asyncHandler(async (req, res) => {
  const body = req.body as z.infer<typeof createRobotSchema>;
  const collection = adminDb.collection("robots");
  const docRef = body.id ? collection.doc(body.id) : collection.doc();
  if (body.id && (await docRef.get()).exists) throw new ApiError(409, "A robot with this ID already exists");
  const timestamp = new Date().toISOString();
  const validatedFields = { ...body };
  delete validatedFields.id;
  const robotData = { ...validatedFields, isDeleted: 0, createdAt: timestamp, updatedAt: timestamp };
  await docRef.set(robotData);
  res.status(201).json({ success: true, robot: robotDto(docRef.id, robotData, true) });
}));

router.put("/:id", ensureAuth, ensureRobotEditor, validate(updateRobotSchema), asyncHandler(async (req, res) => {
  const docRef = adminDb.collection("robots").doc(req.params.id);
  const robotSnapshot = await docRef.get();
  if (!robotSnapshot.exists || robotSnapshot.data()?.isDeleted === 1) throw new ApiError(404, "Robot not found");
  const updateData = { ...(req.body as z.infer<typeof updateRobotSchema>), updatedAt: new Date().toISOString() };
  await docRef.update(updateData);
  res.json({ success: true, message: "Robot updated successfully", robot: robotDto(docRef.id, { ...robotSnapshot.data(), ...updateData }, true) });
}));

router.delete("/:id", ensureAuth, ensureRobotEditor, asyncHandler(async (req, res) => {
  const docRef = adminDb.collection("robots").doc(req.params.id);
  const robotSnapshot = await docRef.get();
  if (!robotSnapshot.exists || robotSnapshot.data()?.isDeleted === 1) throw new ApiError(404, "Robot not found");
  await docRef.update({ isDeleted: 1, updatedAt: new Date().toISOString() });
  res.json({ success: true, message: "Robot decommissioned successfully" });
}));

router.patch("/:id/restore", ensureAuth, ensureRobotEditor, asyncHandler(async (req, res) => {
  const docRef = adminDb.collection("robots").doc(req.params.id);
  const robotSnapshot = await docRef.get();
  if (!robotSnapshot.exists) throw new ApiError(404, "Robot not found");
  if (robotSnapshot.data()?.isDeleted !== 1) throw new ApiError(409, "Robot is already active");
  await docRef.update({ isDeleted: 0, updatedAt: new Date().toISOString() });
  res.json({ success: true, message: "Robot restored successfully" });
}));

export default router;
