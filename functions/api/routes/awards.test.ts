 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

import awardsRouter from "./awards";

describe("Hono Backend - /awards Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
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
    testApp.route("/", awardsRouter);
  });

  it("GET / - list all awards", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "1", title: "Inspire Award", year: "2024", event_name: "World Champs", description: "Best overall", image_url: "trophy", season_id: 1 }
    ]);

    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.awards).toBeDefined();
  });

  it("POST /admin/save - create new award", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "New Award",
        year: 2024,
        event_name: "State",
        description: "Great job",
        image_url: "trophy",
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("GET / - list all awards with missing optional fields", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "1", title: "Missing", date: "2024", created_at: null }
    ]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.awards[0].image_url).toBe("trophy");
    expect(body.awards[0].season_id).toBeNull();
  });

  it("GET / - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - update existing award by ID", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 123 }); // Find by ID
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        id: "123",
        title: "Updated",
        year: 2024
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - update existing award by duplicate match", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: 123 }); // Find by duplicate title/year/event
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Duplicate",
        year: 2024,
        season_id: 5
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - create new award with mock insert object", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // Not duplicate
    mockDb.executeTakeFirst.mockResolvedValueOnce({ insertId: 999n }); // Insert result
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "New",
        year: 2024
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.id).toBe("999");
  });

  it("POST /admin/save - handles db error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ title: "Fail", year: 2024 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - soft-delete", async () => {
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(500);
  });
});
