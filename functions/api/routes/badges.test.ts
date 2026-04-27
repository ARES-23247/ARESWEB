 
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: any) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "1", email: "admin@test.com", role: "admin" }),
  };
});

import badgesRouter from "./badges";

describe("Hono Backend - /badges Router", () => {
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      innerJoin: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
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
      getExecutor: vi.fn().mockReturnValue({
        compileQuery: vi.fn().mockReturnValue({ sql: "", parameters: [], query: { kind: "RawNode" } }),
        executeQuery: vi.fn().mockResolvedValue({ rows: [] }),
        transformQuery: vi.fn((q) => q),
      }),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", badgesRouter);
  });

  it("GET / - list badges", async () => {
    mockDb.execute.mockResolvedValueOnce([{ id: "1", name: "Innovator", description: "...", icon: "...", color_theme: "..." }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin - create badge", async () => {
    const res = await testApp.request("/admin", {
      method: "POST",
      body: JSON.stringify({ id: "1", name: "Innovator", description: "...", icon: "...", color_theme: "..." }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/grant - grant badge to user", async () => {
    const res = await testApp.request("/admin/grant", {
      method: "POST",
      body: JSON.stringify({ userId: "u1", badgeId: "b1" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/grant/:userId/:badgeId - revoke badge", async () => {
    const res = await testApp.request("/admin/grant/u1/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:id - delete badge definition", async () => {
    const res = await testApp.request("/admin/b1", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /leaderboard - public leaderboard", async () => {
    mockDb.execute.mockResolvedValueOnce([{ user_id: "u1", nickname: "test", member_type: "student", badge_count: 5 }]);
    const res = await testApp.request("/leaderboard", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
