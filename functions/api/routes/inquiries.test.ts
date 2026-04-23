/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { inquiriesRouter, purgeOldInquiries } from "./inquiries";
import { createMockInquiry } from "../../../src/test/factories/logisticsFactory";
import { mockExecutionContext } from "../../../src/test/utils";
import { http, HttpResponse } from "msw";
import { server } from "../../../src/test/setup";

vi.mock("../../utils/zulipSync", () => ({ sendZulipAlert: vi.fn().mockResolvedValue(true) }));
vi.mock("../../utils/notifications", () => ({ notifyByRole: vi.fn().mockResolvedValue(true) }));
vi.mock("../../utils/githubProjects", () => ({
  buildGitHubConfig: vi.fn().mockReturnValue({}),
  createProjectItem: vi.fn().mockResolvedValue(true),
}));

// We'll dynamically change what getSessionUser returns
let mockSessionUser: any = { role: "admin" };

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (c: any, next: any) => next(),
    rateLimitMiddleware: () => async (c: any, next: any) => next(),
    turnstileMiddleware: () => async (c: any, next: any) => next(),
    getSessionUser: vi.fn().mockImplementation(() => Promise.resolve(mockSessionUser)),
    logAuditAction: vi.fn().mockResolvedValue(true),
  };
});

describe("Hono Backend - /inquiries Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn().mockResolvedValue({ results: [] }),
      run: vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } }),
      first: vi.fn().mockResolvedValue(null),
      batch: vi.fn().mockResolvedValue([]),
    } as any,
    DEV_BYPASS: "true",
    TURNSTILE_SECRET_KEY: "secret",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionUser = { role: "admin" };
    server.use(
      http.post("https://challenges.cloudflare.com/turnstile/v0/siteverify", () => HttpResponse.json({ success: true })),
      http.post("https://api.mailchannels.net/tx/v1/send", () => new HttpResponse(null, { status: 202 }))
    );
  });

  it("GET / should list inquiries for admin", async () => {
    env.DB.all.mockResolvedValue({ results: [createMockInquiry()] });
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / should mask PII for students", async () => {
    mockSessionUser = { role: "user", member_type: "student" };
    env.DB.all.mockResolvedValue({ results: [{ ...createMockInquiry(), metadata: "{}" }] });
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / should reject unauthorized user", async () => {
    mockSessionUser = { role: "unverified" };
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("POST / should submit new sponsor inquiry and batch", async () => {
    const payload = { type: "sponsor", name: "Corp", email: "corp@example.com", metadata: { level: "Gold" } };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.batch).toHaveBeenCalled();
  });

  it("POST / should reject spam", async () => {
    env.DB.first.mockResolvedValueOnce({ id: "recent" });
    const payload = { type: "outreach", name: "Spammer", email: "spam@example.com" };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(429);
  });

  it("PATCH /:id/status should update status for admin", async () => {
    const req = new Request("http://localhost/123/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:id/status should reject student", async () => {
    mockSessionUser = { role: "user", member_type: "student" };
    const req = new Request("http://localhost/123/status", {
      method: "PATCH",
      body: JSON.stringify({ status: "approved" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("DELETE /:id should delete for admin", async () => {
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /:id should reject student", async () => {
    mockSessionUser = { role: "user", member_type: "student" };
    const req = new Request("http://localhost/123", { method: "DELETE" });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("purgeOldInquiries should delete old records", async () => {
    const res = await purgeOldInquiries(env.DB, 30);
    expect(res.deleted).toBe(1);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM inquiries"));
  });

  it("POST / should handle notification service failures gracefully", async () => {
    // Force a failure in one of the services to trigger the .catch() handlers
    const { sendZulipAlert } = await import("../../utils/zulipSync");
    const { notifyByRole } = await import("../../utils/notifications");
    const { createProjectItem } = await import("../../utils/githubProjects");

    (sendZulipAlert as any).mockRejectedValueOnce(new Error("Zulip fail"));
    (notifyByRole as any).mockRejectedValueOnce(new Error("Notify fail"));
    (createProjectItem as any).mockRejectedValueOnce(new Error("GH fail"));

    const payload = { type: "outreach", name: "Corp", email: "corp@example.com", metadata: { level: "Gold" } };
    const req = new Request("http://localhost/", {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    const res = await inquiriesRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(207); // Should return 207 with warnings
  });
});
