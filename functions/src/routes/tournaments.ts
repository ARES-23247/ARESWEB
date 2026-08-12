import express, { NextFunction, Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureAuth, ensureTeamMember } from "../middleware/auth";
import { validate } from "../middleware/validation";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: "Too many tournament requests, please try again later" },
  standardHeaders: true,
  legacyHeaders: false,
}));

type TournamentRecord = {
  name?: unknown;
  seasonName?: unknown;
  challengeName?: unknown;
  date?: unknown;
  location?: unknown;
  locationId?: unknown;
  description?: unknown;
  status?: unknown;
  opr?: unknown;
  oprList?: unknown;
  scoutingDetails?: unknown;
  photoAlbumId?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

type TournamentMatchRecord = {
  tournamentId?: unknown;
  matchNumber?: unknown;
  alliance?: unknown;
  partner?: unknown;
  opponents?: unknown;
  scoreSelf?: unknown;
  scoreOpponent?: unknown;
  result?: unknown;
  completed?: unknown;
  notes?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

const boundedText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => boundedText(max).optional();

const oprEntrySchema = z.object({
  teamNumber: boundedText(12).min(1),
  teamName: boundedText(120),
  opr: z.number().finite().min(0).max(10000),
}).strict();

const scoutingDetailsSchema = z.object({
  autoPathNotes: optionalText(3000),
  driverFeedback: optionalText(3000),
  robotSpecs: optionalText(3000),
}).strict();

export const createTournamentSchema = z.object({
  name: boundedText(160).min(1, "Name is required"),
  seasonName: optionalText(120),
  challengeName: optionalText(120),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD"),
  location: boundedText(240).min(1, "Location is required"),
  locationId: optionalText(160),
  description: optionalText(5000),
  status: z.enum(["upcoming", "past"]).optional(),
  opr: z.number().finite().min(0).max(10000).optional(),
  oprList: z.array(oprEntrySchema).max(100).optional(),
  scoutingDetails: scoutingDetailsSchema.optional(),
  photoAlbumId: optionalText(160),
}).strict();

export const updateTournamentSchema = createTournamentSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const createTournamentMatchSchema = z.object({
  matchNumber: boundedText(40).min(1, "Match number is required"),
  alliance: z.enum(["red", "blue"]),
  partner: boundedText(20).min(1),
  opponents: z.array(boundedText(20).min(1)).min(1).max(6),
  scoreSelf: z.number().int().min(0).max(10000).optional(),
  scoreOpponent: z.number().int().min(0).max(10000).optional(),
  result: z.enum(["won", "lost", "tie", "upcoming"]),
  completed: z.boolean(),
  notes: optionalText(5000),
}).strict();

export const updateTournamentMatchSchema = createTournamentMatchSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required",
);

export const matchCompletionSchema = z.object({ completed: z.boolean() }).strict();

export async function ensureAdminOrCoach(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  try {
    if (!req.user) {
      return next(new ApiError(401, "Unauthorized: User not authenticated"));
    }

    const userDoc = await adminDb.collection("authorized_users").doc(req.user.uid).get();
    if (!userDoc.exists) {
      return next(new ApiError(403, "Forbidden: User not authorized"));
    }

    const userData = userDoc.data();
    const role = userData?.role;
    if (userData?.isDeleted === true || userData?.isDeleted === 1 ||
        (role !== "admin" && role !== "coach")) {
      return next(new ApiError(403, "Forbidden: Tournament changes require admin or coach access"));
    }

    req.authorizationRole = role;
    next();
  } catch (error: unknown) {
    next(error);
  }
}

function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readOprList(value: unknown) {
  if (!Array.isArray(value)) return [];
  const entries: Array<{ teamNumber: string; teamName: string; opr: number }> = [];
  for (const candidate of value.slice(0, 100)) {
    if (!candidate || typeof candidate !== "object") continue;
    const record = candidate as Record<string, unknown>;
    const teamNumber = readString(record.teamNumber);
    const teamName = readString(record.teamName);
    const opr = readNumber(record.opr);
    if (teamNumber && teamName !== null && opr !== null) {
      entries.push({ teamNumber, teamName, opr });
    }
  }
  return entries;
}

function readScoutingDetails(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  return {
    autoPathNotes: readString(record.autoPathNotes),
    driverFeedback: readString(record.driverFeedback),
    robotSpecs: readString(record.robotSpecs),
  };
}

function tournamentDto(id: string, data: TournamentRecord) {
  const date = readString(data.date) ?? "";
  const derivedStatus = date && date >= new Date().toISOString().slice(0, 10) ? "upcoming" : "past";
  return {
    id,
    name: readString(data.name) ?? "Untitled tournament",
    seasonName: readString(data.seasonName),
    challengeName: readString(data.challengeName),
    date,
    location: readString(data.location) ?? "",
    locationId: readString(data.locationId),
    description: readString(data.description),
    status: data.status === "upcoming" || data.status === "past" ? data.status : derivedStatus,
    opr: readNumber(data.opr),
    oprList: readOprList(data.oprList),
    scoutingDetails: readScoutingDetails(data.scoutingDetails),
    photoAlbumId: readString(data.photoAlbumId),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
  };
}

function matchDto(id: string, data: TournamentMatchRecord) {
  return {
    id,
    tournamentId: readString(data.tournamentId) ?? "",
    matchNumber: readString(data.matchNumber) ?? "",
    alliance: data.alliance === "blue" ? "blue" : "red",
    partner: readString(data.partner) ?? "TBD",
    opponents: Array.isArray(data.opponents)
      ? data.opponents.filter((value): value is string => typeof value === "string").slice(0, 6)
      : [],
    scoreSelf: readNumber(data.scoreSelf),
    scoreOpponent: readNumber(data.scoreOpponent),
    result: data.result === "won" || data.result === "lost" || data.result === "tie" || data.result === "upcoming"
      ? data.result
      : "upcoming",
    completed: data.completed === true,
    notes: readString(data.notes),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
  };
}

async function getActiveTournament(id: string) {
  const ref = adminDb.collection("tournaments").doc(id);
  const snapshot = await ref.get();
  if (!snapshot.exists || snapshot.data()?.isDeleted === 1) {
    throw new ApiError(404, "Tournament not found", "TOURNAMENT_NOT_FOUND");
  }
  return { snapshot, ref };
}

async function getActiveMatch(tournamentId: string, matchId: string) {
  const ref = adminDb.collection("tournament_matches").doc(matchId);
  const snapshot = await ref.get();
  const data = snapshot.data() as TournamentMatchRecord | undefined;
  if (!snapshot.exists || data?.isDeleted === 1 || data?.tournamentId !== tournamentId) {
    throw new ApiError(404, "Match record no longer exists", "MATCH_NOT_FOUND");
  }
  return { snapshot, ref };
}

// Member-only reads keep private scouting details behind a verified team role.
router.get("/", ensureTeamMember, asyncHandler(async (req, res) => {
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "50"), 10);
  const limitValue = Math.min(100, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 50));
  const snapshot = await adminDb.collection("tournaments")
    .where("isDeleted", "==", 0)
    .limit(limitValue)
    .get();
  const tournaments = snapshot.docs
    .map((document) => tournamentDto(document.id, document.data() as TournamentRecord))
    .sort((a, b) => b.date.localeCompare(a.date));

  res.json({ success: true, tournaments });
}));

router.get("/:id/matches", ensureTeamMember, asyncHandler(async (req, res) => {
  await getActiveTournament(req.params.id);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "250"), 10);
  const limitValue = Math.min(250, Math.max(1, Number.isFinite(requestedLimit) ? requestedLimit : 250));
  const snapshot = await adminDb.collection("tournament_matches")
    .where("tournamentId", "==", req.params.id)
    .limit(limitValue)
    .get();
  const matches = snapshot.docs
    .filter((document) => document.data().isDeleted !== 1)
    .map((document) => matchDto(document.id, document.data() as TournamentMatchRecord))
    .sort((a, b) => a.matchNumber.localeCompare(b.matchNumber, undefined, { numeric: true }));

  res.json({ success: true, matches });
}));

router.get("/:id", ensureTeamMember, asyncHandler(async (req, res) => {
  const { snapshot } = await getActiveTournament(req.params.id);
  res.json({
    success: true,
    tournament: tournamentDto(snapshot.id, snapshot.data() as TournamentRecord),
  });
}));

router.post("/", ensureAuth, ensureAdminOrCoach, validate(createTournamentSchema), asyncHandler(async (req, res) => {
  const document = adminDb.collection("tournaments").doc();
  const timestamp = new Date().toISOString();
  const tournamentData = {
    ...(req.body as z.infer<typeof createTournamentSchema>),
    isDeleted: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  await document.set(tournamentData);
  res.status(201).json({
    success: true,
    tournament: tournamentDto(document.id, tournamentData),
  });
}));

router.put("/:id", ensureAuth, ensureAdminOrCoach, validate(updateTournamentSchema), asyncHandler(async (req, res) => {
  const { snapshot, ref } = await getActiveTournament(req.params.id);
  const updateData = {
    ...(req.body as z.infer<typeof updateTournamentSchema>),
    updatedAt: new Date().toISOString(),
  };
  await ref.update(updateData);

  res.json({
    success: true,
    message: "Tournament updated successfully",
    tournament: tournamentDto(snapshot.id, { ...snapshot.data(), ...updateData }),
  });
}));

router.delete("/:id", ensureAuth, ensureAdminOrCoach, asyncHandler(async (req, res) => {
  const { ref } = await getActiveTournament(req.params.id);
  await ref.update({ isDeleted: 1, updatedAt: new Date().toISOString() });
  res.json({ success: true, message: "Tournament archived successfully" });
}));

router.post("/:id/matches", ensureAuth, ensureAdminOrCoach, validate(createTournamentMatchSchema), asyncHandler(async (req, res) => {
  await getActiveTournament(req.params.id);
  const document = adminDb.collection("tournament_matches").doc();
  const timestamp = new Date().toISOString();
  const matchData = {
    ...(req.body as z.infer<typeof createTournamentMatchSchema>),
    tournamentId: req.params.id,
    isDeleted: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await document.set(matchData);
  res.status(201).json({ success: true, match: matchDto(document.id, matchData) });
}));

router.put("/:id/matches/:matchId/completion", ensureAuth, ensureAdminOrCoach, validate(matchCompletionSchema), asyncHandler(async (req, res) => {
  const { snapshot, ref } = await getActiveMatch(req.params.id, req.params.matchId);
  const updateData = {
    completed: (req.body as z.infer<typeof matchCompletionSchema>).completed,
    updatedAt: new Date().toISOString(),
  };
  await ref.update(updateData);
  res.json({ success: true, match: matchDto(snapshot.id, { ...snapshot.data(), ...updateData }) });
}));

router.put("/:id/matches/:matchId", ensureAuth, ensureAdminOrCoach, validate(updateTournamentMatchSchema), asyncHandler(async (req, res) => {
  const { snapshot, ref } = await getActiveMatch(req.params.id, req.params.matchId);
  const updateData = {
    ...(req.body as z.infer<typeof updateTournamentMatchSchema>),
    updatedAt: new Date().toISOString(),
  };
  await ref.update(updateData);
  res.json({ success: true, match: matchDto(snapshot.id, { ...snapshot.data(), ...updateData }) });
}));

router.delete("/:id/matches/:matchId", ensureAuth, ensureAdminOrCoach, asyncHandler(async (req, res) => {
  const { ref } = await getActiveMatch(req.params.id, req.params.matchId);
  await ref.update({ isDeleted: 1, updatedAt: new Date().toISOString() });
  res.json({ success: true, message: "Match archived successfully" });
}));

export default router;
