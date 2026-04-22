import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import badgesRouter from "./badges";
import { createMockBadge } from "../../../src/test/factories/userFactory";

// Mock Zulip sync
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(() => Promise.resolve(123)),
}));

describe("Hono Backend - /badges Router", () => {
  const env = {
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      all: vi.fn(),
      run: vi.fn(),
      first: vi.fn(),
    } as any,
    DEV_BYPASS: "true",
  };

  const executionCtx = {
    waitUntil: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should list all available badges", async () => {
    const mockBadges = [
      createMockBadge({ id: "gold", name: "Gold Badge" }),
      createMockBadge({ id: "silver", name: "Silver Badge" }),
    ];
    env.DB.all.mockResolvedValue({ results: mockBadges });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.badges).toHaveLength(2);
    expect(body.badges[0].name).toBe("Gold Badge");
  });

  it("should handle list errors gracefully", async () => {
    env.DB.all.mockRejectedValue(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ badges: [] });
    
    consoleSpy.mockRestore();
  });

  it("should create a badge (admin)", async () => {
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify({ id: "new-badge", name: "New Badge" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, id: "new-badge" });
  });

  it("should return 400 for missing badge data", async () => {
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify({ name: "Incomplete" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("should award a badge to a user (admin)", async () => {
    env.DB.run.mockResolvedValue({ success: true });
    env.DB.first.mockResolvedValueOnce({ nickname: "Winner" }); // for Zulip async task
    env.DB.first.mockResolvedValueOnce({ name: "Pro Badge", icon: "Star" }); // for Zulip async task

    const req = new Request("http://localhost/users/user-1/award", {
      method: "POST",
      body: JSON.stringify({ badge_id: "pro-badge" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await badgesRouter.request(req, undefined, env, executionCtx as any);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_badges"));
    expect(executionCtx.waitUntil).toHaveBeenCalled();
  });

  it("should revoke a badge from a user (admin)", async () => {
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/users/user-1/pro-badge/revoke", {
      method: "DELETE"
    });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM user_badges"));
  });

  it("should return public leaderboard", async () => {
    const mockLeaderboard = [
      { user_id: "1", nickname: "Alpha", badge_count: 10 },
      { user_id: "2", nickname: "Beta", badge_count: 8 },
    ];
    env.DB.all.mockResolvedValue({ results: mockLeaderboard });

    const req = new Request("http://localhost/leaderboard", { method: "GET" });
    const res = await badgesRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.leaderboard).toHaveLength(2);
    expect(body.leaderboard[0].nickname).toBe("Alpha");
  });
});
