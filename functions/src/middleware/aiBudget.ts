import type { RequestHandler } from "express";
import type { AuthenticatedRequest } from "./auth";
import { distributedQuotas } from "./distributedQuota";
import { requireAiGenerationEnabled } from "../lib/aiControls";

const DAY_MS = 24 * 60 * 60 * 1000;
export const AI_USER_DAILY_REQUEST_LIMIT = 120;
export const AI_PROJECT_DAILY_REQUEST_LIMIT = 1_200;
export const AI_USER_DAILY_TOKEN_LIMIT = 250_000;
export const AI_PROJECT_DAILY_TOKEN_LIMIT = 2_000_000;

export function estimatedTextTokens(characterCount: number, maximumOutputTokens: number): number {
  const safeCharacters = Number.isFinite(characterCount) ? Math.max(0, Math.floor(characterCount)) : 0;
  return Math.max(1, Math.ceil(safeCharacters / 4) + maximumOutputTokens);
}

/** AI-only availability guard; it does not affect any read-only site route. */
export const ensureAiGenerationEnabled: RequestHandler = async (_req, _res, next) => {
  try {
    await requireAiGenerationEnabled();
    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Atomically reserves short-window, daily user, daily project, and weighted
 * token budgets before a provider call.
 */
export function aiGenerationBudget(
  estimateTokens: (req: AuthenticatedRequest) => number,
): RequestHandler {
  return distributedQuotas([
    { scope: "ai-user-window", limit: 30, windowMs: 15 * 60 * 1000 },
    { scope: "ai-user-daily-requests", limit: AI_USER_DAILY_REQUEST_LIMIT, windowMs: DAY_MS },
    {
      scope: "ai-project-daily-requests",
      limit: AI_PROJECT_DAILY_REQUEST_LIMIT,
      windowMs: DAY_MS,
      identity: "global",
    },
    {
      scope: "ai-user-daily-tokens",
      limit: AI_USER_DAILY_TOKEN_LIMIT,
      windowMs: DAY_MS,
      cost: estimateTokens,
    },
    {
      scope: "ai-project-daily-tokens",
      limit: AI_PROJECT_DAILY_TOKEN_LIMIT,
      windowMs: DAY_MS,
      identity: "global",
      cost: estimateTokens,
    },
  ]);
}

/** Conservative reservation for optional photo analysis. */
export const photoAiGenerationBudget = aiGenerationBudget(() => 2_560);

