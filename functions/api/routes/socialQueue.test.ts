import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { socialQueueRouter } from "./socialQueue";
import { AppEnv } from "../middleware";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
    let chainable: any;
  const resetDbMock = () => {
    const fns = {
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      first: vi.fn().mockResolvedValue(null)
    };
    const methods = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'];
    const orig = {} as any;
    for (const m of methods) {
      orig[m] = {
        all: fns.all[m as keyof typeof fns.all].bind(fns.all),
        get: fns.get[m as keyof typeof fns.get].bind(fns.get),
        run: fns.run[m as keyof typeof fns.run].bind(fns.run),
        execute: fns.execute[m as keyof typeof fns.execute].bind(fns.execute),
        executeTakeFirst: fns.executeTakeFirst[m as keyof typeof fns.executeTakeFirst].bind(fns.executeTakeFirst),
        first: fns.first[m as keyof typeof fns.first].bind(fns.first)
      };
    }
    const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
    for (const key of terminalsList) {
      for (const m of methods) {
        (fns as any)[key][m] = (...args: any[]) => {
          const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'];
          for (const k of terminals) {
            if (orig[m][k]) orig[m][k](...args);
          }
          return (fns as any)[key];
        };
      }
    }
    chainable = new Proxy(fns, {
      get: (target: any, prop: string | symbol) => {
        if (prop === 'then') return undefined;
        if (prop in target) return target[prop];
        if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
        target[prop] = vi.fn().mockReturnValue(chainable);
        return target[prop];
      }
    });
  };
  resetDbMock();

  return {
    ...actual,
    ensureAuth: async (_c: unknown, next: () => Promise<void>) => next(),
    originIntegrityMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
    getSessionUser: vi.fn().mockResolvedValue({ id: "user_123", role: "admin", email: "admin@test.com" }),
    getDb: () => chainable,
    resetDbMock
  };
});

describe("socialQueueRouter", () => {
  let app: Hono<AppEnv>;

  beforeEach(async () => {
    const middleware = await import("../middleware");
    (middleware as any).resetDbMock();

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

    if (res.status !== 200) console.log("ERROR OUTPUT:", await res.text());
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
