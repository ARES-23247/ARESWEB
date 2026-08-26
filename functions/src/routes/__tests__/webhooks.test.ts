import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  taskGet: vi.fn(),
  commentGet: vi.fn(),
  batchSet: vi.fn(),
  batchUpdate: vi.fn(),
  receiptSet: vi.fn(),
  transactionGet: vi.fn(),
  transactionSet: vi.fn(),
  transactionCreate: vi.fn(),
  transactionUpdate: vi.fn(),
  syndicate: vi.fn(),
  zulipSend: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: string) => {
      if (name === "posts") return { doc: vi.fn(() => ({ kind: "post" })) };
      if (name === "internal_social_syndication") {
        return {
          doc: vi.fn(() => ({ kind: "receipt", set: mocks.receiptSet })),
        };
      }
      return {
        doc: vi.fn(() => ({
          get: mocks.taskGet,
          collection: vi.fn(() => ({
            doc: vi.fn((id: string) => ({ kind: "comment", id, get: mocks.commentGet })),
          })),
        })),
      };
    }),
    batch: vi.fn(() => ({
      update: mocks.batchUpdate,
      set: mocks.batchSet,
      commit: vi.fn().mockResolvedValue(true),
    })),
    runTransaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
      callback({
        get: mocks.transactionGet,
        set: mocks.transactionSet,
        create: mocks.transactionCreate,
        update: mocks.transactionUpdate,
      }),
    ),
  },
  adminFieldValue: { increment: vi.fn((value) => value) },
}));

vi.mock("../../lib/socialSyndication", () => ({
  SYNDICATION_CHANNELS: ["zulip", "bluesky", "buffer"],
  syndicatePublishedPost: (...args: unknown[]) => mocks.syndicate(...args),
}));

vi.mock("../../lib/zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => mocks.zulipSend(...args),
}));

import webhooksRouter, { syndicationQuotaKey } from "../webhooks";

describe("Webhooks Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ZULIP_WEBHOOK_TOKEN = "correct-webhook-token";
    process.env.ONSHAPE_WEBHOOK_TOKEN = "correct-onshape-token";
    delete process.env.ONSHAPE_ZULIP_STREAM;
    delete process.env.ZULIP_BOT_EMAIL;
    mocks.commentGet.mockResolvedValue({ exists: false });
    mocks.transactionGet.mockResolvedValue({ exists: false });
    mocks.zulipSend.mockResolvedValue(true);
    mocks.syndicate.mockResolvedValue({
      zulip: true,
      bluesky: true,
      buffer: true,
    });
    mocks.receiptSet.mockResolvedValue(undefined);
    req = {
      body: {},
      query: {},
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
      (layer) =>
        layer.route &&
        layer.route.path === path &&
        (layer.route as any).methods[method],
    );
    expect(routeLayer).toBeDefined();
    return routeLayer!.route!.stack;
  };

  const getHandler = (path: string, method: string) =>
    routeStack(path, method).at(-1)!.handle;

  describe("POST /api/webhooks/zulip", () => {
    it("fails if the webhook token is invalid", async () => {
      req.body = { token: "wrong-token" };
      await getHandler("/zulip", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 401,
          message: expect.stringContaining("Invalid webhook token"),
        }),
      );
    });

    it("ignores webhook messages that do not match the Task- topic format", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "General Chat",
          content: "Hello team",
          sender_full_name: "Coach",
        },
      };
      await getHandler("/zulip", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.taskGet).not.toHaveBeenCalled();
    });

    it("syncs a verified Zulip comment to an existing task", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "Task-123",
          content: "Checked code.",
          sender_full_name: "Coach",
        },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);

      expect(mocks.transactionCreate).toHaveBeenCalled();
      expect(mocks.transactionUpdate).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ content: "" });
    });

    it("replies silently when the referenced task card does not exist", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "Task-does-not-exist",
          content: "Checked code.",
          sender_full_name: "Coach",
        },
      };
      mocks.taskGet.mockResolvedValue({ exists: false });
      await getHandler("/zulip", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.transactionCreate).not.toHaveBeenCalled();
    });

    it("skips messages whose content is only an @mention", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "Task-123",
          content: "@**Coach**",
          sender_full_name: "Coach",
        },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.transactionCreate).not.toHaveBeenCalled();
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it("accepts the current direct_message trigger", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "direct_message",
        message: {
          subject: "Task-456",
          content: "Direct update.",
          sender_full_name: "Coach",
        },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);

      expect(mocks.transactionCreate).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ content: "Direct update.", source: "zulip" }),
      );
      expect(next).not.toHaveBeenCalled();
    });

    it("ignores the workspace bot's own messages to prevent echo loops", async () => {
      process.env.ZULIP_BOT_EMAIL = "ares-bot@zulipchat.com";
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        sender_email: "ARES-Bot@zulipchat.com",
        message: {
          topic: "Task-123",
          content: "Relayed web comment",
          sender_full_name: "ARES Bot",
          sender_email: "ares-bot@zulipchat.com",
        },
      };
      await getHandler("/zulip", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.taskGet).not.toHaveBeenCalled();
      expect(mocks.transactionCreate).not.toHaveBeenCalled();
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it("stores redelivered Zulip messages exactly once", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "message",
        message: {
          topic: "Task-123",
          content: "Checked code twice.",
          sender_full_name: "Coach",
          id: 987654,
          timestamp: 1_755_000_000,
        },
      };
      mocks.taskGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);
      expect(mocks.transactionCreate).toHaveBeenCalledTimes(1);
      const storedRef = mocks.transactionCreate.mock.calls[0][0];
      expect(storedRef.id).toMatch(/^comment_zulip_[0-9a-f]{24}$/);
      expect(mocks.transactionUpdate).toHaveBeenCalledTimes(1);

      vi.clearAllMocks();
      mocks.taskGet.mockResolvedValue({ exists: true });
      mocks.transactionGet.mockResolvedValue({ exists: true });
      await getHandler("/zulip", "post")(req, res, next);
      expect(res.json).toHaveBeenCalledWith({ content: "" });
      expect(mocks.transactionCreate).not.toHaveBeenCalled();
      expect(mocks.transactionUpdate).not.toHaveBeenCalled();
    });

    it("rejects malformed authenticated payloads", async () => {
      req.body = {
        token: "correct-webhook-token",
        trigger: "direct_message",
        message: { subject: "Task-456", content: 123 },
      };
      await getHandler("/zulip", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(mocks.batchSet).not.toHaveBeenCalled();
    });
  });

  describe("POST /api/webhooks/onshape", () => {
    it("rejects a missing or wrong URL token", async () => {
      req.query = {};
      req.body = { event: { eventType: "version.created", documentId: "a1b2c3d4e5f6g7h8i9j0" } };
      await getHandler("/onshape", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 401 }),
      );

      req.query = { token: "wrong-onshape-token" };
      await getHandler("/onshape", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 401,
          message: expect.stringContaining("Invalid webhook token"),
        }),
      );
      expect(mocks.zulipSend).not.toHaveBeenCalled();
    });

    it("fails closed when the server lacks the secret configuration", async () => {
      delete process.env.ONSHAPE_WEBHOOK_TOKEN;
      req.query = { token: "correct-onshape-token" };
      req.body = { event: { eventType: "version.created", documentId: "a1b2c3d4e5f6g7h8i9j0" } };
      await getHandler("/onshape", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 500 }),
      );
    });

    it("rejects malformed event payloads", async () => {
      req.query = { token: "correct-onshape-token" };
      req.body = {
        event: { eventType: "version.created", documentId: "../../evil" },
      };
      await getHandler("/onshape", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(mocks.zulipSend).not.toHaveBeenCalled();
    });

    it("acknowledges unrelayed event types without posting", async () => {
      req.query = { token: "correct-onshape-token" };
      req.body = {
        event: { eventType: "document.modified", documentId: "a1b2c3d4e5f6g7h8i9j0" },
      };
      await getHandler("/onshape", "post")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ status: "ignored" });
      expect(mocks.zulipSend).not.toHaveBeenCalled();
    });

    it("relays a verified version event to the configured Zulip stream", async () => {
      process.env.ONSHAPE_ZULIP_STREAM = "cad";
      req.query = { token: "correct-onshape-token" };
      req.body = {
        event: {
          eventType: "version.created",
          documentId: "a1b2c3d4e5f6g7h8i9j0",
          documentName: "2027 Robot",
          userName: "Jane Doe",
          versionName: "v42",
        },
      };
      await getHandler("/onshape", "post")(req, res, next);

      expect(mocks.zulipSend).toHaveBeenCalledWith(
        "cad",
        "CAD \u00b7 2027 Robot",
        expect.stringContaining("Jane Doe created version v42"),
      );
      expect(res.json).toHaveBeenCalledWith({ status: "delivered" });
      expect(next).not.toHaveBeenCalled();
    });

    it("defaults to the engineering stream when no override is set", async () => {
      req.query = { token: "correct-onshape-token" };
      req.body = {
        event: {
          eventType: "comment.created",
          documentId: "a1b2c3d4e5f6g7h8i9j0",
          userName: "Jane Doe",
        },
      };
      await getHandler("/onshape", "post")(req, res, next);

      expect(mocks.zulipSend).toHaveBeenCalledWith(
        "engineering",
        expect.stringContaining("a1b2c3d4e5f6g7h8i9j0"),
        expect.stringContaining("Jane Doe commented on"),
      );
      expect(res.json).toHaveBeenCalledWith({ status: "delivered" });
    });

    it("surfaces upstream Zulip failures instead of faking success", async () => {
      mocks.zulipSend.mockResolvedValue(false);
      req.query = { token: "correct-onshape-token" };
      req.body = {
        event: {
          eventType: "version.created",
          documentId: "a1b2c3d4e5f6g7h8i9j0",
        },
      };
      await getHandler("/onshape", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 502 }),
      );
      expect(res.json).not.toHaveBeenCalledWith({ status: "delivered" });
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
      thumbnail: "https://images.example.org/state-finals.jpg",
    };

    it("keeps verified authorization and a publisher quota before the handler", () => {
      const stack = routeStack("/syndicate-post", "post");
      expect(stack).toHaveLength(4);
      expect(stack[0].handle).toEqual(expect.any(Function));
      expect(stack[1].name).toBe("ensureTeamMember");
      expect(stack[2].handle).toEqual(expect.any(Function));
      expect(
        syndicationQuotaKey({ user: { uid: "publisher-uid" } } as never),
      ).toBe("publisher-uid");
      expect(syndicationQuotaKey({} as never)).toBe(
        "missing-verified-identity",
      );
    });

    it("reads the approved post server-side and records successful delivery", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });

      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "state-finals-2026",
          title: "State Finals Victory",
          version: approvedPost.approvedAt,
          author: "CircuitFox",
          thumbnail: "https://images.example.org/state-finals.jpg",
        }),
        ["zulip", "bluesky", "buffer"],
      );
      expect(mocks.transactionSet).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "receipt" }),
        expect.objectContaining({
          status: "in_progress",
          deliveries: { zulip: false, bluesky: false, buffer: false },
        }),
      );
      expect(mocks.receiptSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "complete",
          deliveries: { zulip: true, bluesky: true, buffer: true },
        }),
        { merge: true },
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        syndication: { zulip: true, bluesky: true, buffer: true },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("repairs legacy direct publications with a server-owned timestamp", async () => {
      const createdAt = "2026-08-26T20:20:00.000Z";
      req.body = { slug: "legacy-coach-post" };
      mocks.transactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ ...approvedPost, approvedAt: undefined }),
          createTime: { toDate: () => new Date(createdAt) },
        })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });

      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.transactionUpdate).toHaveBeenCalledWith(
        expect.objectContaining({ kind: "post" }),
        { approvedAt: createdAt },
      );
      expect(mocks.syndicate).toHaveBeenCalledWith(
        expect.objectContaining({
          slug: "legacy-coach-post",
          version: createdAt,
        }),
        ["zulip", "bluesky", "buffer"],
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        syndication: { zulip: true, bluesky: true, buffer: true },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it("rejects members who cannot publish", async () => {
      req.authorizationRole = "member";
      req.body = { slug: "state-finals-2026" };
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 403 }),
      );
      expect(mocks.transactionGet).not.toHaveBeenCalled();
    });

    it("rejects malformed slugs before Firestore access", async () => {
      req.body = { slug: "../../state-finals", title: "ignored" };
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 400 }),
      );
      expect(mocks.transactionGet).not.toHaveBeenCalled();
    });

    it("rejects records that are not approved and publicly visible", async () => {
      req.body = { slug: "draft-post" };
      mocks.transactionGet
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({ ...approvedPost, status: "draft" }),
        })
        .mockResolvedValueOnce({ exists: false, data: () => undefined });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 409 }),
      );
      expect(mocks.syndicate).not.toHaveBeenCalled();
    });

    it("does not replay completed per-channel deliveries", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "complete",
            version: approvedPost.approvedAt,
            deliveries: { zulip: true, bluesky: true, buffer: true },
          }),
        });
      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        alreadySyndicated: true,
      });
    });

    it("migrates a legacy Zulip receipt and sends to newer channels", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "complete",
            version: approvedPost.approvedAt,
          }),
        });
      mocks.syndicate.mockResolvedValue({ bluesky: true, buffer: true });

      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "state-finals-2026" }),
        ["bluesky", "buffer"],
      );
      expect(mocks.receiptSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "complete",
          deliveries: { zulip: true, bluesky: true, buffer: true },
        }),
        { merge: true },
      );
    });

    it("adds Buffer without replaying already delivered modern channels", async () => {
      req.body = { slug: "state-finals-2026" };
      mocks.transactionGet
        .mockResolvedValueOnce({ exists: true, data: () => approvedPost })
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            status: "complete",
            version: approvedPost.approvedAt,
            deliveries: { zulip: true, bluesky: true },
          }),
        });
      mocks.syndicate.mockResolvedValue({ buffer: true });

      await getHandler("/syndicate-post", "post")(req, res, next);

      expect(mocks.syndicate).toHaveBeenCalledWith(
        expect.objectContaining({ slug: "state-finals-2026" }),
        ["buffer"],
      );
      expect(mocks.receiptSet).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "complete",
          deliveries: { zulip: true, bluesky: true, buffer: true },
        }),
        { merge: true },
      );
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
        expect.objectContaining({
          status: "failed",
          deliveries: { zulip: false, bluesky: false, buffer: false },
        }),
        { merge: true },
      );
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ status: 502 }),
      );
      expect(res.json).not.toHaveBeenCalled();
    });
  });
});
