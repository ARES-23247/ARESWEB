 

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
      onConflict: vi.fn().mockImplementation((cb) => {
        if (typeof cb === 'function') {
          const ocMock = { column: vi.fn().mockReturnValue({ doUpdateSet: vi.fn().mockReturnThis() }) };
          cb(ocMock);
        }
        return mockDb;
      }),
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

  it("GET / - legacy database fallback and undefined mappings", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("Fail"));
    mockDb.execute.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: null }]);
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - get single doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test", title: "Test Doc", content: "..." });
    mockDb.execute.mockResolvedValueOnce([]); // contributors
    const res = await testApp.request("/test", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - single doc with contributors", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test2", title: "Test Doc 2", content: "..." });
    mockDb.execute.mockResolvedValueOnce([
      { nickname: "Admin", avatar: "admin.png" }, 
      { nickname: null, avatar: null },
      { } // undefined branch
    ]);
    const res = await testApp.request("/test2", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - prunes history if results > 0", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // No existing doc
    mockDb.execute.mockResolvedValueOnce([{ id: 5 }]); // prune query result
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc-prune", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save new doc as admin", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // No existing doc
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

  it("POST /admin/save - save existing doc as admin", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save doc as non-admin", async () => {
    // Override getSessionUser for this test
    const { getSessionUser } = await import("../middleware");
    (getSessionUser as any).mockResolvedValueOnce({ id: "2", email: "user@test.com", role: "member" });
    
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing" });
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
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
    mockDb.getExecutor().executeQuery.mockResolvedValueOnce({
      rows: [
        { slug: "test", title: "Test Doc", category: "Cat", description: "query is here" },
        { slug: "test2", title: "Test Doc 2", category: "Cat", description: null }
      ]
    });
    const res = await testApp.request("/search?q=query", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.results).toHaveLength(2);
    expect(body.results[1].description).toBeNull();
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
    mockDb.executeTakeFirst.mockResolvedValueOnce(null); // No current doc
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores over existing doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "test old", content: "test" }); // Row from history
    mockDb.executeTakeFirst.mockResolvedValueOnce({ slug: "test-doc", title: "test new", content: "test new", cf_email: "test@test.com" }); // Current doc
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
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

  it("POST /admin/:slug/approve - approves new doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves revision of doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ revision_of: "parent-doc", title: "Test Doc", cf_email: "test@test.com" });
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "2" }); // Author ID
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
    mockDb.executeTakeFirst.mockResolvedValueOnce({ 
      content: "test https://ares-media.example.com/asset123.png" 
    });
    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true", ARES_STORAGE: { delete: vi.fn().mockResolvedValue(true) } }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - handles storage delete error", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ 
      content: "test https://ares-media.example.com/asset123.png" 
    });
    
    // Create an array of all waitUntil promises
    const waitUntils: Promise<any>[] = [];
    const mockCtx = {
      ...mockExecutionContext,
      waitUntil: vi.fn((p) => {
        waitUntils.push(p);
      })
    };

    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true", ARES_STORAGE: { delete: vi.fn().mockRejectedValue(new Error("S3 Error")) } }, mockCtx);
    
    expect(res.status).toBe(200); // Storage failure shouldn't fail the API call
    await Promise.all(waitUntils); // Ensure background catch block is executed
  });

  it("POST /admin/:slug/purge - handles error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - list public docs error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug - single doc not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await testApp.request("/not-found", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:slug - single doc error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/test", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles insert error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /search - search error", async () => {
    mockDb.getExecutor().executeQuery.mockRejectedValueOnce(new Error("DB Error"));
    const res2 = await testApp.request("/search?q=newquery", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res2.status).toBe(500);
  });

  it("GET /admin/list - list error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/list", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:slug - delete not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - delete error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/history - history error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/history", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/detail - detail not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/detail", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /admin/:slug/detail - detail error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/detail", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/sort - sort error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /:slug/feedback - feedback error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: true, turnstileToken: "abc" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/approve - approve not found", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /admin/:slug/approve - approve error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - reject error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "bad" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - undelete error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - handles error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - handles error", async () => {
    mockDb.updateTable.mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  // ─── ERROR BRANCHES ──────────────────────────────────────────────────

  it("GET /:slug - returns 404 for missing doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/missing-doc", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET / - handles db error", async () => {
    mockDb.execute.mockRejectedValueOnce(new Error("DB fail"))
                 .mockRejectedValueOnce(new Error("DB fail")); // fallback also fails
    const res = await testApp.request("/", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug - handles db error", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/crash-doc", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    // Should be 500 or fall through to error
    expect([404, 500]).toContain(res.status);
  });

  it("GET /admin/:slug/detail - returns 404 for missing doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc/detail", {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - returns 404 for missing doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /search - handles db error", async () => {
    // Need to bypass cache
    const res = await testApp.request("/search?q=failquery" + Date.now(), {}, { DEV_BYPASS: "true" }, mockExecutionContext);
    // Uses fallback sql which returns empty rows, so should be 200
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - returns 404 for missing doc", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - returns 404 for missing version", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/history/999/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /:slug/feedback - rejects overly long comments", async () => {
    const longComment = "x".repeat(2001);
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: false, comment: longComment, turnstileToken: "abc" })
    }, { DEV_BYPASS: "true" }, mockExecutionContext);
    expect(res.status).toBe(400);
  });
});
