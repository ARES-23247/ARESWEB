import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  options: [] as Array<Record<string, unknown>>,
  photoOptions: null as Array<Record<string, unknown>> | null,
  requireEnabled: vi.fn(),
}));

vi.mock("../distributedQuota", () => ({
  distributedQuotas: vi.fn((options: Array<Record<string, unknown>>) => {
    mocks.options = options;
    if (mocks.photoOptions === null) mocks.photoOptions = options;
    return function enforceDistributedQuota() {};
  }),
}));

vi.mock("../../lib/aiControls", () => ({
  requireAiGenerationEnabled: mocks.requireEnabled,
}));

import {
  AI_PROJECT_DAILY_REQUEST_LIMIT,
  AI_PROJECT_DAILY_TOKEN_LIMIT,
  AI_USER_DAILY_REQUEST_LIMIT,
  AI_USER_DAILY_TOKEN_LIMIT,
  aiGenerationBudget,
  ensureAiGenerationEnabled,
  estimatedTextTokens,
  photoAiGenerationBudget,
} from "../aiBudget";

describe("aiBudget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.options = [];
    mocks.requireEnabled.mockResolvedValue(undefined);
  });

  it("estimates bounded text usage conservatively", () => {
    expect(estimatedTextTokens(4_001, 1_024)).toBe(2_025);
    expect(estimatedTextTokens(Number.NaN, 0)).toBe(1);
    expect(estimatedTextTokens(-100, 512)).toBe(512);
  });

  it("builds atomic short, daily-user, daily-project, and weighted budgets", () => {
    const middleware = aiGenerationBudget((req) => estimatedTextTokens(
      typeof req.body?.prompt === "string" ? req.body.prompt.length : 0,
      1_024,
    ));

    expect(middleware.name).toBe("enforceDistributedQuota");
    expect(mocks.options).toHaveLength(5);
    expect(mocks.options).toEqual(expect.arrayContaining([
      expect.objectContaining({ scope: "ai-user-daily-requests", limit: AI_USER_DAILY_REQUEST_LIMIT }),
      expect.objectContaining({
        scope: "ai-project-daily-requests",
        limit: AI_PROJECT_DAILY_REQUEST_LIMIT,
        identity: "global",
      }),
      expect.objectContaining({ scope: "ai-user-daily-tokens", limit: AI_USER_DAILY_TOKEN_LIMIT }),
      expect.objectContaining({
        scope: "ai-project-daily-tokens",
        limit: AI_PROJECT_DAILY_TOKEN_LIMIT,
        identity: "global",
      }),
    ]));
    const tokenBudget = mocks.options.find((option) => option.scope === "ai-user-daily-tokens")!;
    expect((tokenBudget.cost as (req: { body: { prompt: string } }) => number)({
      body: { prompt: "a".repeat(4_000) },
    })).toBe(2_024);
  });

  it("forwards AI circuit-breaker success and failure", async () => {
    const next = vi.fn();
    await ensureAiGenerationEnabled({} as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();

    const failure = new Error("disabled");
    mocks.requireEnabled.mockRejectedValueOnce(failure);
    await ensureAiGenerationEnabled({} as never, {} as never, next);
    expect(next).toHaveBeenLastCalledWith(failure);
  });

  it("reserves a conservative fixed budget for optional photo analysis", () => {
    expect(photoAiGenerationBudget.name).toBe("enforceDistributedQuota");
    const tokenBudget = mocks.photoOptions?.find((option) => option.scope === "ai-user-daily-tokens");
    expect((tokenBudget?.cost as (req: object) => number)({})).toBe(2_560);
  });
});
