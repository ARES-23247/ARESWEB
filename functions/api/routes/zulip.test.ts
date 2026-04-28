import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import { mockExecutionContext } from "../../../src/test/utils";
import zulipRouter from "./zulip";

vi.mock("../middleware", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../middleware")>();
  return {
    ...actual,
    ensureAdmin: async (_c: unknown, next: () => Promise<void>) => next(),
    getSocialConfig: vi.fn(),
  };
});

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn()
}));

import { getSocialConfig } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";

describe("Hono Backend - /zulip Router", () => {
  let testApp: Hono<any>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("executionCtx", mockExecutionContext);
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
    } as any);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: { "alice@test.com": {} } }) }) // /presence
      .mockResolvedValueOnce({ ok: true, json: async () => ({ members: [{ email: "alice@test.com", full_name: "Alice" }] }) }); // /users

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.userNames["alice@test.com"]).toBe("Alice");
    expect(body.presence).toHaveProperty("alice@test.com");
  });

  it("GET /presence - handles fetch error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as any);

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
    } as any);

    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true as any);

    const res = await testApp.request("/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stream: "general", topic: "test", content: "hello" })
    }, {}, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(sendZulipMessage).toHaveBeenCalledWith(expect.anything(), "general", "test", "hello", "stream");
  });

  it("POST /message - handles send failure", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as any);

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
    } as any);

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ id: 1, content: "hi" }] }) });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.messages).toHaveLength(1);
    expect(body.messages[0].content).toBe("hi");
  });

  it("GET /topic - handles 403 error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as any);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 403, text: async () => "Forbidden" });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(403);
  });

  it("GET /topic - handles 500 error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as any);

    fetchMock.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Internal Error" });

    const res = await testApp.request("/topic?stream=general&topic=test", {}, {}, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /presence - handles users fetch error", async () => {
    vi.mocked(getSocialConfig).mockResolvedValueOnce({
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "key123",
      ZULIP_URL: "https://test.zulip.com"
    } as any);

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
    } as any);

    fetchMock
      .mockResolvedValueOnce({ ok: true, json: async () => ({ result: "success", presences: {} }) }) // /presence
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }); // /users

    const res = await testApp.request("/presence", {}, {}, mockExecutionContext);
    expect(res.status).toBe(200);
  });
});
