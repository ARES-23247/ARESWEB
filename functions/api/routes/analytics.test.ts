 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import analyticsRouter from "./analytics";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as any;

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({ ZULIP_API_KEY: "abc" }),
    ensureAdmin: async (_c: unknown, next: any) => next(),
    rateLimitMiddleware: () => async (_c: unknown, next: any) => next(),
    turnstileMiddleware: () => async (_c: unknown, next: any) => next(),
  };
});

describe("Analytics Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;
  let env: any;

  beforeEach(() => {
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q: any) => q),
      }),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
      fn: {
        count: vi.fn().mockReturnValue({ as: vi.fn().mockReturnThis() }),
        sum: vi.fn().mockReturnThis(),
        coalesce: vi.fn().mockReturnThis(),
        case: vi.fn().mockReturnValue({
          when: vi.fn().mockReturnThis(),
          and: vi.fn().mockReturnThis(),
          then: vi.fn().mockReturnThis(),
          else: vi.fn().mockReturnThis(),
          end: vi.fn().mockReturnThis()
        })
      }
    };
    env = {
      DB: {},
      TURNSTILE_SECRET_KEY: "test-secret",
      DEV_BYPASS: "true",
    };
    vi.clearAllMocks();

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", role: "admin" });
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
        body: JSON.stringify({ path: "/test", category: "Test", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "1.2.3.4" },
      });

      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockDb.execute).toHaveBeenCalled();
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
        res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
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

      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe("POST /sponsor-click", () => {
    it("should log a sponsor click", async () => {
      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "10.0.0.1" },
      });

      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.execute).toHaveBeenCalled();
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
        res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      }
      expect(res?.status).toBe(429);
    });

    it("should handle DB errors gracefully", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "11.0.0.1" },
      });

      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe("Admin Endpoints", () => {
    it("GET /summary should return analytics data", async () => {
      mockDb.execute
        .mockResolvedValueOnce([{ path: "/", views: 10 }])
        .mockResolvedValueOnce([{ path: "/about" }])
        .mockResolvedValueOnce([{ total: 5 }]);

      const req = new Request("http://localhost/admin/summary");
      const res = await testApp.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.topPages.length).toBe(1);
    });

    it("GET /roster-stats should return member impact data", async () => {
      mockDb.execute.mockResolvedValue([{ user_id: "1", nickname: "Test User" }]);

      const req = new Request("http://localhost/admin/roster-stats");
      const res = await testApp.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.roster.length).toBe(1);
    });

    it("GET /summary should handle DB errors", async () => {
      mockDb.execute.mockRejectedValueOnce(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/admin/summary");
      const res = await testApp.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);

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
      mockDb.execute.mockResolvedValue([{ user_id: "1", first_name: "Alice", badge_count: 5 }]);

      const req = new Request("http://localhost/leaderboard");
      const res = await testApp.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.leaderboard.length).toBe(1);
    });

    it("GET /leaderboard should handle DB errors", async () => {
      mockDb.execute.mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/leaderboard");
      const res = await testApp.request(req, {}, env, mockExecutionContext);
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
      const res = await testApp.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.posts).toBe(10);
    });

    it("GET /stats should handle DB errors", async () => {
      mockDb.executeTakeFirst.mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/admin/stats");
      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });

  describe("GET /search", () => {
    it("should return empty results for empty query", async () => {
      const req = new Request("http://localhost/search?q=");
      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBe(0);
    });

    it("should return search results", async () => {
      // sql<...>`...`.execute(db) calls db.executeQuery() which is inside getExecutor for kysely.
      // Wait, mockDb itself has executeQuery for sql template tags in Kysely?
      // Actually `execute(db)` passes the DB connection down.
      // In kysely, a raw sql template calls `executeQuery` on the passed object.
      mockDb.getExecutor().executeQuery = vi.fn()
        .mockResolvedValueOnce({ rows: [{ id: "1", title: "Post" }] })
        .mockResolvedValueOnce({ rows: [{ id: "2", title: "Event" }] })
        .mockResolvedValueOnce({ rows: [{ id: "3", title: "Doc" }] });

      const req = new Request("http://localhost/search?q=test");
      const res = await testApp.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.results.length).toBe(3);
    });

    it("should handle DB errors", async () => {
      mockDb.getExecutor().executeQuery = vi.fn().mockRejectedValue(new Error("DB Error"));
      const req = new Request("http://localhost/search?q=test");
      const res = await testApp.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
    });
  });
});
