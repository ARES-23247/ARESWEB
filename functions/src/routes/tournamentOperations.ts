import { NextFunction, Response, Router } from "express";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { fetchFtcScoutEventData } from "../lib/ftcScoutSync";
import { asyncHandler } from "../lib/utils";
import {
  AuthenticatedRequest,
  ensureAuth,
  ensureTeamMember,
} from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { requireRouteParam, validate } from "../middleware/validation";

export type PicklistTier = "first_pick" | "second_pick" | "do_not_pick" | "unranked";

export interface PicklistEntryDto {
  teamNumber: string;
  tier: PicklistTier;
  notes: string | null;
}

export const picklistEntrySchema = z
  .object({
    teamNumber: z.string().trim().min(1).max(12),
    tier: z.enum(["first_pick", "second_pick", "do_not_pick", "unranked"]),
    notes: z.string().trim().max(400).optional(),
  })
  .strict();

const savePicklistSchema = z
  .object({
    picklist: z.array(picklistEntrySchema).max(100),
  })
  .strict();

const pitScoutingSchema = z
  .object({
    teamNumber: z
      .string()
      .trim()
      .min(1)
      .max(12)
      .regex(/^\d{1,7}$/u, "Team number must be numeric"),
    teamName: z.string().trim().max(120).optional(),
    drivetrain: z.string().trim().min(1).max(120),
    canClearBarrierOrTrench: z.boolean(),
    preferredStartZone: z.string().trim().max(120).optional(),
    autoSummary: z.string().trim().max(1000).optional(),
    teleopStrengths: z.string().trim().max(1000).optional(),
    endgameCapability: z.string().trim().max(400).optional(),
    notes: z.string().trim().max(2000).optional(),
  })
  .strict();

const standScoutingSchema = z
  .object({
    clientSubmissionId: z
      .string()
      .trim()
      .min(4)
      .max(80)
      .regex(/^[A-Za-z0-9_-]+$/u)
      .optional(),
    matchNumber: z.string().trim().min(1).max(40),
    teamNumber: z
      .string()
      .trim()
      .min(1)
      .max(12)
      .regex(/^\d{1,7}$/u, "Team number must be numeric"),
    alliance: z.enum(["red", "blue"]),
    autoScoreEstimate: z.number().int().min(0).max(500),
    teleopCycles: z.number().int().min(0).max(200),
    endgameTier: z.enum(["none", "park", "low", "high"]),
    disconnected: z.boolean(),
    penalties: z.enum(["none", "minor", "major"]),
    defenseRating: z.number().int().min(0).max(5),
    notes: z.string().trim().max(1500).optional(),
  })
  .strict();

const pitBatterySchema = z
  .object({
    id: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9_-]+$/u),
    label: z.string().trim().min(1).max(60),
    voltage: z.number().finite().min(0).max(20),
    status: z.enum(["charged", "charging", "cooldown", "in_robot"]),
    cycles: z.number().int().min(0).max(500),
  })
  .strict();

const pitTriageSchema = z
  .object({
    id: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/u),
    severity: z.enum(["blocker", "warn"]),
    subsystem: z.string().trim().min(1).max(80),
    summary: z.string().trim().min(1).max(500),
    resolved: z.boolean(),
  })
  .strict();

const pitStateSchema = z
  .object({
    checklists: z.record(
      z.string().trim().min(1).max(40),
      z.array(z.string().trim().min(1).max(60)).max(25),
    ),
    batteries: z.array(pitBatterySchema).max(24),
    triageItems: z.array(pitTriageSchema).max(60),
  })
  .strict();

const syncFtcScoutSchema = z
  .object({
    season: z.number().int().min(2019).max(2100),
    eventCode: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9]+$/u),
  })
  .strict();

function readStr(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readNum(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function readPicklist(value: unknown): PicklistEntryDto[] {
  if (!Array.isArray(value)) return [];
  const list: PicklistEntryDto[] = [];
  for (const raw of value.slice(0, 100)) {
    if (!raw || typeof raw !== "object") continue;
    const rec = raw as Record<string, unknown>;
    const teamNumber = readStr(rec.teamNumber)?.trim();
    const tier = rec.tier;
    if (
      teamNumber &&
      (tier === "first_pick" ||
        tier === "second_pick" ||
        tier === "do_not_pick" ||
        tier === "unranked")
    ) {
      list.push({
        teamNumber,
        tier,
        notes: readStr(rec.notes)?.trim() || null,
      });
    }
  }
  return list;
}

async function resolveCallerNickname(uid: string | undefined): Promise<string> {
  if (!uid) return "ARES Member";
  const profileSnap = await adminDb.collection("user_profiles").doc(uid).get();
  const rawNickname = readStr(profileSnap.data()?.nickname)?.trim();
  return rawNickname && rawNickname.length > 0
    ? rawNickname.slice(0, 60)
    : "ARES Member";
}

function pitScoutingDto(id: string, data: Record<string, unknown>) {
  return {
    id,
    tournamentId: readStr(data.tournamentId) ?? "",
    teamNumber: readStr(data.teamNumber) ?? "",
    teamName: readStr(data.teamName),
    drivetrain: readStr(data.drivetrain) ?? "",
    canClearBarrierOrTrench: data.canClearBarrierOrTrench === true,
    preferredStartZone: readStr(data.preferredStartZone),
    autoSummary: readStr(data.autoSummary),
    teleopStrengths: readStr(data.teleopStrengths),
    endgameCapability: readStr(data.endgameCapability),
    notes: readStr(data.notes),
    scoutNickname: readStr(data.scoutNickname) ?? "ARES Member",
    updatedAt: readStr(data.updatedAt),
  };
}

function standScoutingDto(id: string, data: Record<string, unknown>) {
  const tier = data.endgameTier;
  const penalties = data.penalties;
  return {
    id,
    tournamentId: readStr(data.tournamentId) ?? "",
    matchNumber: readStr(data.matchNumber) ?? "",
    teamNumber: readStr(data.teamNumber) ?? "",
    alliance: data.alliance === "blue" ? "blue" : "red",
    autoScoreEstimate: readNum(data.autoScoreEstimate) ?? 0,
    teleopCycles: readNum(data.teleopCycles) ?? 0,
    endgameTier:
      tier === "park" || tier === "low" || tier === "high" ? tier : "none",
    disconnected: data.disconnected === true,
    penalties:
      penalties === "minor" || penalties === "major" ? penalties : "none",
    defenseRating: readNum(data.defenseRating) ?? 0,
    notes: readStr(data.notes),
    scoutNickname: readStr(data.scoutNickname) ?? "ARES Member",
    createdAt: readStr(data.createdAt),
  };
}

function computeTeamSummaries(
  standEntries: Array<ReturnType<typeof standScoutingDto>>,
) {
  const byTeam = new Map<string, Array<ReturnType<typeof standScoutingDto>>>();
  for (const entry of standEntries) {
    if (!entry.teamNumber) continue;
    const bucket = byTeam.get(entry.teamNumber) ?? [];
    bucket.push(entry);
    byTeam.set(entry.teamNumber, bucket);
  }

  return [...byTeam.entries()]
    .map(([teamNumber, entries]) => {
      const count = entries.length;
      const autoSum = entries.reduce((acc, e) => acc + e.autoScoreEstimate, 0);
      const cyclesSum = entries.reduce((acc, e) => acc + e.teleopCycles, 0);
      const highCount = entries.filter((e) => e.endgameTier === "high").length;
      const disconnectCount = entries.filter((e) => e.disconnected).length;
      return {
        teamNumber,
        matchesScouted: count,
        avgAutoScore: Math.round((autoSum / count) * 10) / 10,
        avgTeleopCycles: Math.round((cyclesSum / count) * 10) / 10,
        highEndgameRate: Math.round((highCount / count) * 100),
        disconnectRate: Math.round((disconnectCount / count) * 100),
      };
    })
    .sort((a, b) =>
      a.teamNumber.localeCompare(b.teamNumber, undefined, { numeric: true }),
    );
}

function pitStateDto(data: Record<string, unknown> | undefined) {
  const rawChecklists = data?.checklists;
  const checklists: Record<string, string[]> = {};
  if (rawChecklists && typeof rawChecklists === "object" && !Array.isArray(rawChecklists)) {
    for (const [key, val] of Object.entries(rawChecklists as Record<string, unknown>).slice(0, 80)) {
      if (Array.isArray(val)) {
        checklists[key.slice(0, 40)] = val
          .filter((id): id is string => typeof id === "string")
          .slice(0, 25);
      }
    }
  }

  const batteries = Array.isArray(data?.batteries)
    ? data.batteries
        .slice(0, 24)
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((b) => ({
          id: readStr(b.id) ?? "B",
          label: readStr(b.label) ?? "Battery",
          voltage: readNum(b.voltage) ?? 12.0,
          status:
            b.status === "charging" ||
            b.status === "cooldown" ||
            b.status === "in_robot"
              ? b.status
              : "charged",
          cycles: readNum(b.cycles) ?? 0,
        }))
    : [];

  const triageItems = Array.isArray(data?.triageItems)
    ? data.triageItems
        .slice(0, 60)
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
        .map((t) => ({
          id: readStr(t.id) ?? "item",
          severity: t.severity === "blocker" ? "blocker" : "warn",
          subsystem: readStr(t.subsystem) ?? "General",
          summary: readStr(t.summary) ?? "",
          resolved: t.resolved === true,
        }))
    : [];

  return {
    checklists,
    batteries,
    triageItems,
    updatedByNickname: readStr(data?.updatedByNickname),
    updatedAt: readStr(data?.updatedAt),
  };
}

export interface TournamentOperationsHelpers {
  getActiveTournament: (idValue: string | string[]) => Promise<{
    snapshot: { id: string; data: () => Record<string, unknown> | undefined };
    ref: { update: (data: Record<string, unknown>) => Promise<unknown> };
  }>;
  tournamentDto: (id: string, data: Record<string, unknown>) => Record<string, unknown>;
  ensureAdminOrCoach: (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => Promise<void>;
}

export function registerTournamentOperationsRoutes(
  router: Router,
  helpers: TournamentOperationsHelpers,
) {
  const { getActiveTournament, tournamentDto, ensureAdminOrCoach } = helpers;

  router.get(
    "/:id/scouting",
    ensureTeamMember,
    asyncHandler(async (req, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      await getActiveTournament(tournamentId);

      const [pitSnap, standSnap] = await Promise.all([
        adminDb
          .collection("tournament_pit_scouting")
          .where("tournamentId", "==", tournamentId)
          .limit(250)
          .get(),
        adminDb
          .collection("tournament_stand_scouting")
          .where("tournamentId", "==", tournamentId)
          .limit(250)
          .get(),
      ]);

      const pitScouting = pitSnap.docs
        .filter((d) => d.data().isDeleted !== 1)
        .map((d) => pitScoutingDto(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) =>
          a.teamNumber.localeCompare(b.teamNumber, undefined, { numeric: true }),
        );

      const standScouting = standSnap.docs
        .filter((d) => d.data().isDeleted !== 1)
        .map((d) => standScoutingDto(d.id, d.data() as Record<string, unknown>))
        .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

      res.json({
        success: true,
        pitScouting,
        standScouting,
        teamSummaries: computeTeamSummaries(standScouting),
      });
    }),
  );

  router.post(
    "/:id/scouting/pit",
    ensureTeamMember,
    validate(pitScoutingSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      await getActiveTournament(tournamentId);
      const input = req.body as z.infer<typeof pitScoutingSchema>;
      const scoutNickname = await resolveCallerNickname(req.user?.uid);
      const timestamp = new Date().toISOString();
      const docId = `${tournamentId}_${input.teamNumber}`;
      const docRef = adminDb.collection("tournament_pit_scouting").doc(docId);
      const record: Record<string, unknown> = {
        tournamentId,
        ...input,
        scoutNickname,
        authorUid: req.user?.uid ?? "",
        isDeleted: 0,
        updatedAt: timestamp,
      };
      await docRef.set(record, { merge: true });
      res.json({
        success: true,
        entry: pitScoutingDto(docId, record),
      });
    }),
  );

  router.post(
    "/:id/scouting/stand",
    ensureTeamMember,
    validate(standScoutingSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      await getActiveTournament(tournamentId);
      const input = req.body as z.infer<typeof standScoutingSchema>;

      if (input.clientSubmissionId) {
        const deterministicId = `${tournamentId}_${input.clientSubmissionId}`;
        const existingRef = adminDb
          .collection("tournament_stand_scouting")
          .doc(deterministicId);
        const existingSnap = await existingRef.get();
        if (existingSnap.exists && existingSnap.data()?.isDeleted !== 1) {
          res.json({
            success: true,
            duplicate: true,
            entry: standScoutingDto(
              existingSnap.id,
              existingSnap.data() as Record<string, unknown>,
            ),
          });
          return;
        }
        const scoutNickname = await resolveCallerNickname(req.user?.uid);
        const createdAt = new Date().toISOString();
        const record: Record<string, unknown> = {
          tournamentId,
          ...input,
          scoutNickname,
          authorUid: req.user?.uid ?? "",
          isDeleted: 0,
          createdAt,
        };
        await existingRef.set(record);
        res.status(201).json({
          success: true,
          duplicate: false,
          entry: standScoutingDto(existingRef.id, record),
        });
        return;
      }

      const scoutNickname = await resolveCallerNickname(req.user?.uid);
      const createdAt = new Date().toISOString();
      const docRef = adminDb.collection("tournament_stand_scouting").doc();
      const record: Record<string, unknown> = {
        tournamentId,
        ...input,
        scoutNickname,
        authorUid: req.user?.uid ?? "",
        isDeleted: 0,
        createdAt,
      };
      await docRef.set(record);
      res.status(201).json({
        success: true,
        duplicate: false,
        entry: standScoutingDto(docRef.id, record),
      });
    }),
  );

  router.put(
    "/:id/picklist",
    ensureTeamMember,
    validate(savePicklistSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const role = req.authorizationRole;
      if (role !== "admin" && role !== "coach" && role !== "mentor") {
        throw new ApiError(
          403,
          "Forbidden: Alliance picklist changes require mentor, coach, or admin access",
          "PICKLIST_FORBIDDEN",
        );
      }
      const { ref } = await getActiveTournament(req.params.id);
      const input = req.body as z.infer<typeof savePicklistSchema>;
      const timestamp = new Date().toISOString();
      await ref.update({
        picklist: input.picklist,
        updatedAt: timestamp,
      });
      res.json({
        success: true,
        picklist: readPicklist(input.picklist),
      });
    }),
  );

  router.get(
    "/:id/pit-state",
    ensureTeamMember,
    asyncHandler(async (req, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      await getActiveTournament(tournamentId);
      const snapshot = await adminDb
        .collection("tournament_pit_states")
        .doc(tournamentId)
        .get();
      res.json({
        success: true,
        pitState: pitStateDto(
          snapshot.exists
            ? (snapshot.data() as Record<string, unknown>)
            : undefined,
        ),
      });
    }),
  );

  router.put(
    "/:id/pit-state",
    ensureTeamMember,
    validate(pitStateSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      await getActiveTournament(tournamentId);
      const input = req.body as z.infer<typeof pitStateSchema>;
      const updatedByNickname = await resolveCallerNickname(req.user?.uid);
      const updatedAt = new Date().toISOString();
      const record: Record<string, unknown> = {
        tournamentId,
        ...input,
        updatedByNickname,
        updatedAt,
      };
      await adminDb
        .collection("tournament_pit_states")
        .doc(tournamentId)
        .set(record, { merge: true });
      res.json({
        success: true,
        pitState: pitStateDto(record),
      });
    }),
  );

  router.post(
    "/:id/sync-ftcscout",
    ensureAuth,
    ensureAdminOrCoach,
    validate(syncFtcScoutSchema),
    asyncHandler(async (req, res) => {
      const tournamentId = requireRouteParam(req.params.id, "tournament ID");
      const { snapshot, ref } = await getActiveTournament(tournamentId);
      const input = req.body as z.infer<typeof syncFtcScoutSchema>;
      const synced = await fetchFtcScoutEventData(input.season, input.eventCode);
      const timestamp = new Date().toISOString();

      const tournamentUpdates: Record<string, unknown> = {
        ftcSeason: synced.ftcSeason,
        ftcEventCode: synced.ftcEventCode,
        lastSyncedAt: timestamp,
        oprList: synced.oprList,
        updatedAt: timestamp,
      };
      if (synced.aresOpr !== null) tournamentUpdates.opr = synced.aresOpr;
      if (synced.aresRank !== null) tournamentUpdates.rank = synced.aresRank;
      if (synced.wins !== null) tournamentUpdates.wins = synced.wins;
      if (synced.losses !== null) tournamentUpdates.losses = synced.losses;
      if (synced.ties !== null) tournamentUpdates.ties = synced.ties;

      await ref.update(tournamentUpdates);

      const existingMatchesSnap = await adminDb
        .collection("tournament_matches")
        .where("tournamentId", "==", tournamentId)
        .limit(250)
        .get();
      const existingByNumber = new Map<string, string>();
      for (const doc of existingMatchesSnap.docs) {
        const d = doc.data();
        if (d.isDeleted === 1) continue;
        const mNum = readStr(d.matchNumber)?.trim().toUpperCase();
        if (mNum) existingByNumber.set(mNum, doc.id);
      }

      for (const match of synced.aresMatches) {
        const existingDocId = existingByNumber.get(
          match.matchNumber.trim().toUpperCase(),
        );
        if (existingDocId) {
          await adminDb
            .collection("tournament_matches")
            .doc(existingDocId)
            .update({
              alliance: match.alliance,
              partner: match.partner,
              opponents: match.opponents,
              scoreSelf: match.scoreSelf,
              scoreOpponent: match.scoreOpponent,
              result: match.result,
              completed: match.completed,
              updatedAt: timestamp,
            });
        } else {
          await adminDb
            .collection("tournament_matches")
            .doc()
            .set({
              tournamentId,
              matchNumber: match.matchNumber,
              alliance: match.alliance,
              partner: match.partner,
              opponents: match.opponents,
              scoreSelf: match.scoreSelf,
              scoreOpponent: match.scoreOpponent,
              result: match.result,
              completed: match.completed,
              isDeleted: 0,
              createdAt: timestamp,
              updatedAt: timestamp,
            });
        }
      }

      res.json({
        success: true,
        syncedMatches: synced.aresMatches.length,
        tournament: tournamentDto(snapshot.id, {
          ...(snapshot.data() ?? {}),
          ...tournamentUpdates,
        }),
      });
    }),
  );
}
