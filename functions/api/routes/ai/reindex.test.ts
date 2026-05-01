import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";

// Mock middleware
vi.mock("../../middleware", () => ({
  ensureAdmin: (c: any, next: any) => next(),
  logAuditAction: vi.fn().mockResolvedValue(true),
  rateLimitMiddleware: () => (c: any, next: any) => next(),
  persistentRateLimitMiddleware: () => (c: any, next: any) => next(),
}));

// Mock the dynamic import of indexer
const mockIndexSiteContent = vi.fn();
vi.mock("./indexer", () => ({
  indexSiteContent: (...args: any[]) => mockIndexSiteContent(...args),
}));

// Import after mocks
import aiRouter from "./index";

const mockDb: any = {
  selectFrom: vi.fn().mockReturnThis(),
  select: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  execute: vi.fn().mockResolvedValue([]),
};

describe("AI Router - /reindex endpoint", () => {
  let app: Hono<any>;
  const baseEnv: any = {
    AI: { run: vi.fn() },
    VECTORIZE_DB: { upsert: vi.fn() },
    ARES_KV: { get: vi.fn(), put: vi.fn() },
    DB: {},
  };
  const mockExecutionContext: any = { waitUntil: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono();
    app.use("*", async (c, next) => {
      c.set("db", mockDb);
      await next();
    });
    app.route("/", aiRouter);
    mockIndexSiteContent.mockResolvedValue({ indexed: 3, skipped: 0, errors: [] });
  });

  it("POST /reindex - incremental mode by default", async () => {
    const res = await app.request("/reindex", { method: "POST" }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.mode).toBe("incremental");
    expect(body.indexed).toBe(3);
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      baseEnv.ARES_KV,
      { force: false }
    );
  });

  it("POST /reindex?force=true - full rebuild mode", async () => {
    const res = await app.request("/reindex?force=true", { method: "POST" }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.mode).toBe("full");
    expect(mockIndexSiteContent).toHaveBeenCalledWith(
      mockDb,
      baseEnv.AI,
      baseEnv.VECTORIZE_DB,
      baseEnv.ARES_KV,
      { force: true }
    );
  });

  it("POST /reindex - returns 500 when AI binding missing", async () => {
    const envNoAi = { ...baseEnv, AI: undefined };
    const res = await app.request("/reindex", { method: "POST" }, envNoAi, mockExecutionContext);
    expect(res.status).toBe(500);
    const body = await res.json() as any;
    expect(body.error).toContain("not configured");
  });

  it("POST /reindex - returns 500 when Vectorize binding missing", async () => {
    const envNoVec = { ...baseEnv, VECTORIZE_DB: undefined };
    const res = await app.request("/reindex", { method: "POST" }, envNoVec, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /reindex - returns errors from indexer", async () => {
    mockIndexSiteContent.mockResolvedValue({ indexed: 1, skipped: 0, errors: ["Batch 0 failed"] });
    const res = await app.request("/reindex", { method: "POST" }, baseEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.errors).toEqual(["Batch 0 failed"]);
  });
});
