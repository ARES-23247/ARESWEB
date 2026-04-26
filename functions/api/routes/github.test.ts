declare const global: typeof globalThis;
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
});
