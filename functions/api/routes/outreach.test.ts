 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../middleware/dbUtils", () => ({
  retryTransaction: vi.fn(async (db, cb) => cb(db))
}));

import outreachRouter from "./outreach";

describe("Hono Backend - /outreach Router", () => {
  
  
   
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
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", outreachRouter);
  });

  it("GET / - list outreach logs", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", title: "Test", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, description: "..." }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - create", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ title: "New", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - update existing", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "1", title: "Updated", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, location: "Test", description: "Test" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - list outreach logs for admin", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", title: "Test", date: "2024-01-01", students_count: 5, hours_logged: 10, reach_count: 50, description: "..." }]);
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - soft-delete", async () => {
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
