import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerBackgroundReindex } from "./autoReindex";
import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";

vi.mock("../middleware", () => ({
  ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
  logAuditAction: vi.fn().mockResolvedValue(true),
  rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  persistentRateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getDb: vi.fn().mockReturnValue({}),
}));

// Simple inline mock execution context
function createMockExecutionContext() {
  const promises: Promise<unknown>[] = [];
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => {
      promises.push(promise);
      return promise;
    }),
    passThroughOnException: vi.fn(),
    props: {},
    promises,
  };
}

// Simple inline mock database
function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue([]),
  };
}

describe("triggerBackgroundReindex", () => {
  let mockExecutionCtx: ReturnType<typeof createMockExecutionContext>;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockAi: { run: ReturnType<typeof vi.fn> };
  let mockVectorize: { upsert: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionCtx = createMockExecutionContext();
    mockDb = createMockDb();
    mockAi = { run: vi.fn() };
    mockVectorize = { upsert: vi.fn() };
  });

  it("no-ops when AI binding is undefined", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      undefined,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("no-ops when Vectorize binding is undefined", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      undefined
    );

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("calls waitUntil with a promise when bindings are present", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("does not throw when AI and Vectorize are present (fire-and-forget)", () => {
    expect(() => {
      triggerBackgroundReindex(
        mockExecutionCtx,
        mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
        mockAi as unknown as Ai,
        mockVectorize as unknown as VectorizeIndex
      );
    }).not.toThrow();
  });

  it("works without KV (optional parameter)", () => {
    triggerBackgroundReindex(
      mockExecutionCtx,
      mockDb as unknown as Parameters<typeof triggerBackgroundReindex>[1],
      mockAi as unknown as Ai,
      mockVectorize as unknown as VectorizeIndex
    );

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });
});
