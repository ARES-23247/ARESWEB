 
import { describe, it, expect, vi, beforeEach } from "vitest";
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

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should reject requests with invalid token", async () => {
    const payload = JSON.stringify({ token: "wrong", message: { content: "test" } });
    const req = new Request("http://localhost/", {
      method: "POST",
      body: payload,
    });

    const res = await zulipWebhookRouter.request(req, {}, env, mockExecutionContext);
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
});
