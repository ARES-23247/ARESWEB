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
  getDb: () => {
      const fns = {
        all: vi.fn().mockResolvedValue([]),
        get: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        execute: vi.fn().mockResolvedValue([]),
        executeTakeFirst: vi.fn().mockResolvedValue(null),
        first: vi.fn().mockResolvedValue(null)
      };
      const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'];
      const orig = {};
      for (const m of methods) {
        orig[m] = {
          all: fns.all[m].bind(fns.all),
          get: fns.get[m].bind(fns.get),
          run: fns.run[m].bind(fns.run),
          execute: fns.execute[m].bind(fns.execute),
          executeTakeFirst: fns.executeTakeFirst[m].bind(fns.executeTakeFirst),
          first: fns.first[m].bind(fns.first)
        };
      }
      const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
      for (const key of terminalsList) {
        for (const m of methods) {
          fns[key][m] = (...args) => {
            const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
            for (const k of terminals) {
              if (orig[m][k]) orig[m][k](...args);
            }
            return fns[key];
          };
        }
      }
      const chainable = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop] = vi.fn().mockReturnValue(chainable);
          return target[prop];
        }
      });
      return chainable;
    },
  };
}

// Simple inline mock database
const createMockDb = () => {
      const allFn = vi.fn().mockResolvedValue([]);
      const getFn = vi.fn().mockResolvedValue(null);
      const runFn = vi.fn().mockResolvedValue({ success: true });

      const fns: Record<string, any> = {
        all: allFn,
        get: getFn,
        run: runFn,
        execute: allFn,
        executeTakeFirst: getFn,
        first: getFn
      };

      const chainable: any = new Proxy(fns, {
        get: (target, prop) => {
          if (prop === 'then') return undefined;
          if (prop === 'query') {
             return new Proxy({}, {
                get: () => new Proxy({}, {
                   get: (tTarget, tProp) => {
                      if (tProp === 'findFirst') return fns.get;
                      if (tProp === 'findMany') return fns.all;
                      return vi.fn().mockReturnValue(chainable);
                   }
                })
             });
          }
          if (prop in target) return target[prop];
          if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };

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
