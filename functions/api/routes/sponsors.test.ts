import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import sponsorsRouter from "./sponsors";
import { AppEnv } from "../middleware";

// Proper mock types
interface MockDbMethods {
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
  [key: string]: ReturnType<typeof vi.fn> | MockMethodMap;
}

interface MockMethodMap {
  all: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  first: ReturnType<typeof vi.fn>;
}

interface ResetDbMockFunction {
  (): void;
}

interface MockDbFunction {
  (): MockDbMethods & { transaction?: ReturnType<typeof vi.fn> };
}

type ChainableDb = MockDbMethods & { transaction?: ReturnType<typeof vi.fn> };

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
    let chainable: ChainableDb;
  const resetDbMock = () => {
    const fns: MockDbMethods = {
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      first: vi.fn().mockResolvedValue(null)
    };
    const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'] as const;
    const orig: Record<string, MockMethodMap> = {};
    for (const m of methods) {
      orig[m] = {
        all: fns.all[m as keyof typeof fns.all].bind(fns.all),
        get: fns.get[m as keyof typeof fns.get].bind(fns.get),
        run: fns.run[m as keyof typeof fns.run].bind(fns.run),
        execute: fns.execute[m as keyof typeof fns.execute].bind(fns.execute),
        executeTakeFirst: fns.executeTakeFirst[m as keyof typeof fns.executeTakeFirst].bind(fns.executeTakeFirst),
        first: fns.first[m as keyof typeof fns.first].bind(fns.first)
      };
    }
    const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
    for (const key of terminalsList) {
      for (const m of methods) {
        (fns[key])[m] = (...args: unknown[]) => {
          const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
          for (const k of terminals) {
            if (orig[m][k]) orig[m][k](...args);
          }
          return fns[key];
        };
      }
    }
    chainable = new Proxy(fns, {
      get: (target, prop: string | symbol) => {
        if (prop === 'then') return undefined;
        if (prop in target) return target[prop as keyof MockDbMethods];
        if (prop === 'transaction') return vi.fn(async (cb: (tx: ChainableDb) => Promise<unknown>) => cb(chainable));
        (target[prop as string] as ReturnType<typeof vi.fn>) = vi.fn().mockReturnValue(chainable);
        return target[prop as string];
      }
    }) as ChainableDb;
  };
  resetDbMock();

  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next?: () => Promise<void>) => {
      if (next) return next();
      return Promise.resolve();
    },
    getSessionUser: vi.fn().mockResolvedValue({
      id: "1",
      email: "admin@test.com",
      name: "Admin User",
      role: "admin",
      member_type: "mentor"
    }),
    getDb: () => chainable,
    resetDbMock
  };
});

describe("Hono Backend - /sponsors Router", () => {
  let app: Hono<AppEnv>;
  let getDbMock: MockDbFunction;

  interface ExecutionContext {
    waitUntil: ReturnType<typeof vi.fn>;
    passThroughOnException: ReturnType<typeof vi.fn>;
  }

  const env = {
    DB: {} as unknown as D1Database,
    DEV_BYPASS: "true",
  } as AppEnv["Bindings"];

  const mockExecutionContext: ExecutionContext = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  };

  beforeEach(async () => {
    const middleware = await import("../middleware");
    (middleware.resetDbMock as ResetDbMockFunction)();
    vi.clearAllMocks();
    getDbMock = middleware.getDb as MockDbFunction;

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", getDbMock());
      await next();
    });
    app.onError((err: unknown, c) => {
      console.error("HONO ERROR:", err);
      return c.text("Internal Server Error", 500);
    });
    app.route("/", sponsorsRouter);
  });

  it("GET / - list sponsors error", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - list sponsors", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockResolvedValueOnce([{ id: "1", name: "Google", tier: "Gold", logo_url: null, website_url: null, is_active: 1 }]);
    const res = await app.request("/", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save sponsor", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Google", tier: "Gold", logo_url: "https://example.com/logo.png", website_url: "https://example.com", description: "..." }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save sponsor with optional props", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "my-sponsor", name: "Google", tier: "Gold", logo_url: "https://example.com/logo.png", website_url: "https://example.com", is_active: 1 }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/tokens/generate - generate token", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: "123" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /roi/:token - invalid token", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockResolvedValueOnce([]); // No token found
    const res = await app.request("/roi/bad-token", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /roi/:token - sponsor not found", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockResolvedValueOnce([{ sponsor_id: "1" }]); // Token found
    mockDb.get = vi.fn().mockResolvedValueOnce(null); // Sponsor not found
    const res = await app.request("/roi/good-token", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /roi/:token - normal path", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn()
      .mockResolvedValueOnce([{ sponsor_id: "1" }]) // Token found
      .mockResolvedValueOnce([{ id: "m1", sponsor_id: "1", clicks: 100, impressions: 1000, year_month: "2023-01" }]); // Metrics
    mockDb.get = vi.fn().mockResolvedValueOnce({ id: "1", name: "Google", tier: "Gold", logo_url: null, website_url: null, is_active: 1 }); // Sponsor found
    const res = await app.request("/roi/good-token", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /roi/:token - error", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/roi/good-token", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - normal path", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockResolvedValueOnce([{ id: "1", name: "Sponsor 1", tier: "Gold", is_active: 1 }]);
    const res = await app.request("/admin/list", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - error", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/list", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - save sponsor error", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Google", tier: "Gold" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - normal path", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockResolvedValueOnce({ success: true });
    const res = await app.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - error", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/tokens - normal path", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockResolvedValueOnce([{ id: "t1", sponsor_id: "s1", token: "good-token", created_at: "2023-01-01", last_used: null }]);
    const res = await app.request("/admin/tokens", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/tokens - error", async () => {
    const mockDb = getDbMock();
    mockDb.all = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/tokens", {}, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/tokens/generate - generate token error", async () => {
    const mockDb = getDbMock();
    mockDb.run = vi.fn().mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: "123" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext as ExecutionContext);
    expect(res.status).toBe(500);
  });
});
