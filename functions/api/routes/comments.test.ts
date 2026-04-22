import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "@/test/utils";
import commentsRouter from "./comments";
import { createMockComment } from "@/test/factories/userFactory";

// Mock Zulip and Notifications
vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(() => Promise.resolve(123)),
  updateZulipMessage: vi.fn(() => Promise.resolve()),
  deleteZulipMessage: vi.fn(() => Promise.resolve()),
}));

vi.mock("../../utils/notifications", () => ({
  emitNotification: vi.fn(() => Promise.resolve()),
}));

describe("Hono Backend - /comments Router", () => {
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

  it("should list comments for a target", async () => {
    const mockComments = [
      createMockComment({ id: "1", content: "Great post!" }),
      createMockComment({ id: "2", content: "Nice!" }),
    ];
    env.DB.all.mockResolvedValue({ results: mockComments });

    const req = new Request("http://localhost/blog/my-post", { method: "GET" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.comments).toHaveLength(2);
    expect(body.comments[0].content).toBe("Great post!");
  });

  it("should create a new comment", async () => {
    env.DB.first.mockResolvedValueOnce({ id: 100 }); // RETURNING id
    env.DB.all.mockResolvedValueOnce({ results: [] }); // getSocialConfig -> getDbSettings
    env.DB.first.mockResolvedValueOnce({ cf_email: "author@test.com", title: "Test Post" }); // Notification check
    env.DB.first.mockResolvedValueOnce({ id: "author-123" }); // Author lookup

    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "New comment content" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, undefined, env, executionCtx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO comments"));
  });

  it("should return 400 for empty comment content", async () => {
    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("should edit an existing comment", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "local-dev", user_name: "Local Dev", zulip_message_id: "zulip-1" });
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, undefined, env, executionCtx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE comments SET content = ?"));
  });

  it("should return 403 when editing someone else's comment", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "other-user", user_name: "Other", zulip_message_id: "zulip-1" });

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("should soft-delete a comment", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: "zulip-1" });
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await commentsRouter.request(req, undefined, env, executionCtx);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });
    expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining("UPDATE comments SET is_deleted = 1"));
  });

  it("should return 404 when deleting non-existent comment", async () => {
    env.DB.first.mockResolvedValue(null);

    const req = new Request("http://localhost/999", { method: "DELETE" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(404);
  });
});
