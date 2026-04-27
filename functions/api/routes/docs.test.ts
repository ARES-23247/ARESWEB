 

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";

const mockUser = { id: "1", email: "admin@test.com", role: "admin" };
let authBypass = true;

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: any, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Forbidden" }, 403);
    },
    ensureAuth: async (c: any, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Unauthorized" }, 401);
    },
    getSessionUser: vi.fn().mockImplementation(() => Promise.resolve(mockUser)),
    checkRateLimit: vi.fn().mockReturnValue(true),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    logAuditAction: vi.fn().mockResolvedValue(true),
    notifyByRole: vi.fn().mockResolvedValue(true),
    emitNotification: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));

import docsRouter from "./docs";

describe("Hono Backend - /docs Router", () => {
  
  
   
  let mockDb: any;
  let testApp: Hono<any>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      distinct: vi.fn().mockReturnThis(),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      onConflict: vi.fn().mockReturnThis(),
      column: vi.fn().mockReturnThis(),
      selectAll: vi.fn().mockReturnThis(),
      doUpdateSet: vi.fn().mockReturnThis(),
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
    testApp.route("/", docsRouter);
  });

  it("GET / - list public docs", async () => {
    mockDb.execute.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General" }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - get single doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test", title: "Test Doc", content: "..." });
    mockDb.execute.mockResolvedValueOnce([]); // contributors
    const res = await testApp.request("/test", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save doc", async () => {
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        slug: "new-doc",
        title: "New Doc",
        category: "Manuals",
        content: "Content here",
        isDraft: false
      }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - block unauthorized user", async () => {
    authBypass = false;
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "fail" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "false" }, mockExecutionContext);

    expect(res.status).toBe(401);
    authBypass = true; // reset for other tests
  });

  it("GET /search - returns matching docs", async () => {
    const res = await testApp.request("/search?q=query", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    // Uses fallback SQL stub which returns { rows: [] } 
    const body = await res.json() as any;
    expect(body.results).toEqual([]);
  });

  it("GET /search - ignores short queries", async () => {
    const res = await testApp.request("/search?q=ab", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.results).toEqual([]);
  });

  it("GET /admin/list - list all docs for admin", async () => {
    mockDb.execute.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: 1, status: "draft" }]);
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:slug - soft deletes a doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test-doc" });
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    if (res.status !== 200) {
      console.error(await res.text());
    }
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores a soft-deleted doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "test", content: "test" });
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    if (res.status !== 200) {
      console.error(await res.text());
    }
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/history - fetches document history", async () => {
    mockDb.execute.mockResolvedValueOnce([
      { id: 1, slug: "test-doc", author_nickname: "Admin", created_at: "2026-01-01T00:00:00Z" }
    ]);
    const res = await testApp.request("/admin/test-doc/history", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/detail - fetches admin detail", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test-doc", title: "Test Doc", content: "..." });
    const res = await testApp.request("/admin/test-doc/detail", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/sort - updates sort order", async () => {
    const res = await testApp.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:slug/feedback - submits feedback", async () => {
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: true, comment: "Great doc!", turnstileToken: "abc" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - rejects doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/undelete - undeletes doc", async () => {
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - purges doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ content: "test" });
    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
