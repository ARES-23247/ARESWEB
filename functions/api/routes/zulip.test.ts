const createMockDb = () => {
  const allFn = vi.fn().mockResolvedValue([]);
  const getFn = vi.fn().mockResolvedValue(null);
  const runFn = vi.fn().mockResolvedValue({ success: true });

  const fns: Record<string, any> = {
    all: allFn,
    get: getFn,
    run: runFn,
    execute: allFn,
    executeTakeFirst: getFn,
    first: getFn
  };

  const chainable: any = new Proxy(fns, {
    get: (target, prop) => {
      if (prop === 'then') {
        return (resolve, reject) => Promise.resolve(fns.all()).then(resolve).catch(reject);
      }
      if (prop === 'catch') {
        return (reject) => Promise.resolve(fns.all()).catch(reject);
      }
      if (prop === 'finally') {
        return (cb) => Promise.resolve(fns.all()).finally(cb);
      }
      if (prop === 'query') {
         return new Proxy({}, {
            get: () => new Proxy({}, {
               get: (tTarget, tProp) => {
                  if (tProp === 'findFirst') return fns.get;
                  if (tProp === 'findMany') return fns.all;
                  return vi.fn().mockReturnValue(chainable);
               }
            })
         });
      }
      if (prop in target) return target[prop];
      if (prop === 'transaction') return vi.fn(async (cb) => cb(chainable));
      if (typeof prop === 'symbol') return chainable;
      target[prop] = vi.fn().mockReturnValue(chainable);
      return target[prop];
    }
  });
  return chainable;
};

const mockDb = createMockDb();

import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import zulipRouter from "./zulip";
import { AppEnv } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

// Define local types for casting since they might be internal to the router/utils
type ZulipConfig = {
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_URL?: string;
};

type ZulipResponse = {
  success: boolean;
  userNames?: Record<string, string>;
  presence?: unknown;
  messages?: unknown[];
  missingEmails?: string[];
  invitedCount?: number;
};

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    getSocialConfig: vi.fn(),
    ensureAuth: async (c: unknown, next: () => Promise<void>) => {
      const context = c as { set: (key: string, value: unknown) => void };
      context.set("sessionUser", { nickname: "TestNick", role: "admin", member_type: "mentor" });
      await next();
    },
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getDb: () => mockDb,
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn(),
}));

describe("Hono Backend - /zulip Router", () => {
  let app: Hono<AppEnv>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set default behavior for sendZulipMessage mock
    vi.mocked(sendZulipMessage).mockResolvedValue(123 as never);

    app = new Hono<AppEnv>();
    app.route("/", zulipRouter);

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("GET /presence - handles missing config", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await app.request("/presence", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(500);
  });

  it("GET /presence - fetches presence and maps user names", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: { "alice@test.com": {} } }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ members: [{ email: "alice@test.com", full_name: "Alice" }] }) });

    const res = await app.request("/presence", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.userNames?.["alice@test.com"]).toBe("Alice");
    expect(body.presence).toHaveProperty("alice@test.com");
  });

  it("GET /presence - handles fetch error", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "Unauthorized" });

    const res = await app.request("/presence", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(500);
  });

  it("POST /message - handles missing config", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await app.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(500);
  });

  it("POST /message - sends message", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true as any);

    const res = await app.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });

    expect(res.status).toBe(200);
    expect(sendZulipMessage).toHaveBeenCalledWith(expect.anything(), "general", "test", "**TestNick** (via ARES Web):\n\nhello", "stream");
  });

  it("POST /message - handles send failure", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    vi.mocked(sendZulipMessage).mockResolvedValueOnce(false as any);

    const res = await app.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });

    expect(res.status).toBe(500);
  });

  it("GET /messages - fetches topic messages", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 1, content: "hi" }] }) });

    const res = await app.request("/topic?stream=general&topic=test", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.messages).toHaveLength(1);

    expect((body.messages as unknown[])[0]).toEqual({ id: 1, content: "hi" });
  });

  it("GET /topic - handles 403 error", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" });

    const res = await app.request("/topic?stream=general&topic=test", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(403);
  });

  it("GET /topic - handles 500 error", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Error" });

    const res = await app.request("/topic?stream=general&topic=test", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(500);
  });

  it("GET /presence - handles users fetch error", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: {} }) })
      .mockResolvedValueOnce({ ok: false });

    const res = await app.request("/presence", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(200);
  });

  it("GET /presence - handles empty users response", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const res = await app.request("/presence", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(200);
  });

  it("GET /invites/audit - handles missing config", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await app.request("/invites/audit", {}, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });
    expect(res.status).toBe(500);
  });

  it("GET /invites/audit - fetches users and returns missing emails", async () => {
    const { getSocialConfig, getDb } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        members: [
          { email: "alice@test.com", is_bot: false, is_active: true },
          { email: "bob@test.com", is_bot: false, is_active: true }
        ]
      })
    }).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ members: [] })
    });

    
    (mockDb.all as ReturnType<typeof vi.fn>).mockResolvedValueOnce([
      { email: "alice@test.com" },
      { email: "charlie@test.com" }
    ]);

    const res = await app.request("/invites/audit", {}, { DB: {} as any }, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.missingEmails).toEqual(["charlie@test.com"]);
  });

  it("POST /invites/send - handles batch sending successfully", async () => {
    const { getSocialConfig } = await import("../middleware");
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ default_streams: [{ stream_id: 1 }] })
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: async () => JSON.stringify({ result: "success" })
    });

    const res = await app.request("/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: ["newuser@test.com"] })
    }, {} as any, {
      waitUntil: vi.fn(),
      passThroughOnException: vi.fn() 
    });

    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.invitedCount).toBe(1);
  });
});
