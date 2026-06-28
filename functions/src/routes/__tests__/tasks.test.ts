import { describe, it, expect, vi, beforeEach } from "vitest";
import tasksRouter from "../tasks";

// Mock Zulip API Helpers
vi.mock("../../lib/zulip", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(true),
}));

describe("Tasks Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
      query: {},
      user: { uid: "test_uid", email: "test@aresfirst.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = tasksRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("POST /api/tasks/comment - Comment forward to Zulip", () => {
    it("should forward a comment successfully if fields are valid", async () => {
      req.body = {
        taskId: "123",
        author: "Robot Builder",
        content: "We should change the slides setup."
      };

      const handler = getHandler("/comment", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Comment forwarded to Zulip."
        })
      );
    });

    it("should fail validation if fields are missing", async () => {
      req.body = {
        taskId: "123",
        author: "Robot Builder"
      };

      const handler = getHandler("/comment", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing required fields.");
      expect(err.status).toBe(400);
    });
  });

  describe("POST /api/tasks/notify - Task board updates notifications", () => {
    it("should send notifications successfully", async () => {
      req.body = {
        taskId: "123",
        action: "create",
        title: "Fix intake slide calibrations"
      };

      const handler = getHandler("/notify", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Notification sent to Zulip."
        })
      );
    });

    it("should fail validation if action is missing", async () => {
      req.body = {
        taskId: "123",
        title: "Fix intake slide calibrations"
      };

      const handler = getHandler("/notify", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Missing required fields.");
      expect(err.status).toBe(400);
    });
  });
});
