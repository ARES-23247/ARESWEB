import { describe, it, expect, vi, beforeEach } from "vitest";
import { MockExecutionContext, DrizzleMock } from "../../../../src/test/types";
import { triggerBackgroundReindex } from "./autoReindex";
import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";

// Mock Cloudflare Worker bindings for AI tests
type MockAI = { run: ReturnType<typeof vi.fn> };
type MockVectorize = { upsert: ReturnType<typeof vi.fn> };

describe("triggerBackgroundReindex", () => {
  let mockExecutionCtx: MockExecutionContext;
  let mockDb: DrizzleMock;
  let mockAi: MockAI;
  let mockVectorize: MockVectorize;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionCtx = {
      waitUntil: vi.fn() as unknown as MockExecutionContext["waitUntil"],
      passThroughOnException: vi.fn() as unknown as MockExecutionContext["passThroughOnException"],
      props: {}
    };
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
    } as DrizzleMock;
    mockAi = { run: vi.fn() };
    mockVectorize = { upsert: vi.fn() };
  });

  it("no-ops when AI binding is undefined", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, undefined, mockVectorize as unknown as VectorizeIndex);

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("no-ops when Vectorize binding is undefined", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi as unknown as Ai, undefined);

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("calls waitUntil with a promise when bindings are present", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi as unknown as Ai, mockVectorize as unknown as VectorizeIndex);

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("does not throw when AI and Vectorize are present (fire-and-forget)", () => {
    expect(() => {
      triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi as unknown as Ai, mockVectorize as unknown as VectorizeIndex);
    }).not.toThrow();
  });

  it("works without KV (optional parameter)", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi as unknown as Ai, mockVectorize as unknown as VectorizeIndex);

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });
});

