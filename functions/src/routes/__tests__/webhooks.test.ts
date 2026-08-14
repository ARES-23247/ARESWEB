import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  taskGet: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  receiptSet: vi.fn(),
  transactionGet: vi.fn(),
  transactionSet: vi.fn(),
  syndicate: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "posts") return { doc: vi.fn(() => ({ kind: "post" })) };
      if (name === "internal_social_syndication") {
        return { doc: vi.fn(() => ({ kind: "receipt", set: mocks.receiptSet })) };
      }
      return {
        doc: vi.fn(() => ({
          get: mocks.taskGet,
          collection: vi.fn(() => ({
            doc: vi.fn(() => ({ kind: "comment" })),
          })),
        })),
      };
    }),
    batch: vi.fn(() => ({
      update: mocks.batchUpdate,
      set: mocks.batchSet,
      commit: vi.fn().mockResolvedValue(true),
    })),
    runTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback({
      get: mocks.transactionGet,
      set: mocks.transactionSet,
    })),
  },
  adminFieldValue: { increment: vi.fn((value) => value) },
}));

vi.mock("../../lib/socialSyndication", () => ({
  syndicatePublishedPost: (...args: unknown[]) => mocks.syndicate(...args),
}));

import webhooksRouter, { syndicationQuotaKey } from "../webhooks";

describe("Webhooks Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZULIP_WEBHOOK_TOKEN = "correct-webhook-token";
    mocks.syndicate.mockResolvedValue({ zulip: true, bluesky: true });
    mocks.receiptSet.mockResolvedValue(undefined);
    req = {
      body: {},
      user: { uid: "publisher-uid" },
      authorizationRole: "mentor",
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const routeStack = (path: string, method: string) => {
    const routeLayer = webhooksRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method],
    );
    expect(routeLayer).toBeDefined();
    return routeLayer!.route!.stack;
  };

  const getHandler = (path: string, method: string) => routeStack(path, method).at(-1)!.handle;

  describe("POST /api/webhooks/zulip", () => {
    it("fails if the webhook token is invalid", async () => {
      req.body = { token: "wrong-token" };
      await getHandler("/zulip", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 401,
        message: expect.stringContaining("Invalid webhook token"),
      }));
    });

    it("ignores webhook messages that do not match the Task- topic format", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: { topic: "General Chat", content: "Hello team", sender_full_name: "Coach" },
      };
      await getHandler("/zulip", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.taskGet).not.toHaveBeenCalled();
    });

    it("syncs a verified Zulip comment to an existing task", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: { topic: "Task-123", content: "Checked code.", sender_full_name: "Coach" },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);

      expect(mocks.batchSet).toHaveBeenCalled();
      expect(mocks.batchUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ content: "" });
    });

    it("accepts the current direct_message trigger", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "direct_message",
        message: { subject: "Task-456", content: "Direct update.", sender_full_name: "Coach" },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);

      expect(mocks.batchSet).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ content: "Direct update.", source: "zulip" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects malformed authenticated payloads", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "direct_message",
        message: { subject: "Task-456", content: 123 },
      };
      await getHandler("/zulip", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
      expect(mocks.batchSet).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/webhooks/syndicate-post", () => {
    const approvedPost = {
      status: "published",
      approvalStatus: "approved",
      isDeleted: 0,
      approvedAt: "2026-08-14T04:00:00.000Z",
      title: "State Finals Victory",
      snippet: "We won the state tournament!",
      category: "Tournament",
      author: "CircuitFox",
    };

    it("keeps verified authorization and a publisher quota before the handler", () => {
      const stack = routeStack("/syndicate-post", "post");
      expect(stack).toHaveLength(4);
      expect(stack[0].handle).toEqual(expect.any(Function));
      expect(stack[1].name).toBe("ensureTeamMember");
      expect(stack[2].handle).toEqual(expect.any(Function));
      expect(syndicationQuotaKey({ user: { uid: "publisher-uid" } } as never)).toBe("publisher-uid");
      expect(syndicationQuotaKey({} as never)).toBe("missing-verified-identity");
    });

    it("reads the approved post server-side and records successful delivery", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });

      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).toHaveBeenCalledWith(expect.objectContaining({
        slug: "state-finals-2026",
        title: "State Finals Victory",
        author: "CircuitFox",
      }));
      expect(mocks.transactionSet).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "receipt" }),
        expect.objectContaining({ status: "in_progress" }),
      );
      expect(mocks.receiptSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "complete" }),
        { merge: true },
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, syndication: { zulip: true, bluesky: true } });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects members who cannot publish", async () => {
      req.authorizationRole = "member";
      req.body = { slug: "state-finals-2026" };
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
      expect(mocks.transactionGet).not.toHaveBeenCalled();
    });

    it("rejects malformed slugs before Firestore access", async () => {
      req.body = { slug: "../../state-finals", title: "ignored" };
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
      expect(mocks.transactionGet).not.toHaveBeenCalled();
    });

    it("rejects records that are not approved and publicly visible", async () => {
      req.body = { slug: "draft-post" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => ({ ...approvedPost, status: "draft" }) })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 409 }));
      expect(mocks.syndicate).not.toHaveBeenCalled();
    });

    it("does not replay a completed announcement for the same approval", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ status: "complete", version: approvedPost.approvedAt }),
        });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, alreadySyndicated: true });
    });

    it("returns accepted while the same approval is already being delivered", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "in_progress",
            version: approvedPost.approvedAt,
            startedAt: new Date().toISOString(),
          }),
        });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(202);
      expect(res.json).toHaveBeenCalledWith({ success: true, pending: true });
    });

    it("records delivery failure and returns an upstream error", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });
      mocks.syndicate.mockResolvedValue({ zulip: false });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.receiptSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "failed" }),
        { merge: true },
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 502 }));
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
