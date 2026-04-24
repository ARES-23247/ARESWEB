/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import analyticsRouter from "./analytics";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
} as any;

describe("Analytics Router", () => {
  let mockDb: any;
  let testApp: Hono;
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
      execute: vi.fn().mockResolvedValue([]),
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

    testApp = new Hono();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      c.set("user", { id: "1", role: "admin" });
      await next();
    });
    testApp.route("/", analyticsRouter);
    
    // Mock turnstile fetch
    globalThis.fetch = vi.fn().mockResolvedValue({
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
  });
});
