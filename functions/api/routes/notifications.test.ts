import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { getSessionUser } from "../middleware";
import { AppEnv } from "../middleware";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "test@test.com", role: "member" }),
  };
});

import notificationsRouter from "./notifications";

// Simple inline mock execution context
function createMockExecutionContext() {
  return {
    waitUntil: vi.fn((promise: Promise<unknown>) => promise),
    passThroughOnException: vi.fn(),
    props: {},
  };
}

// Simple inline mock database for Drizzle ORM
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

describe("Hono Backend - /notifications Router", () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let testApp: Hono<AppEnv>;
  const mockExecutionContext = createMockExecutionContext();

  beforeEach(() => {
    vi.clearAllMocks();
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "1", email: "test@test.com", role: "member" });
    mockDb = createMockDb();

    testApp = new Hono<AppEnv>();
    testApp.use("*", async (c: Context<AppEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as any);
      await next();
    });
    testApp.route("/", notificationsRouter);
  });

  it("GET / - list notifications", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: "1", title: "Test", message: "...", link: "/test", priority: "high", is_read: 0, created_at: "..." },
      { id: "2", title: "Test2", message: "...", is_read: null, created_at: "..." }
    ]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /:id/read - mark as read", async () => {
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PUT /read-all - mark all as read", async () => {
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id - delete notification", async () => {
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /pending-counts - get pending counts", async () => {
    mockDb.get.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.get.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.get.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.get.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { inquiries?: number };
    expect(body.inquiries).toBe(5);
  });

  it("GET /action-items - get dashboard action items", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { inquiries: Array<{ id: number }> };
    expect(body.inquiries.length).toBe(1);
  });

  it("GET / - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("PUT /:id/read - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("PUT /read-all - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("DELETE /:id - handles database error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /pending-counts - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET /action-items - handles unauthenticated", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));
    mockDb.first.mockRejectedValueOnce(new Error("Fail"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:id/read - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/123/read", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /read-all - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/read-all", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:id - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/123", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /pending-counts - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /action-items - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    mockDb.get.mockRejectedValueOnce(new Error("DB error"));
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    mockDb.first.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /pending-counts - filters outreach for students", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "1", role: "user", member_type: "student" });

    mockDb.get.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.get.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.get.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.get.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /action-items - filters outreach for students", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "1", role: "user", member_type: "student" });
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /pending-counts - does not filter outreach for mentors", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "1", role: "user", member_type: "mentor" });

    mockDb.get.mockResolvedValueOnce({ count: 5 }); // inquiries
    mockDb.get.mockResolvedValueOnce({ count: 2 }); // posts
    mockDb.get.mockResolvedValueOnce({ count: 1 }); // events
    mockDb.get.mockResolvedValueOnce({ count: 0 }); // docs
    const res = await testApp.request("/pending-counts", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /action-items - does not filter outreach for mentors", async () => {
    (getSessionUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ id: "1", role: "user", member_type: "mentor" });
    mockDb.execute.mockResolvedValueOnce([{ id: 1 }]); // inquiries
    mockDb.execute.mockResolvedValueOnce([{ title: "post1" }]); // posts
    mockDb.execute.mockResolvedValueOnce([]); // events
    mockDb.execute.mockResolvedValueOnce([]); // docs
    const res = await testApp.request("/action-items", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
