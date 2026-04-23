/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import postsRouter from "./posts";
import { createMockPost } from "../../../src/test/factories/contentFactory";

// Mock global dependencies
vi.stubGlobal("crypto", {
  randomUUID: () => "test-uuid",
  subtle: {
    importKey: vi.fn(),
    sign: vi.fn(),
  }
});

// Mock external utilities
vi.mock("../../utils/socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn().mockResolvedValue(true),
  notifyByRole: vi.fn().mockResolvedValue(true),
}));
vi.mock("../../utils/auth", () => ({
  getAuth: vi.fn().mockReturnValue({
    api: {
      getSession: vi.fn().mockResolvedValue({ user: { id: "1", email: "test@example.com", name: "Test" } })
    }
  })
}));
vi.mock("../../utils/postHistory", () => ({
  createShadowRevision: vi.fn().mockResolvedValue("new-slug"),
  approvePost: vi.fn().mockResolvedValue({ success: true }),
  getPostHistory: vi.fn().mockResolvedValue([]),
  restorePostFromHistory: vi.fn().mockResolvedValue({ success: true }),
}));
vi.mock("../middleware", async () => {
  const actual = await vi.importActual<typeof import("../middleware")>("../middleware");
  return {
    ...actual,
    rateLimitMiddleware: vi.fn().mockImplementation(() => async (c: any, next: any) => await next()),
  };
});

describe("Hono Backend - /posts Router", () => {
  let env: any;

  beforeEach(async () => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
        batch: vi.fn().mockResolvedValue([]),
      } as any,
      DEV_BYPASS: "true",
    };
    const { dispatchSocials } = await import("../../utils/socialSync");
    (dispatchSocials as any).mockReset();
    (dispatchSocials as any).mockResolvedValue({ success: true });
  });

  it("GET / - list published posts", async () => {
    const mockPosts = [createMockPost(), createMockPost()];
    env.DB.all.mockResolvedValue({ results: mockPosts });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toHaveLength(2);
  });

  it("GET /:slug - get single published post", async () => {
    const mockPost = createMockPost({ slug: "test-post" });
    env.DB.first.mockResolvedValue(mockPost);

    const req = new Request("http://localhost/test-post", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.post.slug).toBe("test-post");
  });

  it("GET /list - admin list", async () => {
    const req = new Request("http://localhost/list", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("SELECT slug, title"));
  });

  it("POST /save - create new post", async () => {
    const postData = {
      title: "New Post",
      ast: { type: "doc", content: [] },
      isDraft: false,
    };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    await res.text();
    expect(res.status).toBe(200);
  });

  it("DELETE /:slug - soft delete", async () => {
    const req = new Request("http://localhost/test-post", { method: "DELETE" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE posts SET is_deleted = 1 WHERE slug = ?"));
  });

  it("PATCH /:slug/restore - restore", async () => {
    const req = new Request("http://localhost/test-post/restore", { method: "PATCH" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE posts SET is_deleted = 0, status = 'draft' WHERE slug = ?"));
  });

  it("DELETE /:slug/purge - permanent delete", async () => {
    const req = new Request("http://localhost/test-post/purge", { method: "DELETE" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM posts WHERE slug = ?"));
  });

  it("GET / - list posts without q", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [{ slug: "test" }] });
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET / - search with ?q=", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [{ slug: "test" }] });
    const req = new Request("http://localhost/?q=test", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /export-all - admin export", async () => {
    env.DB.all.mockResolvedValueOnce({ results: [{ slug: "test" }] });
    const req = new Request("http://localhost/export-all", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug/detail - get post details", async () => {
    env.DB.first.mockResolvedValueOnce({ slug: "test" });
    const req = new Request("http://localhost/test/detail", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /:slug/history - get post history", async () => {
    const req = new Request("http://localhost/test/history", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /save - reject missing title", async () => {
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify({ ast: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /:slug - edit existing post", async () => {
    const req = new Request("http://localhost/test", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated", ast: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  // Additional Error & Edge Case Tests
  it("GET /list - handles DB error", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/list", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toEqual([]);
  });

  it("GET /export-all - handles DB error", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/export-all", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET / - search with ?q= handles DB error", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/?q=test", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toEqual([]);
  });

  it("GET / - regular list handles DB error", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.posts).toEqual([]);
  });

  it("GET /:slug/detail - not found", async () => {
    env.DB.first.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/notfound/detail", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:slug/detail - handles DB error", async () => {
    env.DB.first.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/error/detail", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:slug/history - handles getPostHistory error", async () => {
    const { getPostHistory } = await import("../../utils/postHistory");
    (getPostHistory as any).mockRejectedValueOnce(new Error("History error"));
    const req = new Request("http://localhost/test/history", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.history).toEqual([]);
  });

  it("GET /:slug - not found", async () => {
    env.DB.first.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/notfound", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:slug - handles DB error", async () => {
    env.DB.first.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/test", { method: "GET" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /save - reject malformed json", async () => {
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /save - handles complex slug generation and success", async () => {
    const postData = { title: "New POST! @2023", ast: { type: "doc", content: [] }, isDraft: false };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.slug).toBe("new-post-2023");
  });

  it("POST /save - handle slug collision", async () => {
    env.DB.first.mockResolvedValueOnce({ slug: "new-post" }); // Simulate collision
    const postData = { title: "New Post", ast: { type: "doc", content: [] }, isDraft: false };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.slug).toMatch(/new-post-.+/);
  });

  it("POST /save - dispatchSocials error", async () => {
    const { dispatchSocials } = await import("../../utils/socialSync");
    (dispatchSocials as any).mockRejectedValueOnce(new Error("Network Error"));
    
    const postData = { title: "Social Error", ast: {}, isDraft: false };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(207);
    const body = await res.json() as any;
    expect(body.warning).toContain("Social Syndication Failed");
  });

  it("POST /save - Zulip error", async () => {
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    (sendZulipMessage as any).mockRejectedValueOnce(new Error("Zulip Error"));
    
    const postData = { title: "Zulip Error", ast: {}, isDraft: false };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(207);
    const body = await res.json() as any;
    expect(body.warning).toContain("Zulip Notification Failed");
  });

  it("POST /save - pending notification error", async () => {
    const { notifyByRole } = await import("../../utils/notifications");
    (notifyByRole as any).mockRejectedValueOnce(new Error("Notification Error"));
    
    const postData = { title: "Pending Error", ast: {}, isDraft: true };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    // Even if notification fails, it doesn't add to warnings, it just console.errors and returns 200
    expect(res.status).toBe(200);
  });

  it("POST /save - handles DB error", async () => {
    env.DB.batch.mockRejectedValueOnce(new Error("DB error"));
    const postData = { title: "New Post", ast: { type: "doc", content: [] }, isDraft: false };
    const req = new Request("http://localhost/save", {
      method: "POST",
      body: JSON.stringify(postData),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /:slug - edit existing post (student shadow revision)", async () => {
    env.DEV_BYPASS = "false";
    env.DB.first.mockResolvedValueOnce({ member_type: "student" });
    const { createShadowRevision } = await import("../../utils/postHistory");
    (createShadowRevision as any).mockResolvedValueOnce("shadow-slug");
    
    const req = new Request("http://localhost/test", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated", ast: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    env.DEV_BYPASS = "true"; // Reset bypass for subsequent tests
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.slug).toBe("shadow-slug");
  });

  it("PUT /:slug - reject malformed json", async () => {
    const req = new Request("http://localhost/test", {
      method: "PUT",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /:slug - reject missing title", async () => {
    const req = new Request("http://localhost/test", {
      method: "PUT",
      body: JSON.stringify({ ast: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /:slug - handles DB error (admin edit)", async () => {
    env.DB.batch.mockRejectedValueOnce(new Error("DB error"));
    const req = new Request("http://localhost/test", {
      method: "PUT",
      body: JSON.stringify({ title: "Updated", ast: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /:slug/repush - malformed JSON", async () => {
    const req = new Request("http://localhost/test/repush", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /:slug/repush - not found", async () => {
    env.DB.first.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/notfound/repush", {
      method: "POST",
      body: JSON.stringify({ socials: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("POST /:slug/repush - dispatchSocials error", async () => {
    env.DB.first.mockResolvedValueOnce({ title: "T", snippet: "S", thumbnail: "T" });
    const { dispatchSocials } = await import("../../utils/socialSync");
    (dispatchSocials as any).mockRejectedValueOnce(new Error("Network Error"));
    
    const req = new Request("http://localhost/test/repush", {
      method: "POST",
      body: JSON.stringify({ socials: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(502);
  });

  it("POST /:slug/repush - success", async () => {
    env.DB.first.mockResolvedValueOnce({ title: "T", snippet: null, thumbnail: "T" });
    const { dispatchSocials } = await import("../../utils/socialSync");
    (dispatchSocials as any).mockResolvedValueOnce({ success: true });
    const req = new Request("http://localhost/test/repush", {
      method: "POST",
      body: JSON.stringify({ socials: {} }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/history/:id/restore - error", async () => {
    const { restorePostFromHistory } = await import("../../utils/postHistory");
    (restorePostFromHistory as any).mockResolvedValue({ success: false, error: "Not found" });
    
    const req = new Request("http://localhost/test/history/1/restore", { method: "PATCH" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PATCH /:slug/history/:id/restore - success", async () => {
    const { restorePostFromHistory } = await import("../../utils/postHistory");
    (restorePostFromHistory as any).mockResolvedValue({ success: true });
    
    const req = new Request("http://localhost/test/history/1/restore", { 
      method: "PATCH",
      headers: { "CF-Connecting-IP": "test-restore-success" }
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
  });

  it("PATCH /:slug/approve - success", async () => {
    const { approvePost } = await import("../../utils/postHistory");
    (approvePost as any).mockResolvedValue({ success: true, warnings: [] });
    
    const req = new Request("http://localhost/test/approve", { method: "PATCH" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/approve - error", async () => {
    const { approvePost } = await import("../../utils/postHistory");
    (approvePost as any).mockResolvedValue({ success: false, error: "Approve failed" });
    
    const req = new Request("http://localhost/test/approve", { method: "PATCH" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PATCH /:slug/reject - success with reason and notification", async () => {
    env.DB.first.mockResolvedValueOnce({ title: "Test", cf_email: "author@test.com" });
    env.DB.first.mockResolvedValueOnce({ id: "123" });
    
    const req = new Request("http://localhost/test/reject", {
      method: "PATCH",
      body: JSON.stringify({ reason: "Needs work" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("PATCH /:slug/reject - success without reason", async () => {
    env.DB.first.mockResolvedValueOnce({ title: "Test", cf_email: "author@test.com" });
    env.DB.first.mockResolvedValueOnce({ id: "123" });
    
    const req = new Request("http://localhost/test/reject", {
      method: "PATCH",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
