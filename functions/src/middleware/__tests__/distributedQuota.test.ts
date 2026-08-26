import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionGet = vi.fn();
  const transactionSet = vi.fn();
  const doc = vi.fn((id: string) => ({ path: `internal_api_quotas/${id}` }));
  const collection = vi.fn(() => ({ doc }));
  const runTransaction = vi.fn(async (callback: (transaction: {
    get: typeof transactionGet;
    set: typeof transactionSet;
  }) => Promise<void>) => callback({ get: transactionGet, set: transactionSet }));
  return { transactionGet, transactionSet, doc, collection, runTransaction };
});

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: { collection: mocks.collection, runTransaction: mocks.runTransaction },
}));

import { distributedAnonymousQuota, distributedQuota, distributedQuotas } from "../distributedQuota";

describe("distributedQuota", () => {
  const originalEncryptionSecret = process.env.ENCRYPTION_SECRET;
  const originalAbuseHmacSecret = process.env.ABUSE_HMAC_SECRET;
  const { collection, doc, runTransaction, transactionGet, transactionSet } = mocks;
  const res = { setHeader: vi.fn() };
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ENCRYPTION_SECRET = "a-production-shaped-secret-that-is-long-enough";
    vi.spyOn(Date, "now").mockReturnValue(1_725_000_123_456);
    transactionGet.mockResolvedValue({ exists: false, data: () => undefined });
  });

  afterEach(() => {
    if (originalEncryptionSecret === undefined) delete process.env.ENCRYPTION_SECRET;
    else process.env.ENCRYPTION_SECRET = originalEncryptionSecret;
    if (originalAbuseHmacSecret === undefined) delete process.env.ABUSE_HMAC_SECRET;
    else process.env.ABUSE_HMAC_SECRET = originalAbuseHmacSecret;
  });

  it("atomically creates a TTL-friendly quota record without storing the raw UID or scope", async () => {
    const middleware = distributedQuota({ scope: "ai-generation", limit: 30, windowMs: 900_000 });

    await middleware({ user: { uid: "private-user-id" } } as never, res as never, next);

    expect(collection).toHaveBeenCalledWith("internal_api_quotas");
    expect(doc).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(doc).not.toHaveBeenCalledWith(expect.stringContaining("private-user-id"));
    expect(transactionSet).toHaveBeenCalledWith(expect.objectContaining({
      path: expect.stringMatching(/^internal_api_quotas\/[a-f0-9]{64}$/),
    }), expect.objectContaining({
      count: 1,
      windowStartedAt: expect.any(Date),
      updatedAt: expect.any(Date),
      expiresAt: expect.any(Date),
    }), { merge: true });
    expect(JSON.stringify(transactionSet.mock.calls[0][1])).not.toContain("private-user-id");
    expect(JSON.stringify(transactionSet.mock.calls[0][1])).not.toContain("ai-generation");
    expect(next).toHaveBeenCalledWith();
  });

  it("increments the shared counter when a record already exists", async () => {
    transactionGet.mockResolvedValue({ exists: true, data: () => ({ count: 8 }) });
    const middleware = distributedQuota({ scope: "photo-upload", limit: 30, windowMs: 900_000 });

    await middleware({ user: { uid: "member" } } as never, res as never, next);

    expect(transactionSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ count: 9 }), { merge: true });
    expect(next).toHaveBeenCalledWith();
  });

  it("fails closed with 429 and Retry-After when the distributed limit is reached", async () => {
    transactionGet.mockResolvedValue({ exists: true, data: () => ({ count: 10 }) });
    const middleware = distributedQuota({ scope: "video-sync", limit: 10, windowMs: 3_600_000 });

    await middleware({ user: { uid: "admin" } } as never, res as never, next);

    expect(transactionSet).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.stringMatching(/^\d+$/));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 429,
      code: "DISTRIBUTED_QUOTA_EXCEEDED",
    }));
  });

  it("fails closed for malformed stored counts and forwards transaction failures", async () => {
    transactionGet.mockResolvedValueOnce({ exists: true, data: () => ({ count: "corrupt" }) });
    const middleware = distributedQuota({ scope: "drive-sync", limit: 5, windowMs: 3_600_000 });
    await middleware({ user: { uid: "admin" } } as never, res as never, next);
    expect(transactionSet).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503, code: "QUOTA_STATE_INVALID" }));

    const failure = new Error("firestore unavailable");
    runTransaction.mockRejectedValueOnce(failure);
    await middleware({ user: { uid: "admin" } } as never, res as never, next);
    expect(next).toHaveBeenLastCalledWith(failure);
  });

  it("rejects missing identities, unavailable key material, and invalid configuration", async () => {
    const middleware = distributedQuota({ scope: "ai-generation", limit: 1, windowMs: 1_000 });
    await middleware({} as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 401 }));
    expect(runTransaction).not.toHaveBeenCalled();

    vi.clearAllMocks();
    delete process.env.ENCRYPTION_SECRET;
    await middleware({ user: { uid: "admin" } } as never, res as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 503, code: "QUOTA_UNAVAILABLE" }));

    expect(() => distributedQuota({ scope: "Invalid scope", limit: 0, windowMs: 1 })).toThrow(
      "Invalid distributed quota configuration.",
    );
    expect(() => distributedQuota({
      scope: "valid",
      limit: 1,
      windowMs: 1_000,
      retentionMs: -1,
    })).toThrow("Invalid distributed quota configuration.");
  });

  it("pseudonymizes normalized client addresses for shared anonymous quotas", async () => {
    process.env.ABUSE_HMAC_SECRET = "a-separate-abuse-hmac-key-that-is-long-enough";
    const middleware = distributedAnonymousQuota({ scope: "public-calendar", limit: 20, windowMs: 60_000 });

    await middleware({ ip: "::ffff:192.0.2.25" } as never, res as never, next);

    expect(doc).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(JSON.stringify(transactionSet.mock.calls)).not.toContain("192.0.2.25");
    expect(next).toHaveBeenCalledWith();
  });

  it("rejects an unavailable or malformed anonymous identity before Firestore work", async () => {
    process.env.ABUSE_HMAC_SECRET = "a-separate-abuse-hmac-key-that-is-long-enough";
    const middleware = distributedAnonymousQuota({ scope: "public-finance", limit: 20, windowMs: 60_000 });

    await middleware({ ip: "not-an-ip" } as never, res as never, next);

    expect(runTransaction).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      status: 503,
      code: "QUOTA_IDENTITY_UNAVAILABLE",
    }));
  });

  it("atomically reserves user, project, and weighted budgets", async () => {
    transactionGet.mockResolvedValue({ exists: true, data: () => ({ count: 5 }) });
    const middleware = distributedQuotas([
      { scope: "ai-user-daily", limit: 100, windowMs: 86_400_000 },
      { scope: "ai-project-daily", limit: 1_000, windowMs: 86_400_000, identity: "global" },
      { scope: "ai-token-daily", limit: 20_000, windowMs: 86_400_000, cost: () => 2_048 },
    ]);

    await middleware({ user: { uid: "member" }, body: { prompt: "help" } } as never, res as never, next);

    expect(transactionGet).toHaveBeenCalledTimes(3);
    expect(transactionSet).toHaveBeenCalledTimes(3);
    expect(transactionSet).toHaveBeenNthCalledWith(
      3,
      expect.anything(),
      expect.objectContaining({ count: 2_053 }),
      { merge: true },
    );
    expect(next).toHaveBeenCalledWith();
  });

  it("does not reserve any related budget when one shared ceiling is exceeded", async () => {
    transactionGet
      .mockResolvedValueOnce({ exists: true, data: () => ({ count: 3 }) })
      .mockResolvedValueOnce({ exists: true, data: () => ({ count: 10 }) });
    const middleware = distributedQuotas([
      { scope: "ai-user-daily", limit: 100, windowMs: 86_400_000 },
      { scope: "ai-project-daily", limit: 10, windowMs: 86_400_000, identity: "global" },
    ]);

    await middleware({ user: { uid: "member" } } as never, res as never, next);

    expect(transactionSet).not.toHaveBeenCalled();
    expect(res.setHeader).toHaveBeenCalledWith("Retry-After", expect.stringMatching(/^\d+$/));
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 429 }));
  });
});
