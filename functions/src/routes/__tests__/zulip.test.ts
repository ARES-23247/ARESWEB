import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getZulipCredentials,
  getZulipUsers,
  sendZulipMessage,
} from "../../lib/zulip";
import zulipRouter from "../zulip";

const documentGet = vi.fn();
const auditAdd = vi.fn();
const batchSet = vi.fn();
const batchCommit = vi.fn();

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      doc: vi.fn(() => ({ get: documentGet })),
      add: auditAdd,
    })),
    batch: vi.fn(() => ({ set: batchSet, commit: batchCommit })),
  },
}));

vi.mock("../../lib/zulip", () => ({
  getZulipCredentials: vi.fn(),
  getZulipUsers: vi.fn(),
  sendZulipMessage: vi.fn(),
}));

const fetchMock = vi.fn();
global.fetch = fetchMock;

describe("Zulip API integrity", () => {
  let req: any;
  let res: any;
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    req = {
      query: {},
      params: {},
      body: {},
      user: { uid: "member-uid", email: "member@example.org" },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
    batchCommit.mockResolvedValue(undefined);
    auditAdd.mockResolvedValue({ id: "audit-id" });
    vi.mocked(getZulipCredentials).mockReturnValue({
      url: "https://aresfirst.zulipchat.com",
      email: "bot@aresfirst.org",
      apiKey: "secret-key",
    });
    vi.mocked(getZulipUsers).mockResolvedValue([]);
  });

  function handler(path: string, method: string) {
    const layer = zulipRouter.stack.find(entry =>
      entry.route?.path === path && entry.route.methods[method]
    );
    expect(layer).toBeDefined();
    return layer!.route!.stack.at(-1)!.handle;
  }

  it("returns only the signed-in member's link state and approved workspace URLs", async () => {
    documentGet.mockResolvedValueOnce({
      data: () => ({
        inviteUrl: "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
        internalNote: "never expose",
      }),
    });
    vi.mocked(getZulipUsers).mockResolvedValueOnce([{
      email: "member@example.org",
      delivery_email: "private-delivery@example.org",
      full_name: "Private Name",
      api_key: "never-expose",
    }]);

    await handler("/status", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      linked: true,
      integration: { available: true, diagnostic: null },
      workspace: {
        url: "https://aresfirst.zulipchat.com",
        inviteUrl: "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
      },
    });
    const serialized = JSON.stringify(res.json.mock.calls[0][0]);
    expect(serialized).not.toContain("member@example.org");
    expect(serialized).not.toContain("Private Name");
    expect(serialized).not.toContain("never-expose");
  });

  it("reports Zulip status unavailability without inventing a linked state", async () => {
    documentGet.mockResolvedValueOnce({ data: () => ({}) });
    vi.mocked(getZulipUsers).mockResolvedValueOnce(null);

    await handler("/status", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      linked: false,
      integration: {
        available: false,
        diagnostic: "HTTP 503: Zulip account status is not available right now.",
      },
      workspace: expect.objectContaining({ inviteUrl: null }),
    }));
  });

  it("rejects unsafe stored invitation URLs instead of returning them", async () => {
    documentGet.mockResolvedValueOnce({
      data: () => ({ inviteUrl: "https://evil.example/join/abcdefghijklmnop/" }),
    });

    await handler("/status", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
      workspace: expect.objectContaining({ inviteUrl: null }),
    }));
  });

  it("updates a validated team-host invitation link in an audited batch", async () => {
    req.body = { inviteUrl: "https://aresfirst.zulipchat.com/join/abcdefghijklmnop" };

    await handler("/config", "patch")(req, res, next);

    expect(batchSet).toHaveBeenCalledTimes(2);
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        inviteUrl: "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
        updatedBy: "member-uid",
      }),
      { merge: true },
    );
    expect(batchSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "zulip.config.updated",
        actorUid: "member-uid",
        after: { inviteConfigured: true },
      }),
    );
    const auditRecord = batchSet.mock.calls.find(call => call[1]?.action === "zulip.config.updated")?.[1];
    expect(JSON.stringify(auditRecord)).not.toContain("abcdefghijklmnop");
    expect(batchCommit).toHaveBeenCalledOnce();
  });

  it.each([
    "http://aresfirst.zulipchat.com/join/abcdefghijklmnop/",
    "https://evil.example/join/abcdefghijklmnop/",
    "https://aresfirst.zulipchat.com:444/join/abcdefghijklmnop/",
    "https://user:password@aresfirst.zulipchat.com/join/abcdefghijklmnop/",
    "https://aresfirst.zulipchat.com/join/short/",
    "https://aresfirst.zulipchat.com/join/abcdefghijklmnop/?token=extra",
  ])("rejects an unsafe invitation URL: %s", async inviteUrl => {
    req.body = { inviteUrl };
    await handler("/config", "patch")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
    expect(batchCommit).not.toHaveBeenCalled();
  });

  it("returns a bounded explicit topic DTO without sender emails", async () => {
    req.query = { stream: "announcements", topic: "Welcome" };
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: vi.fn().mockResolvedValue({
        messages: [{
          id: 7,
          content: "Hello",
          sender_email: "student@example.org",
          sender_full_name: "CircuitFox",
          sender_id: 99,
          timestamp: 1_700_000_000,
          avatar_url: "https://avatars.example/member.png",
        }],
      }),
    });

    await handler("/topic", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      messages: [{
        id: 7,
        content: "Hello",
        sender_full_name: "CircuitFox",
        timestamp: 1_700_000_000,
        avatar_url: "https://avatars.example/member.png",
      }],
    });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("student@example.org");
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("sender_id");
  });

  it("returns HTTP 503 instead of an empty topic when credentials are missing", async () => {
    req.query = { stream: "announcements", topic: "Welcome" };
    vi.mocked(getZulipCredentials).mockReturnValue({ url: "", email: "", apiKey: "" });

    await handler("/topic", "get")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503 }));
    expect(res.json).not.toHaveBeenCalled();
  });

  it("validates, trims, and sends a bounded message", async () => {
    req.body = { stream: " announcements ", topic: " Welcome ", content: " Hello " };
    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true);

    await handler("/message", "post")(req, res, next);

    expect(sendZulipMessage).toHaveBeenCalledWith("announcements", "Welcome", "Hello");
    expect(res.json).toHaveBeenCalledWith({
      success: true,
      message: "Message delivered successfully.",
    });
  });

  it("rejects streams outside the team proxy allowlist", async () => {
    req.body = { stream: "leadership", topic: "Private", content: "Hello" };
    await handler("/message", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));

    req.body = { stream: "kanban", topic: "Task-1", content: "Hello" };
    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true);
    await handler("/message", "post")(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects topic reads outside the team proxy allowlist", async () => {
    req.query = { stream: "leadership", topic: "Private" };
    await handler("/topic", "get")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403 }));
  });

  it("neutralizes mentions and wildcard pings in outbound member content", async () => {
    req.body = {
      stream: "announcements",
      topic: "Welcome",
      content: "@**Coach** please review @all silent ping @everyone",
    };
    vi.mocked(sendZulipMessage).mockResolvedValueOnce(true);

    await handler("/message", "post")(req, res, next);

    const sent = vi.mocked(sendZulipMessage).mock.calls[0][2];
    expect(sent).toBe("please review silent ping");
    expect(sent).not.toContain("@");
  });

  it("rejects content that is empty after mention removal", async () => {
    req.body = { stream: "announcements", topic: "Welcome", content: "@**Coach** @all" };
    await handler("/message", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
  });

  it("surfaces an upstream message failure", async () => {
    req.body = { stream: "announcements", topic: "Welcome", content: "Hello" };
    vi.mocked(sendZulipMessage).mockResolvedValueOnce(false);

    await handler("/message", "post")(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 502 }));
  });
});
