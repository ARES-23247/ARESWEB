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
    };;

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
