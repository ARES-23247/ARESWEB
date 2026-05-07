import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { TestEnv } from "../../../src/test/types";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: Context<TestEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

import locationsRouter from "./locations";

describe("Hono Backend - /locations Router", () => {
  let mockDb: any;
  let testApp: Hono<TestEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn((cb: any) => {
        if (typeof cb === "function") {
          cb({ column: vi.fn().mockReturnValue({ doUpdateSet: vi.fn() }) });
        }
        return mockDb;
      }),
      onConflictDoUpdate: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q: any) => q),
      }),
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", locationsRouter);
  });

  it("GET / - list locations", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123 Main St", is_deleted: 0 }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { locations: { id: string; name: string }[] };
    expect(body.locations.length).toBe(1);
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list all locations", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123", is_deleted: 1 }]);
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
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
      body: JSON.stringify({ id: "123", name: "Shop", address: "123 Main St", maps_url: "https://maps.google.com", is_deleted: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
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

  it("GET /admin/list - missing optional fields in db", async () => {
    mockDb.all.mockResolvedValueOnce([{ name: "Shop", address: "123" }]); // missing id, is_deleted
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save location with explicit optional fields", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St", maps_url: "http://maps", is_deleted: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles update without optional fields", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "123", name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});

