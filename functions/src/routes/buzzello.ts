import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { buzzelloGameDefinition } from "../lib/buzzelloGameDefinition";
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

const router = express.Router();
const service = new GameMatchService(buzzelloGameDefinition);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

const emptyBodySchema = z.object({}).strict();
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
    index: z.number().int().min(0).max(60),
    expectedVersion: z.number().int().min(1).max(56),
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
  ipQuota("buzzello-create-ip", 12, DAY_MS),
  globalQuota("buzzello-create-project", 300, DAY_MS),
]);
const joinQuota = distributedQuotas([
  ipQuota("buzzello-join-ip", 60, DAY_MS),
  globalQuota("buzzello-join-project", 900, DAY_MS),
]);
const guestMatchmakingQuota = distributedQuotas([
  ipQuota("buzzello-matchmaking-ip", 20, DAY_MS),
  globalQuota("buzzello-matchmaking-project", 400, DAY_MS),
]);
const teamMatchmakingQuota = distributedQuotas([
  { scope: "buzzello-team-matchmaking-user", limit: 12, windowMs: DAY_MS },
  ipQuota("buzzello-team-matchmaking-ip", 30, DAY_MS),
  globalQuota("buzzello-team-matchmaking-project", 200, DAY_MS),
]);
const moveQuota = distributedQuotas([
  ipQuota("buzzello-move-ip", 360, HOUR_MS),
  globalQuota("buzzello-move-project", 5_000, HOUR_MS),
]);
const syncQuota = distributedQuotas([
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

router.post(
  "/games",
  createQuota,
  validate(emptyBodySchema),
  asyncHandler(async (_req, res) => {
    const result = await service.createFriendGame();
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
  validate(emptyBodySchema),
  asyncHandler(async (_req, res) => {
    const result = await service.matchmake("guest");
    res.status(result.matched ? 200 : 201).json({ success: true, ...result });
  }),
);

router.post(
  "/matchmaking/team",
  ensureTeamMember,
  teamMatchmakingQuota,
  validate(emptyBodySchema),
  asyncHandler(async (_req, res) => {
    const result = await service.matchmake("team");
    res.status(result.matched ? 200 : 201).json({ success: true, ...result });
  }),
);

router.post(
  "/games/:gameId/sync",
  syncQuota,
  validate(emptyBodySchema),
  asyncHandler(async (req, res) => {
    const gameId = requireRouteParam(req.params.gameId, "game ID");
    const game = await service.sync(gameId, requireGamePlayerToken(req));
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
