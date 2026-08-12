import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const transactionGet = vi.fn();
  const transactionSet = vi.fn();
  const quotaRef = { path: "internal_api_quotas/opaque-document" };
  const doc = vi.fn(() => quotaRef);
  const collection = vi.fn(() => ({ doc }));
  const runTransaction = vi.fn(async (callback: (transaction: {
    get: typeof transactionGet;
    set: typeof transactionSet;
  }) => Promise<void>) => callback({ get: transactionGet, set: transactionSet }));
  return { transactionGet, transactionSet, quotaRef, doc, collection, runTransaction };
});

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: { collection: mocks.collection, runTransaction: mocks.runTransaction },
}));

import { distributedQuota } from "../distributedQuota";

describe("distributedQuota", () => {
  const originalEncryptionSecret = process.env.ENCRYPTION_SECRET;
  const { collection, doc, quotaRef, runTransaction, transactionGet, transactionSet } = mocks;
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
  });

  it("atomically creates a TTL-friendly quota record without storing the raw UID or scope", async () => {
    const middleware = distributedQuota({ scope: "ai-generation", limit: 30, windowMs: 900_000 });

    await middleware({ user: { uid: "private-user-id" } } as never, res as never, next);

    expect(collection).toHaveBeenCalledWith("internal_api_quotas");
    expect(doc).toHaveBeenCalledWith(expect.stringMatching(/^[a-f0-9]{64}$/));
    expect(doc).not.toHaveBeenCalledWith(expect.stringContaining("private-user-id"));
    expect(transactionSet).toHaveBeenCalledWith(quotaRef, expect.objectContaining({
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

    expect(transactionSet).toHaveBeenCalledWith(quotaRef, expect.objectContaining({ count: 9 }), { merge: true });
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
});
