import { describe, it, expect, vi, beforeEach } from "vitest";
import { triggerBackgroundReindex } from "./autoReindex";

describe("triggerBackgroundReindex", () => {
  let mockExecutionCtx: any;
  let mockDb: any;
  let mockAi: any;
  let mockVectorize: any;
  let mockKv: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecutionCtx = { waitUntil: vi.fn() };
    mockDb = {};
    mockAi = { run: vi.fn() };
    mockVectorize = { upsert: vi.fn() };
    mockKv = { get: vi.fn(), put: vi.fn() };
  });

  it("no-ops when AI binding is undefined", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, undefined, mockVectorize, mockKv);

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("no-ops when Vectorize binding is undefined", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi, undefined, mockKv);

    expect(mockExecutionCtx.waitUntil).not.toHaveBeenCalled();
  });

  it("calls waitUntil with a promise when bindings are present", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi, mockVectorize, mockKv);

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledWith(expect.any(Promise));
  });

  it("does not throw when AI and Vectorize are present (fire-and-forget)", () => {
    expect(() => {
      triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi, mockVectorize, mockKv);
    }).not.toThrow();
  });

  it("works without KV (optional parameter)", () => {
    triggerBackgroundReindex(mockExecutionCtx, mockDb, mockAi, mockVectorize);

    expect(mockExecutionCtx.waitUntil).toHaveBeenCalledTimes(1);
  });
});
