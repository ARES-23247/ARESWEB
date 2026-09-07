import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import {
  buzzelloGameDefinition,
  createBuzzelloGameDefinition,
} from "../lib/buzzelloGameDefinition";
import {
  GameMatchService,
  generateGameInviteCode,
  hashGameInviteCode,
  requireGamePlayerToken,
} from "../lib/gameMatches";
import { asyncHandler } from "../lib/utils";
import { ensureTeamMember } from "../middleware/auth";
import { distributedQuotas } from "../middleware/distributedQuota";
import { requireRouteParam, validate } from "../middleware/validation";
import {
  GAME_MONTHLY_RESOURCE_SCOPE,
  GAME_MONTHLY_RESOURCE_UNITS,
} from "../lib/gameResourceBudget";

const router = express.Router();
const service = new GameMatchService(buzzelloGameDefinition);
const largeService = new GameMatchService(createBuzzelloGameDefinition(91));
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
export { GAME_MONTHLY_RESOURCE_UNITS } from "../lib/gameResourceBudget";

const gameMonthlyBudget = (cost: number) => ({
  scope: GAME_MONTHLY_RESOURCE_SCOPE,
  limit: GAME_MONTHLY_RESOURCE_UNITS,
  calendarWindow: "month" as const,
  identity: "global" as const,
  cost,
  retentionMs: 32 * DAY_MS,
});

const createSchema = z
  .object({ boardSize: z.union([z.literal(61), z.literal(91)]).default(61) })
  .strict();
const joinSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .length(8)
      .regex(/^[2-9A-HJ-NP-Z]+$/u),
  })
  .strict();
const moveSchema = z
  .object({
    index: z.number().int().min(0).max(90),
    expectedVersion: z.number().int().min(1).max(86),
  })
  .strict();
const syncSchema = z
  .object({
    knownVersion: z.number().int().min(1).max(86).optional(),
    knownStatus: z.enum(["waiting", "active", "finished"]).optional(),
    knownPlayerCount: z.number().int().min(1).max(2).optional(),
  })
  .strict();

const routeLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  message: {
    error: "Too many online game requests. Please wait and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

function ipQuota(scope: string, limit: number, windowMs: number) {
  return {
    scope,
    limit,
    windowMs,
    identity: "ip" as const,
    secretEnvironmentVariable: "ABUSE_HMAC_SECRET" as const,
  };
}

function globalQuota(scope: string, limit: number, windowMs: number) {
  return { scope, limit, windowMs, identity: "global" as const };
}

const createQuota = distributedQuotas([
  gameMonthlyBudget(8),
  ipQuota("buzzello-create-ip", 12, DAY_MS),
  globalQuota("buzzello-create-project", 300, DAY_MS),
]);
const joinQuota = distributedQuotas([
  gameMonthlyBudget(8),
  ipQuota("buzzello-join-ip", 60, DAY_MS),
  globalQuota("buzzello-join-project", 900, DAY_MS),
]);
const guestMatchmakingQuota = distributedQuotas([
  gameMonthlyBudget(8),
  ipQuota("buzzello-matchmaking-ip", 20, DAY_MS),
  globalQuota("buzzello-matchmaking-project", 400, DAY_MS),
]);
const teamMatchmakingQuota = distributedQuotas([
  gameMonthlyBudget(8),
  { scope: "buzzello-team-matchmaking-user", limit: 12, windowMs: DAY_MS },
  ipQuota("buzzello-team-matchmaking-ip", 30, DAY_MS),
  globalQuota("buzzello-team-matchmaking-project", 200, DAY_MS),
]);
const moveQuota = distributedQuotas([
  gameMonthlyBudget(6),
  ipQuota("buzzello-move-ip", 360, HOUR_MS),
  globalQuota("buzzello-move-project", 5_000, HOUR_MS),
]);
const syncQuota = distributedQuotas([
  gameMonthlyBudget(5),
  ipQuota("buzzello-sync-ip", 2_400, HOUR_MS),
  globalQuota("buzzello-sync-project", 60_000, HOUR_MS),
]);

router.use(routeLimiter);
router.use((_req, res, next) => {
  res.set("Cache-Control", "private, no-store");
  next();
});

export const generateBuzzelloInviteCode = generateGameInviteCode;
export const hashBuzzelloInviteCode = (code: string) =>
  hashGameInviteCode(buzzelloGameDefinition.gameType, code);

router.get("/health", (_req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ healthy: true, service: "game-api" });
});

router.post(
  "/games",
  createQuota,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const result = await (
      req.body.boardSize === 91 ? largeService : service
    ).createFriendGame();
    res.status(201).json({ success: true, ...result });
  }),
);

router.post(
  "/join",
  joinQuota,
  validate(joinSchema),
  asyncHandler(async (req, res) => {
    const { code } = req.body as z.infer<typeof joinSchema>;
    const result = await service.joinFriendGame(code);
    res.json({ success: true, ...result });
  }),
);

router.post(
  "/matchmaking",
  guestMatchmakingQuota,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const result = await (
      req.body.boardSize === 91 ? largeService : service
    ).matchmake("guest");
    res.status(result.matched ? 200 : 201).json({ success: true, ...result });
  }),
);

router.post(
  "/matchmaking/team",
  ensureTeamMember,
  teamMatchmakingQuota,
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const result = await (
      req.body.boardSize === 91 ? largeService : service
    ).matchmake("team");
    res.status(result.matched ? 200 : 201).json({ success: true, ...result });
  }),
);

router.post(
  "/games/:gameId/sync",
  syncQuota,
  validate(syncSchema),
  asyncHandler(async (req, res) => {
    const gameId = requireRouteParam(req.params.gameId, "game ID");
    const game = await service.sync(gameId, requireGamePlayerToken(req));
    const { knownVersion, knownStatus, knownPlayerCount } = req.body as z.infer<
      typeof syncSchema
    >;
    if (
      knownVersion !== undefined &&
      knownStatus !== undefined &&
      knownPlayerCount !== undefined &&
      game.version === knownVersion &&
      game.status === knownStatus &&
      game.playerCount === knownPlayerCount
    ) {
      res.json({
        success: true,
        unchanged: true,
        syncsRemaining: game.syncsRemaining,
        expiresAt: game.expiresAt,
      });
      return;
    }
    res.json({ success: true, game });
  }),
);

router.post(
  "/games/:gameId/moves",
  moveQuota,
  validate(moveSchema),
  asyncHandler(async (req, res) => {
    const gameId = requireRouteParam(req.params.gameId, "game ID");
    const { index, expectedVersion } = req.body as z.infer<typeof moveSchema>;
    const game = await service.action(
      gameId,
      requireGamePlayerToken(req),
      { expectedVersion },
      { index },
    );
    res.json({ success: true, game });
  }),
);

export default router;
