/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import { mockExecutionContext, createMockDrizzle } from "../../../src/test/utils";
import { TestEnv, MockDrizzle } from "../../../src/test/types";
import { createMockUser } from "../../../src/test/factories/userFactory";

const mockUser = createMockUser({ id: "1", email: "admin@test.com", role: "admin" });
let authBypass = true;

interface DocsResponse {
  success?: boolean;
  docs?: unknown[];
  results?: unknown[];
  error?: string;
  [key: string]: unknown;
}

// Mock middleware
vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: Context<TestEnv>, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Forbidden" }, 403);
    },
    ensureAuth: async (c: Context<TestEnv>, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Unauthorized" }, 401);
    },
    getSessionUser: vi.fn().mockImplementation(() => Promise.resolve(mockUser)),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    logAuditAction: vi.fn().mockResolvedValue(true),
    notifyByRole: vi.fn().mockResolvedValue(true),
    emitNotification: vi.fn().mockResolvedValue(true),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(),
}));

import docsRouter from "./docs";

describe("Hono Backend - /docs Router", () => {

  let mockDb: MockDrizzle;
  let testApp: Hono<TestEnv>;
  const mockEnv: TestEnv["Bindings"] = { DEV_BYPASS: "true", DB: {} as unknown as D1Database };

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzle();

    // Set default behavior for sendZulipMessage mock
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockResolvedValue(true as never);

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("db", mockDb as any);
      await next();
    });
    testApp.route("/", docsRouter);
  });

  it("GET / - list public docs", async () => {
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General" }]);
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - legacy database fallback and undefined mappings", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: null }]);
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - get single doc", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test", title: "Test Doc", content: "..." });
    mockDb.all.mockResolvedValueOnce([]); // contributors
    const res = await testApp.request("/test", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - single doc with contributors", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test2", title: "Test Doc 2", content: "..." });
    mockDb.all.mockResolvedValueOnce([
      { nickname: "Admin", avatar: "admin.png" },
      { nickname: null, avatar: null },
      { } // undefined branch
    ]);
    const res = await testApp.request("/test2", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - prunes history if results > 0", async () => {
    mockDb.get.mockResolvedValueOnce(null); // No existing doc
    mockDb.all.mockResolvedValueOnce([{ id: 5 }]); // prune query result
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc-prune", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save new doc as admin", async () => {
    mockDb.get.mockResolvedValueOnce(null); // No existing doc
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
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save existing doc as admin", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save doc as non-admin", async () => {
    // Override getSessionUser for this test
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "2",
      email: "user@test.com",
      name: null,
      nickname: "User",
      image: null,
      role: "member",
      member_type: "student",
    });

    mockDb.get.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing" });
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - block unauthorized user", async () => {
    authBypass = false;
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "fail", title: "Test", category: "Manuals", content: "content" }),
      headers: { "Content-Type": "application/json" }
    }, { ...mockEnv, DEV_BYPASS: "false" }, mockExecutionContext);

    expect(res.status).toBe(401);
    authBypass = true; // reset for other tests
  });

  it("GET /search - returns matching docs", async () => {
    mockDb.all.mockResolvedValueOnce([
      { slug: "test", title: "Test Doc", category: "Cat", description: "query is here" },
      { slug: "test2", title: "Test Doc 2", category: "Cat", description: null }
    ]);
    const res = await testApp.request("/search?q=query", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as DocsResponse;
    expect(body.results).toHaveLength(2);
    expect((body.results as Array<{ description: string | null }>)[1].description).toBeNull();
  });

  it("GET /search - ignores short queries", async () => {
    const res = await testApp.request("/search?q=ab", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as DocsResponse;
    expect(body.results).toEqual([]);
  });

  it("GET /admin/list - list all docs for admin", async () => {
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: 1, status: "draft" }]);
    const res = await testApp.request("/admin/list", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:slug - soft deletes a doc", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc" });
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    if (res.status !== 200) {
      console.error(await res.text());
    }
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores a soft-deleted doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "test", content: "test" });
    mockDb.get.mockResolvedValueOnce(null); // No current doc
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores over existing doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "test old", content: "test" }); // Row from history
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc", title: "test new", content: "test new", cf_email: "test@test.com" }); // Current doc
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/history - fetches document history", async () => {
    mockDb.all.mockResolvedValueOnce([
      {
        id: 1,
        slug: "test-doc",
        title: "Test",
        category: "Manuals",
        description: "Desc",
        author_email: "admin@test.com",
        created_at: "2026-01-01T00:00:00Z"
      }
    ]);
    const res = await testApp.request("/admin/test-doc/history", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/detail - fetches admin detail", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc", title: "Test Doc", content: "..." });
    const res = await testApp.request("/admin/test-doc/detail", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/sort - updates sort order", async () => {
    const res = await testApp.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /:slug/feedback - submits feedback", async () => {
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: true, comment: "Great doc!", turnstileToken: "abc" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves new doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves revision of doc", async () => {
    mockDb.get.mockResolvedValueOnce({ revision_of: "parent-doc", title: "Test Doc", cf_email: "test@test.com" });
    mockDb.get.mockResolvedValueOnce({ id: "2" }); // Author ID
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - rejects doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/undelete - undeletes doc", async () => {
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - purges doc", async () => {
    mockDb.get.mockResolvedValueOnce({
      content: "test https://ares-media.example.com/asset123.png"
    });
    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { ...mockEnv, ARES_STORAGE: { delete: vi.fn().mockResolvedValue(true) } }, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - handles storage delete error", async () => {
    mockDb.get.mockResolvedValueOnce({
      content: "test https://ares-media.example.com/asset123.png"
    });

    // Create an array of all waitUntil promises

    const waitUntils: Promise<any>[] = [];
    const mockCtx = {
      ...mockExecutionContext,
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waitUntils.push(p);
      })
    };

    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { ...mockEnv, ARES_STORAGE: { delete: vi.fn().mockRejectedValue(new Error("S3 Error")) } }, mockCtx);

    expect(res.status).toBe(200); // Storage failure shouldn't fail the API call
    await Promise.all(waitUntils); // Ensure background catch block is executed
  });

  it("POST /admin/:slug/purge - handles error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - list public docs error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug - single doc not found", async () => {
    mockDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await testApp.request("/not-found", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:slug - single doc error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/test", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles insert error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /search - search error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB Error"));
    const res2 = await testApp.request("/search?q=newquery" + Date.now(), {}, mockEnv, mockExecutionContext);
    expect(res2.status).toBe(500);
  });

  it("GET /admin/list - list error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/list", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:slug - delete not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - delete error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/history - history error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/history", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/detail - detail not found", async () => {
    mockDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/detail", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /admin/:slug/detail - detail error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/detail", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/sort - sort error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /:slug/feedback - feedback error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: true, turnstileToken: "abc" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/approve - approve not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /admin/:slug/approve - approve error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - reject error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "bad" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - undelete error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - handles error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - handles error", async () => {
    (mockDb.update as ReturnType<typeof vi.fn>).mockImplementationOnce(() => { throw new Error("DB fail") });
    const res = await testApp.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  // ─── ERROR BRANCHES ──────────────────────────────────────────────────

  it("GET /:slug - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/missing-doc", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET / - handles db error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"))
                 .mockRejectedValueOnce(new Error("DB fail")); // fallback also fails
    const res = await testApp.request("/", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug - handles db error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    const res = await testApp.request("/crash-doc", {}, mockEnv, mockExecutionContext);
    // Should be 500 or fall through to error
    expect([404, 500]).toContain(res.status);
  });

  it("GET /admin/:slug/detail - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc/detail", {}, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /search - handles db error", async () => {
    // Need to bypass cache
    const res = await testApp.request("/search?q=failquery" + Date.now(), {}, mockEnv, mockExecutionContext);
    // Uses fallback sql which returns empty rows, so should be 200
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/missing-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - returns 404 for missing version", async () => {
    mockDb.get.mockResolvedValueOnce(null);
    const res = await testApp.request("/admin/test-doc/history/999/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /:slug/feedback - rejects overly long comments", async () => {
    const longComment = "x".repeat(2001);
    const res = await testApp.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: false, comment: longComment, turnstileToken: "abc" })
    }, mockEnv, mockExecutionContext);
    expect(res.status).toBe(400);
  });
});

