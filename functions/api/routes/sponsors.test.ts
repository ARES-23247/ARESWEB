 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

import sponsorsRouter from "./sponsors";

describe("Hono Backend - /sponsors Router", () => {
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn((key) => {
        if (typeof key === "function") {
          key({
            column: vi.fn().mockReturnThis(),
            doUpdateSet: vi.fn().mockReturnThis()
          });
        }
        return mockDb;
      }),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.onError((err, c) => {
      console.error("HONO ERROR:", err);
      return c.text("Internal Server Error", 500);
    });
    testApp.route("/", sponsorsRouter);
  });

  it("GET / - list sponsors", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", name: "Google", tier: "Gold", logo_url: "..." }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save sponsor", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Google", tier: "Gold", logo_url: "https://example.com/logo.png", website_url: "https://example.com", description: "..." }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save sponsor with optional props", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "my-sponsor", name: "Google", tier: "Gold", logo_url: "https://example.com/logo.png", website_url: "https://example.com", is_active: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/tokens/generate - generate token", async () => {
    const res = await testApp.request("/admin/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: "123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - list sponsors error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /roi/:token - invalid token", async () => {
    mockDb.execute.mockResolvedValueOnce([]); // No token found
    const res = await testApp.request("/roi/bad-token", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /roi/:token - sponsor not found", async () => {
    mockDb.execute.mockResolvedValueOnce([{ sponsor_id: "1" }]); // Token found
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // Sponsor not found
    const res = await testApp.request("/roi/good-token", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /roi/:token - normal path", async () => {
    mockDb.execute.mockResolvedValueOnce([{ sponsor_id: "1" }]); // Token found
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", name: "Google" }); // Sponsor found
    mockDb.execute.mockResolvedValueOnce([{ id: "m1", metric_value: "100" }]); // Metrics
    const res = await testApp.request("/roi/good-token", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /roi/:token - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/roi/good-token", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - normal path", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", is_active: 1 }]);
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - save sponsor error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Google", tier: "Gold" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - normal path", async () => {
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    const text = await res.text();
    console.error("DEBUG TEXT: ", text);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/tokens - normal path", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1" }]);
    const res = await testApp.request("/admin/tokens", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/tokens - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/tokens", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/tokens/generate - generate token error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: "123" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
