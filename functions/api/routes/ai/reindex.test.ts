import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { AppEnv } from "../../middleware";

// Mock middleware
vi.mock("../../middleware", () => ({
  ensureAdmin: async (_c: unknown, next: Next) => next(),
  logAuditAction: vi.fn().mockResolvedValue(true),
  rateLimitMiddleware: () => async (_c: unknown, next: Next) => next(),
  persistentRateLimitMiddleware: () => async (_c: unknown, next: Next) => next(),
  getDb: vi.fn().mockReturnValue({}),
}));

// Simple inline mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
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

// Mock the dynamic import of indexer
const mockIndexSiteContent = vi.fn();
vi.mock("./indexer", () => ({
  indexSiteContent: (...args: unknown[]) => mockIndexSiteContent(...args),
}));

// Import after mocks
import { aiRouter } from "./index";

interface MockAI {
  run: ReturnType<typeof vi.fn>;
}

interface MockVectorize {
  upsert: ReturnType<typeof vi.fn>;
}

interface TestBindings {
  AI?: MockAI;
  VECTORIZE_DB?: MockVectorize;
  DB: Record<string, unknown>;
}

describe("AI Router - /reindex endpoint", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let app: Hono<{ Bindings: TestBindings }>;
  const baseEnv: TestBindings = {
    AI: { run: vi.fn() },
    VECTORIZE_DB: { upsert: vi.fn() },
    DB: {},
  };
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    app = new Hono();
    app.use("*", async (c: Context, next: Next) => {
      c.set("db", mockDb as any);
      await next();
    });
    app.route("/", aiRouter);
    mockIndexSiteContent.mockResolvedValue({ indexed: 3, skipped: 0, errors: [] });
  });

  it("POST /reindex - calls indexer with force:false by default", async () => {
    // Handler reads force from JSON body: { force?: boolean }
    const res = await app.request("/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { indexed: number };
    expect(body.indexed).toBe(3);
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      { force: undefined }
    );
  });

  it("POST /reindex - with force:true", async () => {
    const res = await app.request("/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ force: true })
    }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { indexed: number };
    expect(body.indexed).toBe(3);
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      { force: true }
    );
  });

  it("POST /reindex - returns 500 when AI binding missing", async () => {
    const envNoAi: TestBindings = { ...baseEnv, AI: undefined };
    const res = await app.request("/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, envNoAi, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as { error: string };
    expect(body.error).toContain("not configured");
  });

  it("POST /reindex - returns 500 when Vectorize binding missing", async () => {
    const envNoVec: TestBindings = { ...baseEnv, VECTORIZE_DB: undefined };
    const res = await app.request("/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, envNoVec, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /reindex - returns errors from indexer", async () => {
    mockIndexSiteContent.mockResolvedValue({ indexed: 1, skipped: 0, errors: ["Batch 0 failed"] });
    const res = await app.request("/reindex", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { errors: string[] };
    expect(body.errors).toEqual(["Batch 0 failed"]);
  });
});
