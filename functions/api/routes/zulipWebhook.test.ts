/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import zulipWebhookRouter from "./zulipWebhook";
import { mockExecutionContext, flushWaitUntil, createMockExpressionBuilder } from "../../../src/test/utils";
import { TestEnv, MockKysely } from "../../../src/test/types";


vi.mock("../../utils/zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(1),
}));

vi.mock("../middleware/utils", async (importOriginal) => {
  const mod = await importOriginal<typeof import("../middleware/utils")>();
  return {
    ...mod,
    getSocialConfig: vi.fn().mockImplementation(async (c) => {
      console.log("[MockSocialConfig] Env:", { ZULIP_WEBHOOK_TOKEN: c.env?.ZULIP_WEBHOOK_TOKEN });
      return {
        ZULIP_WEBHOOK_TOKEN: c.env?.ZULIP_WEBHOOK_TOKEN || "test-token",
        ZULIP_BOT_EMAIL: c.env?.ZULIP_BOT_EMAIL,
        ZULIP_API_KEY: c.env?.ZULIP_API_KEY,
      };
    }),
  };
});

describe("Zulip Webhook Router", () => {
  const env: TestEnv["Bindings"] = {
    ZULIP_WEBHOOK_TOKEN: "test-token",
    ZULIP_BOT_EMAIL: "test@test.com",
    ZULIP_API_KEY: "test-key",
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
    } as unknown as D1Database,
  };

  let testApp: Hono<TestEnv>;
  let mockDb: MockKysely;

  type ZulipPayloadOverrides = {
    token?: string;
    trigger?: string;
    message?: {
      id?: number;
      sender_id?: number;
      sender_email?: string;
      sender_full_name?: string;
      content?: string;
      display_recipient?: string;
      subject?: string;
      topic?: string;
      type?: string;
    };
  };

  const createZulipPayload = (overrides: ZulipPayloadOverrides = {}) => {
    return JSON.stringify({
      token: "test-token",
      trigger: "message",
      message: {
        id: 12345,
        sender_id: 1,
        sender_email: "test@test.com",
        sender_full_name: "Test User",
        content: "@**ARES Bot** !help",
        display_recipient: "leadership",
        subject: "Test Subject",
        type: "stream",
        ...overrides.message
      },
      ...overrides
    });
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockDb = {
      selectFrom: vi.fn().mockReturnThis(),
      select: vi.fn().mockImplementation((cb) => {
        if (typeof cb === 'function') {
          cb(createMockExpressionBuilder());
        }
        return mockDb;
      }),
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
      deleteFrom: vi.fn().mockReturnThis(),
    };

    testApp = new Hono<TestEnv>();
    testApp.use("*", async (c, next) => {
      c.set("db", mockDb);
      // Ensure ZULIP_WEBHOOK_TOKEN is in env for getSocialConfig
      (c.env as any).ZULIP_WEBHOOK_TOKEN = "test-token";
      await next();
    });
    testApp.route("/", zulipWebhookRouter);
  });

  it("should handle empty bot mentions with help message", async () => {
    const payload = createZulipPayload({ message: { content: "@**ARES Bot** " } });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Hello! I am the ARES Bot");
  });

  it("should return unauthorized for wrong token length", async () => {
    const payload = createZulipPayload({ token: "short" });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should return unauthorized for invalid token of same length", async () => {
    const payload = createZulipPayload({ token: "wrong-toke" });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should return unauthorized for invalid token", async () => {
    const payload = createZulipPayload({ token: "wrong-test-token" });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(401);
  });

  it("should respond to !help command", async () => {
    const payload = createZulipPayload({ message: { content: "!help" } });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARES Bot Commands");
  });

  it("should respond to !events with no events", async () => {
    (mockDb.execute ).mockResolvedValueOnce([]);
    const payload = createZulipPayload({ message: { content: "!events" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("No upcoming events scheduled");
  });

  it("should respond to !stats", async () => {
    mockDb.executeTakeFirst.mockResolvedValue({ count: 5 });
    const payload = createZulipPayload({ message: { content: "!stats" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARESWEB Quick Stats");
  });

  it("should respond to !inquiries with pending inquiries", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 });
    const payload = createZulipPayload({ message: { content: "!inquiries" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("pending inquiries");
  });

  it("should respond to !inquiries with no pending inquiries", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 0 });
    const payload = createZulipPayload({ message: { content: "!inquiries" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("No pending inquiries");
  });

  it("should deny !broadcast if sender is missing", async () => {
    const payload = createZulipPayload({ message: { content: "!broadcast general msg", sender_email: undefined } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    await res.json();
    expect(res.status).toBe(200);
  });

  it("should return usage for !broadcast with missing args", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: "!broadcast general" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Usage:");
  });

  it("should respond to !broadcast with valid args and handle successful send", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", sender_full_name: "Alice", content: "!broadcast general Hello world" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Broadcast dispatched");
  });

  it("should respond to !broadcast and catch send failure", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ role: "admin" });
    const { sendZulipMessage } = await import("../../utils/zulipSync");
    vi.mocked(sendZulipMessage).mockRejectedValueOnce(new Error("Zulip fail"));
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", sender_full_name: "Alice", content: "!broadcast general Fail test" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Broadcast dispatched");
    // wait for background task
    await flushWaitUntil();
  });

  it("should return help for !rcv with no args", async () => {
    const payload = createZulipPayload({ message: { content: "!rcv" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Ranked Choice Voting (IRV)");
  });

  it("should deny !rcv create if no sender_email", async () => {
    const payload = createZulipPayload({ message: { content: "!rcv create Title Opt1 Opt2", sender_email: undefined } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Permission denied");
  });

  it("should deny !rcv create if not admin", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: "!rcv create Title Opt1 Opt2" } });
    const req = new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload });
    const res = await testApp.request(req, {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Permission denied");
  });

  it("should parse quoted arguments for !broadcast", async () => {
    const payload = createZulipPayload({ 
      message: { 
        content: '@**ARES Bot** !broadcast "Stream with Spaces" Hello world',
        sender_full_name: "Test User"
      } 
    });
    const req = new Request("http://localhost/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });

    const res = await testApp.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("dispatched to `Stream with Spaces`.");
  });
  it("should handle !help", async () => {
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !help' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARES Bot Commands");
  });

  it("should handle !tasks when empty", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([]);
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !tasks' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("No open tasks");
  });

  it("should handle !tasks with items", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([
      { title: "Task 1", status: "pending", due_date: "2026-01-01" },
      { title: "Task 2", status: "in_progress", due_date: null }
    ]);
    mockDb.executeTakeFirst.mockResolvedValueOnce({ count: 2 });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !tasks' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Task Board");
    expect(json.content).toContain("Task 1");
  });

  it("should handle !task with no arguments", async () => {
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !task' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Usage:");
  });

  it("should handle !task create with valid sender email", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "user123" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", sender_full_name: "Test User", content: '@**ARES Bot** !task new task' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Created task: **new task**");
  });

  it("should handle !task create", async () => {
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !task New task here' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Created task: **New task here**");
  });

  it("should handle !task completion", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([{ id: "123", title: "Test Task" }]); // openTasks
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !task 1 done' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("marked as Done!");
  });

  it("should handle !stats", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ count: 5 });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !stats' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("ARESWEB Quick Stats");
  });

  it("should handle !inquiries", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ count: 2 });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !inquiries' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("2 pending inquiries");
  });

  it("should handle !rcv create", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create "Best Robot" "Option 1" "Option 2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Created");
  });

  it("should handle !rcv create with missing title", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Usage: `!rcv create");
  });

  it("should handle !rcv status", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv status 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("📊 **Poll: Best Robot**");
  });

  it("should handle !rcv vote", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv vote 12345 1 2', sender_email: "test@test.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Your vote for `12345` has been recorded!");
  });

  it("should handle !rcv vote closed", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({
      value: JSON.stringify({ title: "Best Robot", active: false, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv vote 12345 1 2', sender_email: "test@test.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("This poll is closed");
  });

  it("should handle !rcv tally", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({
        value: JSON.stringify({ title: "Best Robot", active: true, options: ["A", "B"], votes: { "test@test.com": [0, 1] } })
      })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv tally 12345', sender_email: "a@a.com" } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    // Depending on what tally does, we just expect it to not fail
    expect(json.content).toContain("Poll Closed");
  });

  it("should handle sync comments from verified user", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({ id: "1", role: "member" });
    const payload = createZulipPayload({ 
      message: { content: "Nice post!", sender_email: "test@test.com", type: "stream", topic: "post/test-slug" } 
    });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });

  it("should ignore sync comments from unverified user", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const payload = createZulipPayload({ 
      message: { content: "Nice post!", sender_email: "test@test.com", type: "stream", topic: "post/test-slug" } 
    });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });

  it("should handle DB error gracefully", async () => {
    mockDb.executeTakeFirst.mockRejectedValueOnce(new Error("DB error"));
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !stats' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Command failed");
  });

  it("should reject unknown commands with help", async () => {
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !unknown' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Unknown command");
  });

  it("should handle !events", async () => {
    mockDb.execute = vi.fn().mockResolvedValue([{ title: "Competition", date_start: "2024-01-01" }]);
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !events' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Competition");
  });

  it("should block !rcv create without admin role", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue(null); // not admin
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv create "A" "1" "2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Permission denied");
  });

  it("should handle valid !rcv create", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv create "Poll" "Opt1" "Opt2"' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Poll Created");
  });

  it("should block !rcv tally without admin role", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ value: JSON.stringify({ title: "Poll", active: true, options: ["A"], votes: {} }) })
      .mockResolvedValueOnce(null); // not admin
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv tally 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Permission denied");
  });

  it("should handle !rcv without pollId", async () => {
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv status' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Please specify a poll ID");
  });

  it("should handle !rcv with missing poll", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce(null);
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv status 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("not found");
  });

  it("should handle !rcv vote without senderEmail", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      value: JSON.stringify({ title: "Poll", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { content: '@**ARES Bot** !rcv vote 12345 1', sender_email: undefined } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Could not identify voter");
  });

  it("should handle !rcv vote invalid ranking", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      value: JSON.stringify({ title: "Poll", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv vote 12345 3' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Invalid ranking");
  });

  it("should handle !rcv vote duplicates", async () => {
    mockDb.executeTakeFirst.mockResolvedValueOnce({
      value: JSON.stringify({ title: "Poll", active: true, options: ["A", "B"], votes: {} })
    });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv vote 12345 1 1' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Do not repeat options");
  });

  it("should handle !rcv tally with already closed poll", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ value: JSON.stringify({ title: "Poll", active: false, options: ["A"], votes: {} }) })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv tally 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("already closed");
  });

  it("should handle !rcv tally with no votes", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ value: JSON.stringify({ title: "Poll", active: true, options: ["A"], votes: {} }) })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv tally 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("No votes were cast");
  });

  it("should handle unknown !rcv subcommand", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValueOnce({
      value: JSON.stringify({ title: "Poll", active: true, options: ["A"], votes: {} })
    });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv unknown 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Unknown `!rcv` subcommand");
  });

  it("should handle !rcv tally with tie and eliminations", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ value: JSON.stringify({ title: "Poll", active: true, options: ["A", "B"], votes: { "u1": [0], "u2": [1] } }) })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv tally 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("TIE between: A and B");
  });

  it("should handle !rcv tally with candidate elimination", async () => {
    mockDb.executeTakeFirst = vi.fn()
      .mockResolvedValueOnce({ value: JSON.stringify({ title: "Poll", active: true, options: ["A", "B", "C"], votes: { "u1": [0], "u2": [0], "u3": [1], "u4": [2], "u5": [2] } }) })
      .mockResolvedValueOnce({ role: "admin" });
    const payload = createZulipPayload({ message: { sender_email: "a@a.com", content: '@**ARES Bot** !rcv tally 12345' } });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toContain("Eliminated:");
  });

  it("should ignore unhandled messages and return empty content", async () => {
    const payload = createZulipPayload({ message: { type: "stream", content: "hello world" } }); // No topic, no @**
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });

  it("should handle comment sync", async () => {
    mockDb.executeTakeFirst = vi.fn().mockResolvedValue({ id: "user1", role: "admin" });
    const payload = createZulipPayload({ 
      message: { type: "stream", topic: "post/test-post", sender_email: "a@a.com", content: "Great post!" } 
    });
    const res = await testApp.request(new Request("http://localhost/", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload }), {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
    const json = await res.json() as Record<string, string>;
    expect(json.content).toBe("");
  });
});

