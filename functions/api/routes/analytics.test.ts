/* eslint-disable @typescript-eslint/no-explicit-any -- ts-rest handler input validated by contract library */
import { TestEnv, MockExecutionContext } from "../../../src/test/types";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import analyticsRouter from "./analytics";



const mockExecutionContext: MockExecutionContext = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
  passThroughOnException: vi.fn(),
  props: {},
};

import { createMockExpressionBuilder } from "../../../src/test/utils";

const rateLimitStore = new Map<string, number>();

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({ ZULIP_API_KEY: "abc" }),
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    turnstileMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    checkPersistentRateLimit: vi.fn().mockImplementation(async (_db, key, _ua, limit) => {
      const count = (rateLimitStore.get(key) || 0) + 1;
      rateLimitStore.set(key, count);
      return count <= limit;
    })
  };
});

describe("Analytics Router", () => {
  let mockDb: any;
  let testApp: Hono<TestEnv>;
  let env: any;

  beforeEach(() => {
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockImplementation((arg) => {
        const executeArg = (a: unknown) => {
          if (typeof a === "function") {
            try {
              a(createMockExpressionBuilder());
            } catch (_e) { /* ignore */ }
          }
        };
        
        if (Array.isArray(arg)) {
          arg.forEach(executeArg);
        } else {
          executeArg(arg);
        }
        return mockDb;
      }),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockImplementation((_table, arg1, arg2) => {
        const joinMock = { onRef: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() };
        if (typeof arg2 === "function") {
          try { arg2(joinMock); } catch(_e) { /* ignore */ }
        } else if (typeof arg1 === "function") {
          try { arg1(joinMock); } catch(_e) { /* ignore */ }
        }
        return mockDb;
      }),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q: unknown) => q),
      }),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockImplementation((arg) => {
        if (typeof arg === "function") {
          try { arg({ columns: vi.fn().mockReturnThis(), doUpdateSet: vi.fn().mockReturnThis() }); } catch(_e) { /* ignore */ }
        }
        return mockDb;
      }),
      doUpdateSet: vi.fn().mockReturnThis(),
      fn: {}
    };
    env = {
      DB: {} as any,
      TURNSTILE_SECRET_KEY: "test-secret",
      DEV_BYPASS: "true"
    };
    vi.clearAllMocks();
    rateLimitStore.clear();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      c.set("sessionUser", { id: "1", role: "admin" } as any);
      await next();
    });
    testApp.route("/", analyticsRouter);
    
    // Mock turnstile fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true }),
    }) as any;
  });

  describe("POST /track", () => {
    it("should log a page view", async () => {
      const req = new Request("http://localhost/track", {
        method: "POST",
        body: JSON.stringify({ path: "/test", category: "Test", turnstileToken: "good", referrer: "ref" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4", "User-Agent": "test-agent" },
      });

      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as { success: boolean; data?: unknown; error?: string };
      expect(body.success).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it("should log a page view with missing fields", async () => {
      const req = new Request("http://localhost/track", {
        method: "POST",
        body: JSON.stringify({ turnstileToken: "good" }),
        headers: { "Content-Type": "application/json" }, // Missing IP and UA
      });

      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(200);
    });

    it("should return 429 on rate limit exceeded", async () => {
      // Send 21 requests to exceed the limit of 20
      let res: Response | null = null;
      for (let i = 0; i < 21; i++) {
        const req = new Request("http://localhost/track", {
          method: "POST",
          body: JSON.stringify({ path: "/test", turnstileToken: "good" }),
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": "rate-limit-test" },
        });
        res = await testApp.request(req, {}, env, mockExecutionContext);
      }
      expect(res?.status).toBe(429);
    });

    it("should handle DB errors gracefully", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/track", {
        method: "POST",
        body: JSON.stringify({ path: "/test", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.6.7.8" },
      });

      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe("POST /sponsor-click", () => {
    it("should log a sponsor click", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "spon-123" });
      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.0.0.1", "User-Agent": "test-agent" },
      });

      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.execute).toHaveBeenCalled();
    });

    it("should log a sponsor click with missing headers", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "spon-123" });
      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json" }, // Missing IP and UA
      });

      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(200);
    });

    it("should return 429 on rate limit exceeded", async () => {
      // Send 11 requests to exceed the limit of 10
      let res: Response | null = null;
      for (let i = 0; i < 11; i++) {
        const req = new Request("http://localhost/sponsor-click", {
          method: "POST",
          body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
          headers: { "Content-Type": "application/json", "CF-Connecting-IP": "rate-limit-sponsor" },
        });
        res = await testApp.request(req, {}, env, mockExecutionContext);
      }
      expect(res?.status).toBe(429);
    });

    it("should handle DB errors gracefully", async () => {
      mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "spon-123" });
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "11.0.0.1" },
      });

      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(500);

      consoleSpy.mockRestore();
    });
  });

  describe("Admin Endpoints", () => {
    it("GET /admin/platform-analytics should return analytics data", async () => {
      mockDb.executeTakeFirst
        .mockResolvedValueOnce({ total: 100 }) // totalViewsData
        .mockResolvedValueOnce({ total: 50 }) // assetsCount
        .mockResolvedValueOnce({ total: 1000 }); // apiCount

      mockDb.getExecutor().executeQuery
        .mockResolvedValueOnce({ rows: [{ unique: 20 }] }) // uniqueVisitorsData
        .mockResolvedValueOnce({ rows: [{ date: "2023-01-01", pageViews: 10 }] }) // activityData
        .mockResolvedValueOnce({ rows: [{ date: "2023-01-01", avg_latency: 150 }] }); // latencyData

      mockDb.execute
        .mockResolvedValueOnce([{ path: "/", category: "home", views: 10 }]) // topPagesDataRow
        .mockResolvedValueOnce([{ referrer: "google.com", visits: 5 }]) // referrersDataRow
        .mockResolvedValueOnce([{ path: "/", category: "home", user_agent: "test", referrer: "google.com", timestamp: "2023-01-01T12:00:00Z" }]) // recentViewsDataRow
        .mockResolvedValueOnce([{ category: "home", total: 10 }]); // totalsDataRow

      const req = new Request("http://localhost/admin/platform-analytics");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.topPages.length).toBe(1);
    });

    it("GET /roster-stats should return member impact data", async () => {
      mockDb.execute.mockResolvedValue([
        { user_id: "1", nickname: "Test User" },
        { user_id: "2" } // missing nickname, member_type, etc.
      ]);

      const req = new Request("http://localhost/admin/roster-stats");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.roster.length).toBe(2);
      expect(body.roster[1].nickname).toBeNull();
      expect(body.roster[1].attended_events).toBe(0);
    });

    it("GET /admin/platform-analytics should handle DB errors gracefully", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/admin/platform-analytics");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);

      consoleSpy.mockRestore();
    });
    it("GET /roster-stats should handle DB errors", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/admin/roster-stats");
      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });

    it("GET /leaderboard should return leaderboard data", async () => {
      mockDb.execute.mockResolvedValue([
        { user_id: "1", first_name: "Alice", badge_count: 5, member_type: "mentor" },
        { user_id: "2", member_type: "student", badge_count: 2 },
        { user_id: "3", member_type: "mentor", badge_count: 1 }, // missing first_name
        { user_id: "4", badge_count: 0 } // missing member_type
      ]);

      const req = new Request("http://localhost/leaderboard");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.leaderboard.length).toBe(4);
      expect(body.leaderboard[1].first_name).toBe("ARES Member");
      expect(body.leaderboard[2].first_name).toBe("ARES");
    });

    it("GET /leaderboard should handle DB errors", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/leaderboard");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(500);
    });

    it("GET /stats should return platform stats", async () => {
      // getStats needs to getDbSettings from mockDb 
      // but getDbSettings selects from settings where key like %
      mockDb.executeTakeFirst
        .mockResolvedValueOnce({ total: 10 }) // posts
        .mockResolvedValueOnce({ total: 5 })  // events
        .mockResolvedValueOnce({ total: 20 }) // docs
        .mockResolvedValueOnce({ total: 2 }); // security
      
      const req = new Request("http://localhost/admin/stats");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.posts).toBe(10);
    });

    it("GET /stats should handle null counts", async () => {
      mockDb.executeTakeFirst.mockResolvedValue(undefined);
      const req = new Request("http://localhost/admin/stats");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.posts).toBe(0);
    });

    it("GET /stats should handle DB errors", async () => {
      mockDb.executeTakeFirst.mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/admin/stats");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /search", () => {
    it("should return empty results for empty query", async () => {
      const req = new Request("http://localhost/search?q=");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBe(0);
    });

    it("should return search results", async () => {
      mockDb.getExecutor().executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: "1", title: "Post" }] })
        .mockResolvedValueOnce({ rows: [{ id: "2", title: "Event" }] })
        .mockResolvedValueOnce({ rows: [{ id: "3", title: "Doc" }] });

      const req = new Request("http://localhost/search?q=test");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBe(3);
    });

    it("should return search results with undefined rows", async () => {
      mockDb.getExecutor().executeQuery = vi.fn().mockResolvedValue({});
      const req = new Request("http://localhost/search?q=test");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBe(0);
    });

    it("should handle DB errors", async () => {
      mockDb.getExecutor().executeQuery = vi.fn().mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/search?q=test");
      const res = await testApp.request(req, {}, env as any, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });
});

