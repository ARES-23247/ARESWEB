import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { buzzleGameDefinition, type BuzzleAction } from "../lib/buzzleGameDefinition";
import { GameMatchService, requireGamePlayerToken } from "../lib/gameMatches";
import { GAME_MONTHLY_RESOURCE_SCOPE, GAME_MONTHLY_RESOURCE_UNITS } from "../lib/gameResourceBudget";
import { asyncHandler } from "../lib/utils";
import { ensureTeamMember } from "../middleware/auth";
import { distributedQuotas } from "../middleware/distributedQuota";
import { requireRouteParam, validate } from "../middleware/validation";

const router = express.Router();
const service = new GameMatchService(buzzleGameDefinition);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const gameMonthlyBudget = (cost: number) => ({
  scope: GAME_MONTHLY_RESOURCE_SCOPE,
  limit: GAME_MONTHLY_RESOURCE_UNITS,
  calendarWindow: "month" as const,
  identity: "global" as const,
  cost,
  retentionMs: 32 * DAY_MS,
});
const ipQuota = (scope: string, limit: number, windowMs: number) => ({
  scope, limit, windowMs, identity: "ip" as const,
  secretEnvironmentVariable: "ABUSE_HMAC_SECRET" as const,
});
const globalQuota = (scope: string, limit: number, windowMs: number) => ({
  scope, limit, windowMs, identity: "global" as const,
});

const emptyBodySchema = z.object({}).strict();
const joinSchema = z.object({
  code: z.string().trim().toUpperCase().length(8).regex(/^[2-9A-HJ-NP-Z]+$/u),
}).strict();
const placementSchema = z.object({
  index: z.number().int().min(0).max(126),
  tileId: z.string().regex(/^[A-Z?]-\d{1,2}$/u),
  assignedLetter: z.string().trim().toUpperCase().length(1).regex(/^[A-Z]$/u).optional(),
}).strict();
const actionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("play"), placements: z.array(placementSchema).min(1).max(7) }).strict(),
  z.object({ type: z.literal("exchange"), tileIds: z.array(z.string().regex(/^[A-Z?]-\d{1,2}$/u)).min(1).max(7) }).strict(),
  z.object({ type: z.literal("pass") }).strict(),
]);
const moveSchema = z.object({
  expectedVersion: z.number().int().min(1).max(401),
  action: actionSchema,
}).strict();
const syncSchema = z.object({
  knownVersion: z.number().int().min(1).max(401).optional(),
  knownStatus: z.enum(["waiting", "active", "finished"]).optional(),
  knownPlayerCount: z.number().int().min(1).max(2).optional(),
}).strict();

router.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: { error: "Too many online game requests. Please wait and try again." },
  standardHeaders: true,
  legacyHeaders: false,
}));
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

const createQuota = distributedQuotas([
  gameMonthlyBudget(8), ipQuota("buzzle-create-ip", 12, DAY_MS), globalQuota("buzzle-create-project", 300, DAY_MS),
]);
const joinQuota = distributedQuotas([
  gameMonthlyBudget(8), ipQuota("buzzle-join-ip", 60, DAY_MS), globalQuota("buzzle-join-project", 900, DAY_MS),
]);
const guestMatchmakingQuota = distributedQuotas([
  gameMonthlyBudget(8), ipQuota("buzzle-matchmaking-ip", 20, DAY_MS), globalQuota("buzzle-matchmaking-project", 400, DAY_MS),
]);
const teamMatchmakingQuota = distributedQuotas([
  gameMonthlyBudget(8), { scope: "buzzle-team-matchmaking-user", limit: 12, windowMs: DAY_MS },
  ipQuota("buzzle-team-matchmaking-ip", 30, DAY_MS), globalQuota("buzzle-team-matchmaking-project", 200, DAY_MS),
]);
const actionQuota = distributedQuotas([
  gameMonthlyBudget(8), ipQuota("buzzle-action-ip", 300, HOUR_MS), globalQuota("buzzle-action-project", 4_000, HOUR_MS),
]);
const syncQuota = distributedQuotas([
  gameMonthlyBudget(5), ipQuota("buzzle-sync-ip", 2_400, HOUR_MS), globalQuota("buzzle-sync-project", 60_000, HOUR_MS),
]);

router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ healthy: true, service: "game-api", game: "buzzle" });
});

router.post("/games", createQuota, validate(emptyBodySchema), asyncHandler(async (_req, res) => {
  const result = await service.createFriendGame();
  res.status(201).json({ success: true, ...result });
}));

router.post("/join", joinQuota, validate(joinSchema), asyncHandler(async (req, res) => {
  const { code } = req.body as z.infer<typeof joinSchema>;
  res.json({ success: true, ...(await service.joinFriendGame(code)) });
}));

router.post("/matchmaking", guestMatchmakingQuota, validate(emptyBodySchema), asyncHandler(async (_req, res) => {
  const result = await service.matchmake("guest");
  res.status(result.matched ? 200 : 201).json({ success: true, ...result });
}));

router.post("/matchmaking/team", ensureTeamMember, teamMatchmakingQuota, validate(emptyBodySchema), asyncHandler(async (_req, res) => {
  const result = await service.matchmake("team");
  res.status(result.matched ? 200 : 201).json({ success: true, ...result });
}));

router.post("/games/:gameId/sync", syncQuota, validate(syncSchema), asyncHandler(async (req, res) => {
  const game = await service.sync(requireRouteParam(req.params.gameId, "game ID"), requireGamePlayerToken(req));
  const { knownVersion, knownStatus, knownPlayerCount } = req.body as z.infer<typeof syncSchema>;
  if (knownVersion !== undefined && knownStatus !== undefined && knownPlayerCount !== undefined &&
      game.version === knownVersion && game.status === knownStatus && game.playerCount === knownPlayerCount) {
    res.json({ success: true, unchanged: true, syncsRemaining: game.syncsRemaining, expiresAt: game.expiresAt });
    return;
  }
  res.json({ success: true, game });
}));

router.post("/games/:gameId/actions", actionQuota, validate(moveSchema), asyncHandler(async (req, res) => {
  const { expectedVersion, action } = req.body as z.infer<typeof moveSchema>;
  const game = await service.action(
    requireRouteParam(req.params.gameId, "game ID"),
    requireGamePlayerToken(req),
    { expectedVersion },
    action as BuzzleAction,
  );
  res.json({ success: true, game });
}));

export default router;
