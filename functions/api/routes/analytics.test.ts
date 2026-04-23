/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import analyticsRouter from "./analytics";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe("Analytics Router", () => {
  let mockDb: any;
  let env: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      batch: vi.fn().mockResolvedValue([{ results: [] }, { results: [] }, { results: [] }]),
    };
    env = {
      DB: mockDb,
      TURNSTILE_SECRET_KEY: "test-secret",
      DEV_BYPASS: "true",
    };
    vi.clearAllMocks();
    
    // Mock turnstile fetch
    global.fetch = vi.fn().mockResolvedValue({
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

      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
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
      mockDb.run.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/track", {
        method: "POST",
        body: JSON.stringify({ path: "/test", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "5.6.7.8" },
      });

      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
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

      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      expect(mockDb.run).toHaveBeenCalled();
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
      mockDb.run.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/sponsor-click", {
        method: "POST",
        body: JSON.stringify({ sponsor_id: "spon-123", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "11.0.0.1" },
      });

      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });
  });

  describe("Admin Endpoints", () => {
    it("GET /summary should return analytics data", async () => {
      mockDb.all
        .mockResolvedValueOnce({ results: [{ path: "/", views: 10 }] })
        .mockResolvedValueOnce({ results: [{ path: "/about" }] })
        .mockResolvedValueOnce({ results: [{ total: 5 }] });

      const req = new Request("http://localhost/summary");
      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.topPages.length).toBe(1);
    });

    it("GET /roster-stats should return member impact data", async () => {
      mockDb.all.mockResolvedValue({ results: [{ user_id: "1", nickname: "Test User" }] });

      const req = new Request("http://localhost/roster-stats");
      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.roster.length).toBe(1);
    });

    it("GET /summary should handle DB errors", async () => {
      mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/summary");
      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);

      expect(res.status).toBe(500);

      consoleSpy.mockRestore();
    });
    it("GET /roster-stats should handle DB errors", async () => {
      mockDb.all.mockRejectedValue(new Error("DB Error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const req = new Request("http://localhost/roster-stats");
      const res = await analyticsRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(500);
      
      consoleSpy.mockRestore();
    });
  });
});
