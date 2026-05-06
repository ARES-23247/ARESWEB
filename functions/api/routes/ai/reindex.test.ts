/* eslint-disable @typescript-eslint/no-explicit-any */
 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context, Next } from "hono";

// Mock middleware
vi.mock("../../middleware", () => ({
  ensureAdmin: async (_c: unknown, next: Next) => next(),
  logAuditAction: vi.fn().mockResolvedValue(true),
  rateLimitMiddleware: () => async (_c: unknown, next: Next) => next(),
  persistentRateLimitMiddleware: () => async (_c: unknown, next: Next) => next(),
}));

// Mock the dynamic import of indexer
const mockIndexSiteContent = vi.fn();
vi.mock("./indexer", () => ({
  indexSiteContent: (...args: unknown[]) => mockIndexSiteContent(...args),
}));

// Import after mocks
import aiRouter from "./index";

interface MockDB {
  selectFrom: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
}

const mockDb: MockDB = {
  selectFrom: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
};

interface MockAI {
  run: ReturnType<typeof vi.fn>;
}

interface MockVectorize {
  upsert: ReturnType<typeof vi.fn>;
}

interface MockKV {
  get: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
}

interface TestBindings {
  AI?: MockAI;
  VECTORIZE_DB?: MockVectorize;
  ARES_KV?: MockKV;
  DB: Record<string, unknown>;
}

interface MockExecutionContext {
  waitUntil: ReturnType<typeof vi.fn>;
}

describe("AI Router - /reindex endpoint", () => {
  let app: Hono<{ Bindings: TestBindings }>;
  const baseEnv: TestBindings = {
    AI: { run: vi.fn() },
    VECTORIZE_DB: { upsert: vi.fn() },
    ARES_KV: { get: vi.fn(), put: vi.fn() },
    DB: {},
  };
  const mockExecutionContext: MockExecutionContext = { waitUntil: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use("*", async (c: Context, next: Next) => {
      c.set("db", mockDb);
      await next();
    });
    app.route("/", aiRouter);
    mockIndexSiteContent.mockResolvedValue({ indexed: 3, skipped: 0, errors: [] });
  });

  it("POST /reindex - incremental mode by default", async () => {
    const res = await app.request("/reindex", { method: "POST" }, baseEnv, mockExecutionContext as any);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; mode: string; indexed: number };
    expect(body.success).toBe(true);
    expect(body.mode).toBe("incremental");
    expect(body.indexed).toBe(3);
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      { force: false }
    );
  });

  it("POST /reindex?force=true - full rebuild mode", async () => {
    const res = await app.request("/reindex?force=true", { method: "POST" }, baseEnv, mockExecutionContext as any);
    expect(res.status).toBe(200);
    const body = await res.json() as { mode: string };
    expect(body.mode).toBe("full");
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      { force: true }
    );
  });

  it("POST /reindex - returns 500 when AI binding missing", async () => {
    const envNoAi: TestBindings = { ...baseEnv, AI: undefined };
    const res = await app.request("/reindex", { method: "POST" }, envNoAi, mockExecutionContext as any);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("not configured");
  });

  it("POST /reindex - returns 500 when Vectorize binding missing", async () => {
    const envNoVec: TestBindings = { ...baseEnv, VECTORIZE_DB: undefined };
    const res = await app.request("/reindex?force=true", { method: "POST" }, envNoVec, mockExecutionContext as any);
    expect(res.status).toBe(500);
  });

  it("POST /reindex - returns errors from indexer", async () => {
    mockIndexSiteContent.mockResolvedValue({ indexed: 1, skipped: 0, errors: ["Batch 0 failed"] });
    const res = await app.request("/reindex", { method: "POST" }, baseEnv, mockExecutionContext as any);
    expect(res.status).toBe(200);
    const body = await res.json() as { errors: string[] };
    expect(body.errors).toEqual(["Batch 0 failed"]);
  });
});

