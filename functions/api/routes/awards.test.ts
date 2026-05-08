import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { AppEnv } from "../middleware";

// Simple inline mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: Context<AppEnv>, next: () => Promise<void>) => next(),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

import awardsRouter from "./awards";

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
          if (prop === 'then') {
            return (resolve: any, reject: any) => Promise.resolve(fns.all()).then(resolve).catch(reject);
          }
          if (prop === 'catch') {
            return (reject: any) => Promise.resolve(fns.all()).catch(reject);
          }
          if (prop === 'finally') {
            return (cb: any) => Promise.resolve(fns.all()).finally(cb);
          }
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
          if (prop === 'transaction') return vi.fn(async (cb: any) => cb(chainable));
          if (typeof prop === 'symbol') return chainable;
          target[prop as string] = vi.fn().mockReturnValue(chainable);
          return target[prop as string];
        }
      });
      return chainable;
    };;

describe("Hono Backend - /awards Router", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<AppEnv>;
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    mockDb = createMockDb();

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as any);
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
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
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
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
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
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/123", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(500);
  });
});
