import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: Context<AppEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

vi.mock("../middleware/cache", async () => {
  return {
    edgeCacheMiddleware: () => async (_c: Context, next: () => Promise<void>) => next()
  };
});

import locationsRouter from "./locations";

const mockExecutionContext = {
  waitUntil: vi.fn(),
};

describe("Hono Backend - /locations Router", () => {
  let app: Hono<AppEnv>;

  const createMockDb = () => ({
    all: vi.fn().mockResolvedValue([]),
    run: vi.fn().mockResolvedValue({ success: true }),
    get: vi.fn().mockResolvedValue(null),
  });

  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();

    app = new Hono<AppEnv>();
    app.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as never);
      await next();
    });
    app.route("/", locationsRouter);
  });

  it("GET / - list locations", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123 Main St", is_deleted: 0 }]);
    const res = await app.request("/", {}, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
    const body = await res.json() as { locations: { id: string; name: string }[] };
    expect(body.locations.length).toBe(1);
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/", {}, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - list all locations", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "Shop", address: "123", is_deleted: 1 }]);
    const res = await app.request("/admin/list", {}, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/list", {}, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - save location", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles update with existing id", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "123", name: "Shop", address: "123 Main St", maps_url: "https://maps.google.com", is_deleted: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - soft delete location", async () => {
    const res = await app.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("GET /admin/list - missing optional fields in db", async () => {
    mockDb.all.mockResolvedValueOnce([{ name: "Shop", address: "123" }]); // missing id, is_deleted
    const res = await app.request("/admin/list", {}, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save location with explicit optional fields", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ name: "Shop", address: "123 Main St", maps_url: "http://maps", is_deleted: 1 }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles update without optional fields", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ id: "123", name: "Shop", address: "123 Main St" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await app.request("/admin/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, { DEV_BYPASS: "true" } as never, mockExecutionContext as never);
    expect(res.status).toBe(500);
  });
});
