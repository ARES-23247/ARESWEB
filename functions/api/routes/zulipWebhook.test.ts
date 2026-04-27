import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import zulipWebhookRouter from "./zulipWebhook";
import { mockExecutionContext } from "../../../src/test/utils";

vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(1),
}));

vi.mock("../middleware/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../middleware/utils")>();
  return {
    ...mod,
    getSocialConfig: vi.fn().mockImplementation(async (c: any) => ({
      ZULIP_WEBHOOK_TOKEN: c.env.ZULIP_WEBHOOK_TOKEN,
      ZULIP_BOT_EMAIL: c.env.ZULIP_BOT_EMAIL,
      ZULIP_API_KEY: c.env.ZULIP_API_KEY,
    })),
  };
});

describe("Zulip Webhook Router", () => {
  const env = {
    ZULIP_WEBHOOK_TOKEN: "test-token",
    ZULIP_BOT_EMAIL: "test@test.com",
    ZULIP_API_KEY: "test-key",
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    },
  };

  let testApp: Hono<any>;
  let mockDb: any;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      execute: vi.fn().mockResolvedValue([]),
      insertInto: vi.fn().mockReturnThis(),
      values: vi.fn().mockReturnThis(),
      updateTable: vi.fn().mockReturnThis(),
      set: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      leftJoin: vi.fn().mockReturnThis(),
    };

    testApp = new Hono<any>();
    testApp.use("*", async (c: any, next: any) => {
      c.set("db", mockDb);
      await next();
    });
    testApp.route("/", zulipWebhookRouter);
  });

  it("should reject requests with invalid token", async () => {
    const payload = JSON.stringify({ token: "wrong", message: { content: "test" } });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
    });

    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should handle empty bot mentions with help message", async () => {
    const payload = JSON.stringify({ 
      token: "test-token", 
      message: { content: "@**ARES Bot** " } 
    });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
    });

    const res = await zulipWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Hello! I am the ARES Bot");
  });

  it("should parse quoted arguments for !broadcast", async () => {
    const payload = JSON.stringify({ 
      token: "test-token", 
      message: { 
        content: '@**ARES Bot** !broadcast "Stream with Spaces" Hello world',
        sender_full_name: "Test User"
      } 
    });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
    });

    const res = await zulipWebhookRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("dispatched to `Stream with Spaces`.");
  });
  it("should handle !help", async () => {
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !help' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARES Bot Commands");
  });

  it("should handle !tasks when empty", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([]);
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !tasks' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("No open tasks");
  });

  it("should handle !task create", async () => {
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !task New task here' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Created task: **New task here**");
  });

  it("should handle !task completion", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([{ id: "123", title: "Test Task" }]); // openTasks
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !task 1 done' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("marked as Done!");
  });

  it("should handle !stats", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ count: 5 });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !stats' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARESWEB Quick Stats");
  });

  it("should handle !inquiries", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ count: 2 });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !inquiries' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("2 pending inquiries");
  });

  it("should handle !rcv create", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = JSON.stringify({ token: "test-token", message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create "Best Robot" "Option 1" "Option 2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Created");
  });

  it("should handle !rcv create with missing title", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = JSON.stringify({ token: "test-token", message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Usage: `!rcv create");
  });

  it("should handle !rcv status", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !rcv status 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("📊 **Poll: Best Robot**");
  });

  it("should handle !rcv vote", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !rcv vote 12345 1 2', sender_email: "test@test.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Your vote for `12345` has been recorded!");
  });

  it("should handle !rcv vote closed", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: false, options: ["A", "B"], votes: {} })
    });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !rcv vote 12345 1 2', sender_email: "test@test.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("This poll is closed");
  });

  it("should handle !rcv tally", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({
        value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: { "test@test.com": [0, 1] } })
      })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !rcv tally 12345', sender_email: "a@a.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    // Depending on what tally does, we just expect it to not fail
    expect(json.content).toContain("Poll Closed");
  });

  it("should handle sync comments from verified user", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", role: "member" });
    const payload = JSON.stringify({ 
      token: "test-token", 
      trigger: "message",
      message: { content: "Nice post!", sender_email: "test@test.com", type: "stream", topic: "post/test-slug" } 
    });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });

  it("should ignore sync comments from unverified user", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const payload = JSON.stringify({ 
      token: "test-token", 
      trigger: "message",
      message: { content: "Nice post!", sender_email: "test@test.com", type: "stream", topic: "post/test-slug" } 
    });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });

  it("should handle DB error gracefully", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !stats' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Command failed");
  });

  it("should reject unknown commands with help", async () => {
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !unknown' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Unknown command");
  });

  it("should handle !events", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([{ title: "Competition", date_start: "2024-01-01" }]);
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !events' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Competition");
  });

  it("should block !rcv create without admin role", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue(null); // not admin
    const payload = JSON.stringify({ token: "test-token", message: { content: '@**ARES Bot** !rcv create "A" "1" "2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Permission denied");
  });

  it("should handle valid !rcv create", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = JSON.stringify({ token: "test-token", message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create "Poll" "Opt1" "Opt2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Poll Created");
  });

  it("should handle comment sync", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ id: "user1", role: "admin" });
    const payload = JSON.stringify({ token: "test-token", message: { type: "stream", topic: "post/test-post", sender_email: "a@a.com", content: "Great post!" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", body: payload }), {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });
});
