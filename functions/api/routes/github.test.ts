
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getDbSettings: vi.fn().mockResolvedValue({}),
    ensureAdmin: async (_c: unknown, next: any) => next(),
    getSocialConfig: vi.fn().mockResolvedValue({
      GITHUB_PAT: "ghp_test123",
      GITHUB_PROJECT_ID: "PVT_test123",
    }),
  };
});

vi.mock("../../utils/githubProjects", () => ({
  buildGitHubConfig: vi.fn().mockReturnValue({ pat: "ghp_test123", projectId: "PVT_test123", org: "test-org" }),
  fetchProjectBoard: vi.fn().mockResolvedValue({
    title: "Test Board",
    shortDescription: "Test Desc",
    items: [
      {
        id: "item_1",
        title: "Test Task 1",
        status: "Todo",
        updatedAt: "2026-01-01T00:00:00Z"
      }
    ],
    totalCount: 1
  }),
  createProjectItem: vi.fn().mockResolvedValue("new_item_id"),
}));

import githubRouter from "./github";

describe("Hono Backend - /github Router", () => {
  
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();

    testApp = new Hono<any>();
    testApp.onError((err, c: any) => {
      console.error("Test App Error:", err);
      return c.json({ error: err.message }, 500);
    });
    
    // Mount the router under the base path
    testApp.route("/", githubRouter);
  });

  it("GET /projects - successfully maps board items array instead of object", async () => {
    const res = await testApp.request("/projects", {
      headers: { "DEV_BYPASS": "true" }
    }, {}, mockExecutionContext);
    
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    
    expect(body.success).toBe(true);
    expect(Array.isArray(body.board)).toBe(true);
    expect(body.board.length).toBe(1);
    expect(body.board[0].id).toBe("item_1");
    expect(body.board[0].title).toBe("Test Task 1");
  });

  it("POST /projects/items - creates new item", async () => {
    const res = await testApp.request("/projects/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "New Test Task"
      })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  it("GET /projects - missing config", async () => {
    const { buildGitHubConfig } = await import("../../utils/githubProjects");
    vi.mocked(buildGitHubConfig).mockReturnValueOnce(null);
    const res = await testApp.request("/projects", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  it("GET /projects - fetch error", async () => {
    const { fetchProjectBoard } = await import("../../utils/githubProjects");
    vi.mocked(fetchProjectBoard).mockRejectedValueOnce(new Error("API Error"));
    const res = await testApp.request("/projects", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(false);
  });

  it("POST /projects/items - missing config", async () => {
    const { buildGitHubConfig } = await import("../../utils/githubProjects");
    vi.mocked(buildGitHubConfig).mockReturnValueOnce(null);
    const res = await testApp.request("/projects/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Test Task" })
    }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /projects/items - creation error", async () => {
    const { createProjectItem } = await import("../../utils/githubProjects");
    vi.mocked(createProjectItem).mockRejectedValueOnce(new Error("API Error"));
    const res = await testApp.request("/projects/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Test Task" })
    }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  describe("GET /activity", () => {
    let fetchMock: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      fetchMock = vi.fn();
      vi.stubGlobal("fetch", fetchMock);
      vi.stubGlobal("caches", {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue(null),
          put: vi.fn().mockResolvedValue(undefined)
        })
      });
    });

    it("returns activity data and caches it", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "repo1" }]
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            total: 5,
            week: Math.floor(Date.now() / 1000) - 86400 * 7, // 1 week ago
            days: [0, 1, 0, 2, 0, 2, 0]
          }
        ]
      });

      const res = await testApp.request("/activity", {}, {}, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.repoCount).toBe(1);
      expect(body.totalCommits).toBe(5);
      expect(body.grid.length).toBeGreaterThanOrEqual(52);
    });

    it("handles GitHub API error on repo list", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 500 });
      const res = await testApp.request("/activity", {}, {}, mockExecutionContext);
      expect(res.status).toBe(500);
    });

    it("handles GitHub API error on commit activity fetch", async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => [{ name: "repo1" }]
      });

      fetchMock.mockRejectedValueOnce(new Error("Network Error"));

      const res = await testApp.request("/activity", {}, {}, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.repoCount).toBe(1);
      expect(body.totalCommits).toBe(0);
    });

    it("returns cached response if available", async () => {
      vi.stubGlobal("caches", {
        open: vi.fn().mockResolvedValue({
          match: vi.fn().mockResolvedValue({
            json: async () => ({ repoCount: 2, totalCommits: 10, grid: [] })
          }),
          put: vi.fn()
        })
      });

      const res = await testApp.request("/activity", {}, {}, mockExecutionContext);
      expect(res.status).toBe(200);
      const body = await res.json() as any;
      expect(body.repoCount).toBe(2);
      expect(body.totalCommits).toBe(10);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

