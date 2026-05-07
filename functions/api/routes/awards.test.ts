import { TestEnv } from "../../../src/test/types";

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

vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import awardsRouter from "./awards";
import { createDrizzleProxy, createMockDrizzle } from "../../../src/test/utils";
import type { MockDrizzle } from "../../../src/test/types";

describe("Hono Backend - /awards Router", () => {
  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;

  beforeEach(() => {
    mockDb = createMockDrizzle();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", createDrizzleProxy(mockDb) as MockDrizzle);
      await next();
    });
    testApp.route("/", awardsRouter);
  });

  it("GET / - list all awards", async () => {
    mockDb.all.mockResolvedValueOnce([
      { id: "1", title: "Inspire Award", date: "2024", event_name: "World Champs", description: "Best overall", image_url: "trophy", season_id: 1 }
    ]);

    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { awards: unknown };
    expect(body.awards).toBeDefined();
  });

  it("GET / - list all awards with explicit limit and offset 0", async () => {
    mockDb.all.mockResolvedValueOnce([]);
    const res = await testApp.request("/?limit=0&offset=0", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.limit).toHaveBeenCalledWith(50);
    expect(mockDb.offset).toHaveBeenCalledWith(0);
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
    mockDb.all.mockResolvedValueOnce([
      { id: "1", title: "Missing", date: "2024", created_at: null }
    ]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { awards: Array<{ image_url: string; season_id: number | null }> };
    expect(body.awards[0].image_url).toBe("trophy");
    expect(body.awards[0].season_id).toBeNull();
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - update existing award by ID", async () => {
    mockDb.get.mockResolvedValueOnce({ id: 123 }); // Find by ID
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

  it("POST /admin/save - update by ID but not found falls back to duplicate check", async () => {
    mockDb.get.mockResolvedValueOnce(null); // Find by ID fails
    mockDb.get.mockResolvedValueOnce({ id: 456 }); // Duplicate check succeeds
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        id: "999",
        title: "Updated",
        year: 2024
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string | number };
    expect(body.id).toBe("456");
  });

  it("POST /admin/save - update existing award by duplicate match", async () => {
    mockDb.get.mockResolvedValueOnce({ id: 123 }); // Find by duplicate title/year/event
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
    mockDb.get.mockResolvedValueOnce(null); // Not duplicate
    mockDb.get.mockResolvedValueOnce({ insertId: 999n }); // Insert result
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "New",
        year: 2024
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { id: string | number };
    expect(body.id).toBe("999");
  });

  it("POST /admin/save - handles db error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
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
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(500);
  });
});

