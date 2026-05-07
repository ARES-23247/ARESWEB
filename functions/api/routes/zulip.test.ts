/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono, Context } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import { TestEnv } from "../../../src/test/types";
import zulipRouter from "./zulip";

type MockKysely = any;

interface ZulipConfig {
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_URL?: string;
  [key: string]: unknown;
}

interface ZulipResponse {
  success?: boolean;
  userNames?: Record<string, string>;
  presence?: Record<string, unknown>;
  error?: string;
  [key: string]: unknown;
}

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
 
    ensureAuth: async (c: Context<TestEnv>, next: () => Promise<void>) => {
      c.set("sessionUser", { id: "test-user", email: "test@test.com", name: "Test User", nickname: "TestNick", image: null, role: "admin", member_type: "mentor" });
      return next();
    },
    getSocialConfig: vi.fn(),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn()
}));

import { getSocialConfig } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";


          return Promise.resolve([]).then(resolve, reject);
        };
      }
      if (prop in drizzleMethods) return drizzleMethods[prop as string];
      return target[prop];
    }
  });
  return proxy;
}

describe("Hono Backend - /zulip Router", () => {
  let testApp: Hono<TestEnv>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      if (c.env && (c.env).DB) {
        c.set("db", createDrizzleProxy((c.env).DB as unknown as MockKysely));
      }
      await next();
    });
    testApp.route("/", zulipRouter);

    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("GET /presence - handles missing config", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /presence - fetches presence and maps user names", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: { "alice@test.com": {} } }) }) // /presence
      .mockResolvedValueOnce({ ok: true, json: async () => ({ members: [{ email: "alice@test.com", full_name: "Alice" }] }) }); // /users

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.userNames?.["alice@test.com"]).toBe("Alice");
    expect(body.presence).toHaveProperty("alice@test.com");
  });

  it("GET /presence - handles fetch error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, text: async () => "Unauthorized" });

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /message - handles missing config", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await testApp.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /message - sends message", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true as any);

    const res = await testApp.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(sendZulipMessage).toHaveBeenCalledWith(expect.anything(), "general", "test", "**TestNick** (via ARES Web):\n\nhello", "stream");
  });

  it("POST /message - handles send failure", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    vi.mocked(sendZulipMessage).mockResolvedValueOnce(false as any);

    const res = await testApp.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(500);
  });

  it("GET /messages - fetches topic messages", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 1, content: "hi" }] }) });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.messages).toHaveLength(1);

    expect((body.messages as any[])[0].content).toBe("hi");
  });

  it("GET /topic - handles 403 error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /topic - handles 500 error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Error" });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /presence - handles users fetch error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: {} }) }) // /presence
      .mockResolvedValueOnce({ ok: false }); // /users

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /presence - handles empty users response", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: {} }) }) // /presence
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // /users

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /invites/audit - handles missing config", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({});
    const res = await testApp.request("/invites/audit", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /invites/audit - fetches users and returns missing emails", async () => {
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

    const mockDb: MockKysely = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue([
        { email: "alice@test.com" },
        { email: "charlie@test.com" }
      ]),
      insertInto: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      deleteFrom: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
    };

    const res = await testApp.request("/invites/audit", {}, { DB: mockDb }, mockExecutionContext);
    if (res.status === 500) {
      console.log(await res.text());
    }
    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.missingEmails).toEqual(["charlie@test.com"]);
  });

  it("POST /invites/send - handles batch sending successfully", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as ZulipConfig);

    // Mock streams response
    fetchMock.mockResolvedValueOnce({ 
      ok: true, 
      json: async () => ({ default_streams: [{ stream_id: 1 }] }) 
    });

    // Mock invite batch response
    fetchMock.mockResolvedValueOnce({ 
      ok: true, 
      text: async () => JSON.stringify({ result: "success" }) 
    });

    const res = await testApp.request("/invites/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emails: ["newuser@test.com"] })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as ZulipResponse;
    expect(body.success).toBe(true);
    expect(body.invitedCount).toBe(1);
  });
});

