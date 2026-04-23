/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import judgesRouter from "./judges";

const mockExecutionContext = {
  waitUntil: vi.fn(),
  passThroughOnException: vi.fn(),
};

describe("Judges Router", () => {
  let mockDb: any;
  let env: any;

  beforeEach(() => {
    mockDb = {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true }),
      first: vi.fn(),
      batch: vi.fn().mockResolvedValue([{ success: true }]),
    };
    env = {
      DB: mockDb,
      TURNSTILE_SECRET_KEY: "test-secret",
      DEV_BYPASS: "true",
    };
    vi.clearAllMocks();
    
    // Mock the global fetch for turnstile
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({ success: true }),
    }) as any;
  });

  describe("POST /login", () => {
    it("should return 403 on invalid turnstile", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        json: () => Promise.resolve({ success: false }),
      }) as any;

      const req = new Request("http://localhost/login", {
        method: "POST",
        body: JSON.stringify({ code: "TESTCODE", turnstileToken: "bad" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(403);
    });

    it("should return 403 for invalid access code", async () => {
      mockDb.first.mockResolvedValue(null);

      const req = new Request("http://localhost/login", {
        method: "POST",
        body: JSON.stringify({ code: "BADCODE", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(403);
    });

    it("should return success on valid login", async () => {
      mockDb.first.mockResolvedValue({ code: "GOODCODE", label: "Judge 1", expires_at: null });

      const req = new Request("http://localhost/login", {
        method: "POST",
        body: JSON.stringify({ code: "GOODCODE", turnstileToken: "good" }),
        headers: { "Content-Type": "application/json" },
      });

      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.label).toBe("Judge 1");
    });
  });

  describe("GET /portfolio", () => {
    it("should block request without X-Judge-Code header", async () => {
      const req = new Request("http://localhost/portfolio");
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(401);
    });

    it("should block request with invalid code", async () => {
      mockDb.first.mockResolvedValue(null); // Invalid code

      const req = new Request("http://localhost/portfolio", {
        headers: { "X-Judge-Code": "BADCODE" },
      });
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      expect(res.status).toBe(403);
    });

    it("should fetch portfolio data on valid code", async () => {
      mockDb.first.mockResolvedValue({ code: "GOODCODE" }); // Valid code
      
      // Mock portfolio queries
      mockDb.all.mockResolvedValueOnce({ results: [{ title: "Portfolio Doc" }] }) // Docs
                .mockResolvedValueOnce({ results: [{ title: "Outreach 1" }] })    // Outreach
                .mockResolvedValueOnce({ results: [{ title: "Award 1" }] })       // Awards
                .mockResolvedValueOnce({ results: [{ name: "Sponsor 1" }] });     // Sponsors

      const req = new Request("http://localhost/portfolio", {
        headers: { "X-Judge-Code": "GOODCODE" },
      });
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.portfolioDocs.length).toBe(1);
      expect(body.outreach.length).toBe(1);
      
      // Security check: Make sure we explicitly look for "status = 'published'"
      const queryStr = mockDb.prepare.mock.calls.find((c: any) => c[0].includes("SELECT slug, title, category, description, content FROM docs"))[0];
      expect(queryStr).toContain("status = 'published'");
    });
  });

  describe("Admin Endpoints", () => {
    it("GET /admin/codes should list codes", async () => {
      mockDb.all.mockResolvedValue({ results: [{ id: "1", code: "C1" }] });
      
      const req = new Request("http://localhost/admin/codes");
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.codes.length).toBe(1);
    });

    it("POST /admin/codes should create code and log audit", async () => {
      const req = new Request("http://localhost/admin/codes", {
        method: "POST",
        body: JSON.stringify({ label: "New Judge" }),
        headers: { "Content-Type": "application/json" },
      });
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.success).toBe(true);
      expect(body.code.length).toBe(12);
      expect(mockDb.run).toHaveBeenCalled();
    });

    it("DELETE /admin/codes/:id should delete code", async () => {
      mockDb.run.mockResolvedValue({ success: true });
      
      const req = new Request("http://localhost/admin/codes/123", { method: "DELETE" });
      const res = await judgesRouter.request(req, {}, env, mockExecutionContext);
      
      expect(res.status).toBe(200);
    });
  });
});
