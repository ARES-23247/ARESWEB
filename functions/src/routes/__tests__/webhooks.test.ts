import { describe, it, expect, vi, beforeEach } from "vitest";
import webhooksRouter from "../webhooks";
import { adminDb } from "../../lib/firebase-admin";

const mockGet = vi.fn();
const mockSet = vi.fn();
const mockUpdate = vi.fn();

vi.mock("../../lib/firebase-admin", () => {
  return {
    adminDb: {
      collection: vi.fn(() => ({
        doc: vi.fn(() => ({
          get: mockGet,
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({
              set: mockSet,
            }))
          }))
        }))
      })),
      batch: vi.fn(() => ({
        update: mockUpdate,
        set: mockSet,
        commit: vi.fn().mockResolvedValue(true)
      }))
    },
    default: {
      firestore: {
        FieldValue: {
          increment: vi.fn((val) => val)
        }
      }
    }
  };
});

describe("Webhooks Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZULIP_WEBHOOK_TOKEN = "correct-webhook-token";

    req = {
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = webhooksRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("POST /api/webhooks/zulip", () => {
    it("should fail if webhook token is invalid", async () => {
      req.body = { token: "wrong-token" };
      const handler = getHandler("/zulip", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(401);
      expect(err.message).toContain("Invalid webhook token");
    });

    it("should ignore webhook messages that do not match the Task- topic format", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "General Chat",
          content: "Hello team",
          sender_full_name: "John Doe"
        }
      };
      const handler = getHandler("/zulip", "post");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mockGet).not.toHaveBeenCalled();
    });

    it("should sync Zulip comment to Firestore when topic matches Task-ID format", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "Task-123",
          content: "Checked in latest code changes.",
          sender_full_name: "Coach Dave"
        }
      };
      mockGet.mockResolvedValue({ exists: true });
      const handler = getHandler("/zulip", "post");
      await handler(req, res, next);

      expect(mockGet).toHaveBeenCalled();
      expect(mockSet).toHaveBeenCalled();
      expect(mockUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ content: "" });
    });
  });
});
