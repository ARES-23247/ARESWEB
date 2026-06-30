import { describe, it, expect, vi, beforeEach } from "vitest";
import zulipRouter from "../zulip";
import { sendZulipMessage } from "../../lib/zulip";

// Mock the Zulip library helpers
vi.mock("../../lib/zulip", () => {
  return {
    sendZulipMessage: vi.fn(),
  };
});

// Mock fetch globally
const globalFetchMock = vi.fn();
global.fetch = globalFetchMock;

describe("Zulip Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZULIP_URL = "https://mock.zulipchat.com";
    process.env.ZULIP_BOT_EMAIL = "bot@aresfirst.org";
    process.env.ZULIP_API_KEY = "mock_key";

    req = {
      query: {},
      body: {},
      user: {
        uid: "user_123",
        email: "test@example.com",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = zulipRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /topic", () => {
    it("should return mock messages from Zulip successfully", async () => {
      const handler = getHandler("/topic", "get");
      req.query = { stream: "announcements", topic: "Doc: Welcome" };

      globalFetchMock.mockResolvedValue({
        ok: true,
        json: async () => ({
          messages: [
            { id: 1, content: "Hello world", sender_full_name: "John Doe" },
          ],
        }),
      } as any);

      await handler(req, res, next);

      expect(globalFetchMock).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        messages: [
          { id: 1, content: "Hello world", sender_full_name: "John Doe" },
        ],
      });
    });

    it("should return empty list if Zulip credentials are not configured", async () => {
      delete process.env.ZULIP_BOT_EMAIL;
      delete process.env.ZULIP_API_KEY;

      const handler = getHandler("/topic", "get");
      req.query = { stream: "announcements", topic: "Doc: Welcome" };

      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        messages: [],
      });
    });

    it("should return 400 if stream or topic parameter is missing", async () => {
      const handler = getHandler("/topic", "get");
      req.query = { stream: "announcements" };

      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
    });
  });

  describe("POST /message", () => {
    it("should successfully deliver message", async () => {
      const handler = getHandler("/message", "post");
      req.body = { stream: "announcements", topic: "Doc: Welcome", content: "New Comment" };

      vi.mocked(sendZulipMessage).mockResolvedValue(true);

      await handler(req, res, next);

      expect(sendZulipMessage).toHaveBeenCalledWith("announcements", "Doc: Welcome", "New Comment");
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Message delivered successfully.",
      });
    });

    it("should return 400 if fields are missing", async () => {
      const handler = getHandler("/message", "post");
      req.body = { stream: "announcements" };

      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
    });
  });
});
