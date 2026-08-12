import { describe, it, expect, vi, beforeEach } from "vitest";
import tasksRouter from "../tasks";
import { sendZulipMessage } from "../../lib/zulip";

vi.mock("../../middleware/auth", () => ({
  ensureTeamMember: (_req: unknown, _res: unknown, next: () => unknown) => next(),
}));

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

  const invokeRoute = async (path: string, method: string) => {
    const routeLayer = tasksRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const handlers = routeLayer!.route!.stack.map((layer) => layer.handle);
    const dispatch = async (index: number): Promise<void> => {
      const handler = handlers[index];
      if (!handler) return;
      await handler(req, res, (error?: unknown) => {
        if (error) {
          next(error);
          return;
        }
        return dispatch(index + 1);
      });
    };
    await dispatch(0);
  };

  describe("POST /api/tasks/comment - Comment forward to Zulip", () => {
    it("should forward a comment successfully if fields are valid", async () => {
      req.body = {
        taskId: "123",
        author: "Spoofed Administrator",
        content: "We should change the slides setup."
      };

      await invokeRoute("/comment", "post");

      expect(sendZulipMessage).toHaveBeenCalledWith(
        "kanban",
        "Task-123",
        expect.stringContaining("ARES Team Member"),
      );
      expect(sendZulipMessage).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.stringContaining("Spoofed Administrator"),
      );
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
      };

      await invokeRoute("/comment", "post");

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Enter a valid task comment.");
      expect(err.status).toBe(400);
    });

    it("returns an upstream error when Zulip rejects the comment", async () => {
      vi.mocked(sendZulipMessage).mockResolvedValueOnce(false);
      req.body = { taskId: "123", content: "Ready for review" };

      await invokeRoute("/comment", "post");

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 502 }));
    });
  });

  describe("POST /api/tasks/notify - Task board updates notifications", () => {
    it("should send notifications successfully", async () => {
      req.body = {
        taskId: "123",
        action: "create",
        title: "Fix intake slide calibrations"
      };

      await invokeRoute("/notify", "post");

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

      await invokeRoute("/notify", "post");

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Enter valid task notification details.");
      expect(err.status).toBe(400);
    });

    it("returns an upstream error when Zulip rejects the notification", async () => {
      vi.mocked(sendZulipMessage).mockResolvedValueOnce(false);
      req.body = { taskId: "123", action: "move", title: "Drive task", status: "done" };

      await invokeRoute("/notify", "post");

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 502 }));
    });
  });
});
