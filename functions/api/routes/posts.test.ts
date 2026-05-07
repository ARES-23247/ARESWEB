import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import postsRouter from "./posts";
import { AppEnv } from "../middleware";

const mockExecutionContext = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise),
  passThroughOnException: vi.fn(),
  props: {},
};

// Mock utilities used by posts router
vi.mock("../middleware/cache", () => ({
  edgeCacheMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock("../../utils/postHistory", () => ({
  getPostHistory: vi.fn().mockResolvedValue([]),
  approvePost: vi.fn().mockResolvedValue({ success: true, warnings: [] }),
  restorePostFromHistory: vi.fn().mockResolvedValue({ success: true }),
  pruneHistory: vi.fn().mockResolvedValue(undefined),
  captureHistory: vi.fn().mockResolvedValue(undefined),
  createShadowRevision: vi.fn().mockResolvedValue("new-slug"),
}));

vi.mock("../../utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(null),
}));

vi.mock("../../utils/notifications", () => ({
  notifyByRole: vi.fn().mockResolvedValue(undefined),
  emitNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({
      id: "1",
      email: "admin@test.com",
      name: null,
      role: "admin",
      member_type: "student"
    }),
  };
});

function createMockDb() {
  return {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    run: vi.fn().mockResolvedValue({ success: true }),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  };
}

function createMockPost(overrides: Record<string, unknown> = {}) {
  return {
    slug: "test-post-" + Math.random().toString(36).substring(7),
    title: "Test Post",
    author: "admin@test.com",
    thumbnail: null,
    snippet: "Test snippet",
    ast: '{"type":"doc","content":[]}',
    status: "published",
    publishedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isDeleted: 0,
    season_id: null,
    cf_email: "admin@test.com",
    ...overrides,
  };
}

describe("Hono Backend - /posts Router", () => {
  let app: Hono<AppEnv>;
  let mockDb: ReturnType<typeof createMockDb>;
  let env: { DB: D1Database; ENVIRONMENT: string; DEV_BYPASS: string };

  beforeEach(() => {
    mockDb = createMockDb();
    env = {
      DB: {} as D1Database,
      ENVIRONMENT: "test",
      DEV_BYPASS: "true"
    };
    vi.clearAllMocks();

    app = new Hono<AppEnv>();
    app.use("*", async (c, next) => {
      c.set("db", mockDb as any);
      c.set("sessionUser", { id: "1", email: "admin@test.com", name: null, nickname: "Admin", image: null, role: "admin", member_type: "student" });
      await next();
    });
    app.route("/", postsRouter);
  });

  it("GET / - list published posts", async () => {
    mockDb.all.mockResolvedValueOnce([createMockPost(), createMockPost()]);

    const res = await app.request("/", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toHaveLength(2);
  });

  it("GET /:slug - get single published post", async () => {
    mockDb.get.mockResolvedValueOnce(createMockPost({ slug: "test-post" }));

    const res = await app.request("/test-post", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.post).toBeDefined();
    expect((body.post as { slug: string }).slug).toBe("test-post");
  });

  it("GET /:slug - handles database error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB Fail"));

    const res = await app.request("/test-post", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/list - admin list", async () => {
    mockDb.all.mockResolvedValueOnce([{ slug: "test", title: "Test", is_deleted: 1, season_id: "3" }]);

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts[0].season_id).toBe(3);
  });

  it("GET /admin/list - handles db error from fallback", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Fail twice"));
    mockDb.all.mockRejectedValueOnce(new Error("Fallback also fails"));

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/save - create new post", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "New Post",
        ast: { type: "doc", content: [] },
        isDraft: false,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:slug - soft delete", async () => {
    const res = await app.request("/admin/test-post", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/undelete - restore", async () => {
    const res = await app.request("/admin/test-post/undelete", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("DELETE /admin/:slug/purge - permanent delete with storage", async () => {
    mockDb.get.mockResolvedValueOnce({ thumbnail: "https://r2.aresfirst.org/test.png" });

    const storageEnv = { ...env, ARES_STORAGE: { delete: vi.fn().mockResolvedValue(true) } } as any;
    const res = await app.request("/admin/test-post/purge", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, storageEnv, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("GET /admin/:slug - get post details", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "test", title: "Test Post", season_id: "5", is_deleted: 1, ast: "{\"type\":\"doc\"}" });

    const res = await app.request("/admin/test", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.post.season_id).toBe(5);
  });

  it("GET /admin/:slug - handles db error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-post", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/:slug/history - get post history", async () => {
    const { getPostHistory } = await import("../../utils/postHistory");
    vi.mocked(getPostHistory).mockResolvedValueOnce([{
      id: 1,
      slug: "old-post",
      title: "Old Post",
      author: "admin@test.com",
      thumbnail: null,
      snippet: "Old snippet",
      ast: "{\"type\":\"doc\"}",
      created_at: "2024-01-01T00:00:00Z",
    } as any]);

    const res = await app.request("/admin/test/history", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/approve - success", async () => {
    const res = await app.request("/admin/test/approve", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - success with author notification", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test", cf_email: "author@test.com" });
    mockDb.get.mockResolvedValueOnce({ id: "123" });

    const res = await app.request("/admin/test/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Needs work" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/reject - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB Fail"));

    const res = await app.request("/admin/test/reject", {
      method: "POST",
      body: JSON.stringify({ reason: "Needs work" }),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET / - search published posts", async () => {
    mockDb.all.mockResolvedValueOnce([createMockPost()]);

    const res = await app.request("/?q=test", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - search error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/?q=fail", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:slug/purge - handles db error", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/admin/test-post/purge", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/approve - handles internal error", async () => {
    const { approvePost } = await import("../../utils/postHistory");
    vi.mocked(approvePost).mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/admin/test/approve", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug - update post", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Old" }); // for history capture

    const res = await app.request("/admin/test-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", ast: { type: "doc", content: [] } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug - handles update error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Update fail"));

    const res = await app.request("/admin/test-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", ast: { type: "doc", content: [] } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/history/:id/restore - restore history", async () => {
    const res = await app.request("/admin/test-post/history/1/restore", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}"
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/repush - repush socials error", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Test" });
    const { dispatchSocials } = await import("../../utils/socialSync");
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Social failed"));

    const res = await app.request("/admin/test-post/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/:slug/repush - repush socials catch block", async () => {
    mockDb.get.mockRejectedValueOnce(new Error("Fatal"));

    const res = await app.request("/admin/test-post/repush", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ socials: ["zulip"] })
    }, env, mockExecutionContext);

    expect(res.status).toBe(502);
  });

  it("GET /admin/:slug - returns 404 if post not found", async () => {
    mockDb.get.mockResolvedValueOnce(null);

    const res = await app.request("/admin/not-found", {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /admin/save - returns 409 on duplicate title today", async () => {
    mockDb.get.mockResolvedValueOnce({ slug: "duplicate" });

    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Duplicate Title", ast: { type: "doc" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(409);
  });

  it("POST /admin/save - generates suffix for duplicate slug", async () => {
    mockDb.get.mockResolvedValueOnce(null); // no recent post today for this user
    mockDb.get.mockResolvedValueOnce({ slug: "existing" }); // but slug already exists globally

    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Duplicate Slug", ast: { type: "doc" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles upsert if slug is provided", async () => {
    mockDb.get.mockResolvedValueOnce({ title: "Old" }); // for history capture

    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: "existing-slug", title: "Updated", ast: { type: "doc", content: [] } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles save error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("Save fail"));

    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "New Fail", ast: { type: "doc", content: [] } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("POST /admin/save - handles social dispatch failure gracefully", async () => {
    const { dispatchSocials } = await import("../../utils/socialSync");
    vi.mocked(dispatchSocials).mockRejectedValueOnce(new Error("Fail"));

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "New Post Social Fail",
        ast: { type: "doc", content: [] },
        isDraft: false,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - returns 400 on long title", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "A".repeat(600), ast: { type: "doc" } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("POST /admin/:slug - non-admin creates shadow revision", async () => {
    const { getSessionUser } = await import("../middleware");
    vi.mocked(getSessionUser).mockResolvedValueOnce({
      id: "2",
      email: "author@test.com",
      role: "author"
    } as any);

    const res = await app.request("/admin/test-post", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Updated", ast: { type: "doc", content: [] } })
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.slug).toBe("new-slug");
  });

  it("GET /admin/list - admin list fallback when schema is old", async () => {
    mockDb.all.mockRejectedValueOnce(new Error("Column not found"));
    mockDb.all.mockResolvedValueOnce([{ slug: "fallback-post", title: "Fallback Post", is_deleted: 0 }]); // fallback query

    const res = await app.request("/admin/list", {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts[0].slug).toBe("fallback-post");
  });

  it("GET /admin/:slug/history - handles error", async () => {
    const { getPostHistory } = await import("../../utils/postHistory");
    vi.mocked(getPostHistory).mockRejectedValueOnce(new Error("History fail"));

    const res = await app.request("/admin/test/history", {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /admin/:slug/undelete - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-post/undelete", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("DELETE /admin/:slug/purge - handles invalid thumbnail URL gracefully", async () => {
    mockDb.get.mockResolvedValueOnce({ thumbnail: "not-a-valid-url" });

    const storageEnv = { ...env, ARES_STORAGE: { delete: vi.fn().mockResolvedValue(true) } } as any;
    const res = await app.request("/admin/test-post/purge", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, storageEnv, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - creates draft post (pending status)", async () => {
    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Draft Post",
        ast: { type: "doc", content: [] },
        isDraft: true,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("POST /admin/save - handles notifyByRole failure gracefully", async () => {
    const { notifyByRole } = await import("../../utils/notifications");
    vi.mocked(notifyByRole).mockRejectedValueOnce(new Error("Notify fail"));

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Draft Post Error",
        ast: { type: "doc", content: [] },
        isDraft: true,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });

  it("POST /admin/save - handles synchronous error in Zulip prepare", async () => {
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockImplementationOnce(() => { throw new Error("Sync Fail"); });

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Sync Fail Post",
        ast: { type: "doc", content: [] },
        isDraft: false,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });

  it("POST /admin/save - handles async error in Zulip prepare", async () => {
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Async Fail"));

    const res = await app.request("/admin/save", {
      method: "POST",
      body: JSON.stringify({
        title: "Async Fail Post",
        ast: { type: "doc", content: [] },
        isDraft: false,
      }),
      headers: { "Content-Type": "application/json" },
    }, env, mockExecutionContext);

    expect(res.status).toBe(200);

    // Wait for waitUntil promises
    const waitUntils = mockExecutionContext.waitUntil.mock.calls.map((call: any) => call[0]);
    await Promise.all(waitUntils.map((p: Promise<unknown>) => p.catch(() => {})));
  });

  it("DELETE /admin/:slug - handles db error", async () => {
    mockDb.run.mockRejectedValueOnce(new Error("DB fail"));

    const res = await app.request("/admin/test-post", {
      method: "DELETE",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    }, env, mockExecutionContext);

    expect(res.status).toBe(500);
  });
});
