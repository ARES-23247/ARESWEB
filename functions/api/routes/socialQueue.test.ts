import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { socialQueueRouter } from "./socialQueue";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    originIntegrityMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user_123", role: "admin", email: "admin@test.com" }),
    getDb: () => ({
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      offset: vi.fn().mockReturnThis(),
      get: vi.fn().mockResolvedValue({ count: 1, id: "post_1", content: "Test Post", scheduledFor: "2030-01-01", platforms: '{"twitter":true}' }),
      all: vi.fn().mockResolvedValue([{ id: "post_1", content: "Test Post", scheduledFor: "2030-01-01", platforms: '{"twitter":true}', status: "pending" }]),
      insert: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true })
    }),
  };
});

describe("socialQueueRouter", () => {
  let app: Hono<AppEnv>;

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.route("/", socialQueueRouter);
  });

  it("should list posts", async () => {
    const res = await app.request("/?limit=10", {
      method: "GET"
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.posts).toBeDefined();
    expect(data.posts.length).toBe(1);
    expect(data.posts[0].id).toBe("post_1");
  });

  it("should create a post", async () => {
    const res = await app.request("/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "New Post",
        platforms: { twitter: true },
        scheduled_for: "2030-01-01T00:00:00Z",
        linked_type: null,
        linked_id: null,
      })
    }, {
      env: {} as any,
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn()
    });

    expect(res.status).toBe(200);
    const data = await res.json() as any;
    expect(data.success).toBe(true);
    expect(data.post.content).toBe("New Post");
  });
});
