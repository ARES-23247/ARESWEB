 

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

import locationsRouter from "./locations";

describe("Hono Backend - /locations Router", () => {
  
  
  
   
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
    testApp.route("/", locationsRouter);
  });

  it("GET / - list locations", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123 Main St", is_deleted: 0 }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect((body as any).locations.length).toBe(1);
  });

  it("GET / - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list all locations", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123", is_deleted: 1 }]);
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - save location", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles update with existing id", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "123", name: "Shop", address: "123 Main St", maps_url: "http", is_deleted: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - soft delete location", async () => {
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
