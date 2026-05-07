import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Context } from "hono";
import docsRouter from "./docs";
import { AppEnv } from "../middleware";

const mockExecutionContext = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
  passThroughOnException: vi.fn(),
  props: {},
};

let authBypass = true;

// Mock utilities
vi.mock("./ai/autoReindex", () => ({
  triggerBackgroundReindex: vi.fn(),
}));

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(null),
}));

vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (c: Context<AppEnv>, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Forbidden" }, 403);
    },
    ensureAuth: async (c: Context<AppEnv>, next: () => Promise<void>) => {
      if (authBypass) return next();
      return c.json({ error: "Unauthorized" }, 401);
    },
    getSessionUser: vi.fn().mockResolvedValue({
      id: "1",
      email: "admin@test.com",
      name: null,
      nickname: "Admin",
      image: null,
      role: "admin",
      member_type: "student"
    }),
    verifyTurnstile: vi.fn().mockResolvedValue(true),
    logAuditAction: vi.fn().mockResolvedValue(true),
    notifyByRole: vi.fn().mockResolvedValue(true),
    emitNotification: vi.fn().mockResolvedValue(true),
  };
});

function createMockDb() {
  const allMock = vi.fn().mockResolvedValue([]);
  const runMock = vi.fn().mockResolvedValue({ success: true });
  const getMock = vi.fn().mockResolvedValue(null);

  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    all: allMock,
    get: getMock,
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: runMock,
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

interface DocsResponse {
  success?: boolean;
  docs?: unknown[];
  results?: unknown[];
  error?: string;
  [key: string]: unknown;
}

describe("Hono Backend - /docs Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  let env: { DEV_BYPASS: string; DB: D1Database };

  beforeEach(() => {
    mockDb = createMockDb();
    env = {
      DEV_BYPASS: "true",
      DB: {} as unknown as D1Database
    };
    vi.clearAllMocks();
    authBypass = true;

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      await next();
    });
    app.route("/", docsRouter);
  });

  it("GET / - list public docs", async () => {
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General" }]);

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - legacy database fallback and undefined mappings", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail"));
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: null }]);

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - get single doc", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test", title: "Test Doc", content: "..." });
    mockDb.all.mockResolvedValueOnce([]); // contributors

    const res = await app.request("/test", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug - single doc with contributors", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test2", title: "Test Doc 2", content: "..." });
    mockDb.all.mockResolvedValueOnce([
      { nickname: "Admin", avatar: "admin.png" },
      { nickname: null, avatar: null },
      {} // undefined branch
    ]);

    const res = await app.request("/test2", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/save - prunes history if results > 0", async () => {
    mockDb.get.mockResolvedValueOnce(null); // No existing doc
    mockDb.all.mockResolvedValueOnce([{ id: 5 }]); // prune query result

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc-prune", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save new doc as admin", async () => {
    mockDb.get.mockResolvedValueOnce(null); // No existing doc

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        slug: "new-doc",
        title: "New Doc",
        category: "Manuals",
        content: "Content here",
        isDraft: false
      }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save existing doc as admin", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing", cf_email: "test@test.com" });

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - save doc as non-admin", async () => {
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "2",
      email: "user@test.com",
      name: null,
      nickname: "User",
      image: null,
      role: "member",
      member_type: "student",
    } as any);

    mockDb.get.mockResolvedValueOnce({ slug: "existing-doc", title: "Existing" });

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "existing-doc", title: "Updated", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - block unauthorized user", async () => {
    authBypass = false;

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "fail", title: "Test", category: "Manuals", content: "content" }),
      headers: { "Content-Type": "application/json" }
    }, { ...env, DEV_BYPASS: "false" }, mockExecutionContext);

    expect(res.status).toBe(401);
    authBypass = true; // reset for other tests
  });

  it("GET /search - returns matching docs", async () => {
    mockDb.run.mockResolvedValueOnce({
      rows: [
        { slug: "test", title: "Test Doc", category: "Cat", description: "query is here" },
        { slug: "test2", title: "Test Doc 2", category: "Cat", description: null }
      ]
    });

    const res = await app.request("/search?q=query", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as DocsResponse;
    expect(body.results).toHaveLength(2);
    expect((body.results as Array<{ description: string | null }>)[1].description).toBeNull();
  });

  it("GET /search - ignores short queries", async () => {
    const res = await app.request("/search?q=ab", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as DocsResponse;
    expect(body.results).toEqual([]);
  });

  it("GET /admin/list - list all docs for admin", async () => {
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test Doc", category: "General", sort_order: 1, status: "draft" }]);

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:slug - soft deletes a doc", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc" });

    const res = await app.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores a soft-deleted doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "test", content: "test" });
    mockDb.get.mockResolvedValueOnce(null); // No current doc

    const res = await app.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/history/:id/restore - restores over existing doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "test old", content: "test" }); // Row from history
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc", title: "test new", content: "test new", cf_email: "test@test.com" }); // Current doc

    const res = await app.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

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

    const res = await app.request("/admin/test-doc/history", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug/detail - fetches admin detail", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test-doc", title: "Test Doc", content: "..." });

    const res = await app.request("/admin/test-doc/detail", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /admin/:slug/sort - updates sort order", async () => {
    const res = await app.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /:slug/feedback - submits feedback", async () => {
    const res = await app.request("/test-doc/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isHelpful: true, comment: "Great doc!", turnstileToken: "abc" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves new doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });

    const res = await app.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - approves revision of doc", async () => {
    mockDb.get.mockResolvedValueOnce({ revision_of: "parent-doc", title: "Test Doc", cf_email: "test@test.com" });
    mockDb.get.mockResolvedValueOnce({ id: "2" }); // Author ID

    const res = await app.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - rejects doc", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test Doc", cf_email: "test@test.com" });

    const res = await app.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/undelete - undeletes doc", async () => {
    const res = await app.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - purges doc", async () => {
    mockDb.get.mockResolvedValueOnce({
      content: "test https://ares-media.example.com/asset123.png"
    });

    const res = await app.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { ...env, ARES_STORAGE: { delete: vi.fn().mockResolvedValue(true) } } as any, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/purge - handles storage delete error", async () => {
    mockDb.get.mockResolvedValueOnce({
      content: "test https://ares-media.example.com/asset123.png"
    });

    const waitUntils: Promise<unknown>[] = [];
    const mockCtx = {
      ...mockExecutionContext,
      waitUntil: vi.fn((p: Promise<unknown>) => {
        waitUntils.push(p);
      })
    };

    const res = await app.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, { ...env, ARES_STORAGE: { delete: vi.fn().mockRejectedValue(new Error("S3 Error")) } } as any, mockCtx);

    expect(res.status).toBe(200); // Storage failure shouldn't fail the API call
    await Promise.all(waitUntils); // Ensure background catch block is executed
  });

  it("POST /admin/:slug/purge - handles error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/purge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET / - list public docs error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"));
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug - single doc not found", async () => {
    mockDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const res = await app.request("/not-found", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:slug - single doc error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/test", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles insert error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({ slug: "new-doc", title: "New Doc", category: "Manuals", content: "Content here" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /search - search error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB Error"));

    const res2 = await app.request("/search?q=newquery" + Date.now(), {}, env, mockExecutionContext);
    expect(res2.status).toBe(500);
  });

  it("GET /admin/list - list error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:slug - delete not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - delete error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - restore error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/history/1/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/history - history error", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/history", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/detail - detail not found", async () => {
    mockDb.get.mockResolvedValueOnce(null).mockResolvedValueOnce(null);

    const res = await app.request("/admin/test-doc/detail", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /admin/:slug/detail - detail error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail")).mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/detail", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /admin/:slug/sort - sort error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/sort", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sortOrder: 5 })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/approve - approve not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("POST /admin/:slug/approve - approve error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - reject error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "bad" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - undelete error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/reject - handles error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-doc/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "Needs work" })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - handles error", async () => {
    mockDb.update.mockImplementationOnce(() => { throw new Error("DB fail") });

    const res = await app.request("/admin/test-doc/undelete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /:slug - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/missing-doc", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /admin/:slug/detail - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/missing-doc/detail", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("DELETE /admin/:slug - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/missing-doc", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("GET /search - handles db error", async () => {
    mockDb.run.mockResolvedValue({
      rows: []
    });

    const res = await app.request("/search?q=failquery" + Date.now(), {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - returns 404 for missing doc", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/missing-doc/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });

  it("PATCH /admin/:slug/history/:id/restore - returns 404 for missing version", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/test-doc/history/999/restore", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    }, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });
});
