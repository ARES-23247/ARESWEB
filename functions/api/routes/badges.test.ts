/* eslint-disable @typescript-eslint/no-explicit-any */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext, createDrizzleProxy, createMockDrizzle } from "../../../src/test/utils";
import type { TestEnv, MockDrizzle } from "../../../src/test/types";
// import type { DrizzleProxy } from "../../../src/test/mocks";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    ensureAuth: async (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    rateLimitMiddleware: () => (c: Context<TestEnv>, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

// Mock Zulip
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import { badgesRouter } from "./badges";

describe("Hono Backend - /badges Router", () => {
  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;
  const mockEnv: TestEnv["Bindings"] = { DEV_BYPASS: "true", DB: {} as any };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", createDrizzleProxy(mockDb) as any);
      await next();
    });
    testApp.route("/", badgesRouter);
  });

  it("GET / - list badges", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "...", created_at: "2024-01-01" }]);
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { badges: Array<{ name: string }> };
    expect(body.badges[0].name).toBe("Innovator");
  });

  it("GET / - handles error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin - create badge", async () => {
    const res = await testApp.request("/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "..." }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("POST /admin/grant - grant badge to user", async () => {
    mockDb.get
      .mockResolvedValueOnce({ nickname: "testuser" }) // userProfile
      .mockResolvedValueOnce({ name: "Innovator", icon: "Trophy" }); // badge

    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    
    expect(res.status).toBe(200);
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("DELETE /admin/grant/:userId/:badgeId - revoke badge", async () => {
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("DELETE /admin/:id - delete badge definition", async () => {
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it("GET /leaderboard - public leaderboard", async () => {
    mockDb.all.mockResolvedValueOnce([{ user_id: "u1", nickname: "test", member_type: "student", badge_count: 5 }]);
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as { leaderboard: Array<{ badge_count: number }> };
    expect(body.leaderboard[0].badge_count).toBe(5);
  });

  it("GET /leaderboard - handles error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin - create badge error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "..." }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/grant/:userId/:badgeId - error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - zulip sync error ignored in background", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB error")); // cause background catch
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });
  it("GET / - list badges with missing optional fields", async () => {
    mockDb.all.mockResolvedValueOnce([{ id: "2", name: "No Options", created_at: "2024-01-01" }]); // missing description, icon, color_theme
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - handles error without message", async () => {
    mockDb.all.mockRejectedValueOnce({});
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin - create badge error without message", async () => {
    mockDb.run.mockRejectedValueOnce({});
    const res = await testApp.request("/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "..." }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - zulip sync without user profile nickname", async () => {
    mockDb.get.mockResolvedValueOnce({ first_name: "John" }); // userProfile without nickname
    mockDb.get.mockResolvedValueOnce({ name: "Badge", icon: "Rocket" }); // badge
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/grant - zulip sync without user profile name at all", async () => {
    mockDb.get.mockResolvedValueOnce({}); // userProfile without anything
    mockDb.get.mockResolvedValueOnce({ name: "Badge" }); // badge without icon
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/grant - error without message", async () => {
    mockDb.run.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/grant/:userId/:badgeId - error without message", async () => {
    mockDb.run.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error without message", async () => {
    mockDb.run.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /leaderboard - leaderboard with null user profile fields", async () => {
    mockDb.all.mockResolvedValueOnce([{ user_id: "u1", nickname: null, member_type: null, badge_count: 5 }]);
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /leaderboard - error without message", async () => {
    mockDb.all.mockRejectedValueOnce({});
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});

