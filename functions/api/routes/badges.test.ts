import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext, createMockExpressionBuilder } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: any) => next(),
    ensureAuth: async (c: any, next: any) => next(),
    rateLimitMiddleware: () => (c: any, next: any) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

// Mock Zulip
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue({ success: true }),
}));

import badgesRouter from "./badges";

describe("Hono Backend - /badges Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;
  const mockEnv = { DEV_BYPASS: "true" };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn((args) => {
        if (Array.isArray(args)) {
          args.forEach((arg) => {
            if (typeof arg === "function") {
              arg(createMockExpressionBuilder());
            }
          });
        }
        return mockDb;
      }),
      where: vi.fn().mockReturnThis(),
      groupBy: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", badgesRouter);
  });

  it("GET / - list badges", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "...", created_at: "2024-01-01" }]);
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.badges[0].name).toBe("Innovator");
  });

  it("GET / - handles error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
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
    expect(mockDb.insertInto).toHaveBeenCalledWith("badges");
  });

  it("POST /admin/grant - grant badge to user", async () => {
    mockDb.executeTakeFirst
      .mockResolvedValueOnce({ nickname: "testuser" }) // userProfile
      .mockResolvedValueOnce({ name: "Innovator", icon: "Trophy" }); // badge

    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    
    expect(res.status).toBe(200);
    expect(mockDb.insertInto).toHaveBeenCalledWith("user_badges");
  });

  it("DELETE /admin/grant/:userId/:badgeId - revoke badge", async () => {
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("user_badges");
  });

  it("DELETE /admin/:id - delete badge definition", async () => {
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(mockDb.deleteFrom).toHaveBeenCalledWith("badges");
  });

  it("GET /leaderboard - public leaderboard", async () => {
    mockDb.execute.mockResolvedValueOnce([{ user_id: "u1", nickname: "test", member_type: "student", badge_count: 5 }]);
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.leaderboard[0].badge_count).toBe(5);
  });

  it("GET /leaderboard - handles error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin - create badge error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "..." }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/grant/:userId/:badgeId - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB error"));
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - zulip sync error ignored in background", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error")); // cause background catch
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });
  it("GET / - list badges with missing optional fields", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "2", name: "No Options", created_at: "2024-01-01" }]); // missing description, icon, color_theme
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - handles error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin - create badge error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "Award", color_theme: "..." }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/grant - zulip sync without user profile nickname", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ first_name: "John" }); // userProfile without nickname
    mockDb.executeTakeFirst.mockResolvedValueOnce({ name: "Badge", icon: "Rocket" }); // badge
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/grant - zulip sync without user profile name at all", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({}); // userProfile without anything
    mockDb.executeTakeFirst.mockResolvedValueOnce({ name: "Badge" }); // badge without icon
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/grant - error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/grant/:userId/:badgeId - error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:id - error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /leaderboard - leaderboard with null user profile fields", async () => {
    mockDb.execute.mockResolvedValueOnce([{ user_id: "u1", nickname: null, member_type: null, badge_count: 5 }]);
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /leaderboard - error without message", async () => {
    mockDb.execute.mockRejectedValueOnce({});
    const res = await testApp.request("/leaderboard", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
