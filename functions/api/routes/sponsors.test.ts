/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import sponsorsRouter from "./sponsors";
import { createMockSponsor } from "../../../src/test/factories/logisticsFactory";

vi.mock("../../utils/zulipSync", () => ({
  sendZulipAlert: vi.fn().mockResolvedValue(true),
}));
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: any) => next(),
    rateLimitMiddleware: () => async (c: any, next: any) => next(),
  };
});

describe("Hono Backend - /sponsors Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      first: vi.fn(),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as any,
    DEV_BYPASS: "true",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("GET / should list all sponsors", async () => {
    const mockSponsors = [createMockSponsor(), createMockSponsor()];
    env.DB.all.mockResolvedValue({ results: mockSponsors });
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin should list admin sponsors", async () => {
    env.DB.all.mockResolvedValue({ results: [] });
    const req = new Request("http://localhost/admin", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin should save sponsor", async () => {
    const req = new Request("http://localhost/admin", {
      method: "POST",
      body: JSON.stringify({ id: "s1", name: "Sponsor", tier: "Gold" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin should reject missing fields", async () => {
    const req = new Request("http://localhost/admin", {
      method: "POST",
      body: JSON.stringify({ name: "Sponsor" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /admin should reject invalid tier", async () => {
    const req = new Request("http://localhost/admin", {
      method: "POST",
      body: JSON.stringify({ id: "s1", name: "Sponsor", tier: "Diamond" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("DELETE /admin/:id should deactivate sponsor", async () => {
    const req = new Request("http://localhost/admin/s1", { method: "DELETE" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /roi/:token should get ROI", async () => {
    env.DB.all
      .mockResolvedValueOnce({ results: [{ sponsor_id: "s1" }] }) // token
      .mockResolvedValueOnce({ results: [{ name: "Sponsor" }] }) // sponsor
      .mockResolvedValueOnce({ results: [{ clicks: 5 }] }); // metrics

    const req = new Request("http://localhost/roi/t1", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /roi/:token should reject invalid token", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [] });
    const req = new Request("http://localhost/roi/t1", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /admin/tokens should list tokens", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [] });
    const req = new Request("http://localhost/admin/tokens", { method: "GET" });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/tokens/generate should generate token", async () => {
    const req = new Request("http://localhost/admin/tokens/generate", {
      method: "POST",
      body: JSON.stringify({ sponsor_id: "s1" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await sponsorsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
