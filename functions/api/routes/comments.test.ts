/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mockExecutionContext } from "../../../src/test/utils";
import commentsRouter from "./comments";
import { createMockComment } from "../../../src/test/factories/userFactory";

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
  let env: any;

  beforeEach(() => {
    vi.clearAllMocks();
    env = {
      DB: {
        prepare: vi.fn().mockReturnThis(),
        bind: vi.fn().mockReturnThis(),
        all: vi.fn().mockResolvedValue({ results: [] }),
        run: vi.fn().mockResolvedValue({ success: true }),
        first: vi.fn().mockResolvedValue(null),
      } as any,
      DEV_BYPASS: "true",
    };
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
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expect.objectContaining({ success: true }));
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
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

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
    const res = await commentsRouter.request(req, {}, { ...env, DEV_BYPASS: "false" }, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("should soft-delete a comment", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: "zulip-1" });
    env.DB.run.mockResolvedValue({ success: true });

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

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
  it("should return 403 for unverified user on POST", async () => {
    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, { ...env, DEV_BYPASS: "unverified" }, mockExecutionContext);

    expect(res.status).toBe(403);
  });

  it("should return 400 for malformed JSON payload on POST", async () => {
    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("should return 500 on POST DB error", async () => {
    env.DB.run.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "test" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("should return 400 for malformed JSON payload on PUT", async () => {
    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: "not json",
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(400);
  });

  it("should return 500 on PUT DB error", async () => {
    env.DB.first.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });

  it("should handle zulip delete error gracefully", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "local-dev", zulip_message_id: "zulip-1" });
    env.DB.run.mockResolvedValue({ success: true });
    const { deleteZulipMessage } = await import("../../utils/zulipSync");
    (deleteZulipMessage as any).mockRejectedValueOnce(new Error("Zulip error"));
    
    // We need mockExecutionContext.waitUntil to actually execute the promise to cover the catch block
    mockExecutionContext.waitUntil.mockImplementationOnce((p: Promise<any>) => p);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    consoleSpy.mockRestore();
  });

  it("should return 500 on DELETE DB error", async () => {
    env.DB.first.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", { method: "DELETE" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    consoleSpy.mockRestore();
  });
  it("should return 500 on GET DB error", async () => {
    env.DB.all.mockRejectedValueOnce(new Error("DB error"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/blog/my-post", { method: "GET" });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ comments: [] });
    consoleSpy.mockRestore();
  });

  it("should handle POST zulip sync error gracefully", async () => {
    env.DB.first.mockResolvedValueOnce({ id: 100 });
    env.DB.all.mockResolvedValueOnce({ results: [] });
    env.DB.first.mockResolvedValueOnce(null); // No author found
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    (sendZulipMessage as any).mockRejectedValueOnce(new Error("Zulip sync error"));
    
    mockExecutionContext.waitUntil.mockImplementationOnce((p: Promise<any>) => p);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/blog/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "New comment content" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    consoleSpy.mockRestore();
  });

  it("should notify author on new post comment", async () => {
    // Provide all properties so it doesn't matter what order `first` is called in
    env.DB.first.mockResolvedValue({ id: "author-123", cf_email: "different@test.com" });
    env.DB.all.mockResolvedValue({ results: [] });

    const { emitNotification } = await import("../../utils/notifications");

    const req = new Request("http://localhost/post/my-post", {
      method: "POST",
      body: JSON.stringify({ content: "New comment content" }),
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.100" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(emitNotification).toHaveBeenCalled();
  });

  it("should handle zulip update error gracefully", async () => {
    env.DB.first.mockResolvedValueOnce({ user_id: "local-dev", user_name: "Local Dev", zulip_message_id: "zulip-1" });
    env.DB.run.mockResolvedValue({ success: true });
    const { updateZulipMessage } = await import("../../utils/zulipSync");
    (updateZulipMessage as any).mockRejectedValueOnce(new Error("Zulip error"));
    
    mockExecutionContext.waitUntil.mockImplementationOnce((p: Promise<any>) => p);
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const req = new Request("http://localhost/1", {
      method: "PUT",
      body: JSON.stringify({ content: "Updated content" }),
      headers: { "Content-Type": "application/json", "cf-connecting-ip": "192.168.1.101" },
    });
    const res = await commentsRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    consoleSpy.mockRestore();
  });
});
