import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import postsRouter from "./posts";
import { createMockPost } from "../../../src/test/factories/contentFactory";

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
vi.mock("../../utils/postHistory", () => ({
  createShadowRevision: vi.fn().mockResolvedValue("new-slug"),
  approvePost: vi.fn().mockResolvedValue({ success: true }),
  getPostHistory: vi.fn().mockResolvedValue([]),
  restorePostFromHistory: vi.fn().mockResolvedValue({ success: true }),
}));

describe("Hono Backend - /posts Router", () => {
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null),
        run: vi.fn().mockResolvedValue({ success: true }),
      } as any,
      DEV_BYPASS: "true",
    };
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
    expect(res.status).toBe(200);
  });

  it("DELETE /:slug - soft delete", async () => {
    const req = new Request("http://localhost/test-post", { method: "DELETE" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE posts SET is_deleted = 1 WHERE slug = ? OR id = ?"));
  });

  it("PATCH /:slug/undelete - restore", async () => {
    const req = new Request("http://localhost/test-post/undelete", { method: "PATCH" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE posts SET is_deleted = 0 WHERE slug = ? OR id = ?"));
  });

  it("DELETE /:slug/purge - permanent delete", async () => {
    const req = new Request("http://localhost/test-post/purge", { method: "DELETE" });
    const res = await postsRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM posts WHERE slug = ? OR id = ?"));
  });
});
