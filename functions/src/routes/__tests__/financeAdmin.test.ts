import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  orderBy: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  startAfter: vi.fn().mockReturnThis(),
  get: vi.fn(),
  docGet: vi.fn(),
  set: vi.fn(),
  update: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn(() => ({
      orderBy: mocks.orderBy,
      limit: mocks.limit,
      startAfter: mocks.startAfter,
      get: mocks.get,
      doc: vi.fn(() => ({ get: mocks.docGet, set: mocks.set, update: mocks.update })),
    })),
  },
}));

import financeRouter from "../finance";

function handler(path: string, method: string) {
  const layer = financeRouter.stack.find(
    (entry) =>
      entry.route &&
      entry.route.path === path &&
      (entry.route as unknown as { methods: Record<string, unknown> }).methods[method],
  );
  if (!layer) throw new Error(`route ${method} ${path} not found`);
  return layer.route!.stack.at(-1)!.handle;
}

describe("finance admin API", () => {
  let req: { body?: unknown; params?: Record<string, string>; user?: { uid: string } };
  let res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> };
  let next: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.get.mockResolvedValue({ docs: [] });
    mocks.docGet.mockResolvedValue({ exists: false });
    req = { body: {}, params: {}, user: { uid: "admin-uid" } };
    res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() };
    next = vi.fn();
  });

  it("creates a validated transaction and records the actor", async () => {
    req.body = {
      date: "2026-08-01",
      amount: 123.45,
      type: "expense",
      category: "Parts",
      description: "REV hubs",
      seasonId: 2026,
      receiptUrl: "https://drive.example/receipt-1",
    };
    await handler("/admin", "post")(req, res, next);

    expect(mocks.set).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-08-01",
        amount: 123.45,
        type: "expense",
        receiptUrl: "https://drive.example/receipt-1",
        recordedBy: "admin-uid",
        isDeleted: 0,
      }),
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
    expect(next).not.toHaveBeenCalled();
  });

  it("updates an existing transaction instead of duplicating it", async () => {
    mocks.docGet.mockResolvedValue({ exists: true });
    req.body = { id: "fin_1", date: "2026-08-01", amount: 10, description: "Correction" };
    await handler("/admin", "post")(req, res, next);

    expect(mocks.set).not.toHaveBeenCalled();
    expect(mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({ id: "fin_1", description: "Correction" }),
    );
  });

  it("rejects malformed dates, non-positive or over-precise amounts, and http receipts", async () => {
    req.body = { date: "08/01/2026", amount: 10, description: "x" };
    await handler("/admin", "post")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    req.body = { date: "2026-08-01", amount: 0, description: "x" };
    await handler("/admin", "post")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));

    req.body = { date: "2026-08-01", amount: 10.999, description: "x" };
    await handler("/admin", "post")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));

    req.body = { date: "2026-08-01", amount: 10, description: "x", receiptUrl: "http://insecure/receipt" };
    await handler("/admin", "post")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400 }));
    expect(mocks.set).not.toHaveBeenCalled();
  });

  it("lists the admin ledger with receipts and lifecycle state", async () => {
    mocks.get.mockResolvedValue({
      docs: [
        {
          id: "fin_void",
          data: () => ({ date: "2026-07-01", amount: 5, description: "Dup", status: "void", isDeleted: 0, receiptUrl: "https://drive.example/r" }),
        },
      ],
    });
    await handler("/admin", "get")(req, res, next);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      transactions: [expect.objectContaining({ id: "fin_void", status: "void", receiptUrl: "https://drive.example/r" })],
    });
  });

  it("archives and restores by id, rejecting unsafe and missing ids", async () => {
    mocks.docGet.mockResolvedValue({ exists: true });
    req.params = { id: "fin_1" };
    await handler("/admin/:id", "delete")(req, res, next);
    expect(mocks.update).toHaveBeenCalledWith(expect.objectContaining({ isDeleted: 1 }));

    await handler("/admin/:id/restore", "patch")(req, res, next);
    expect(mocks.update).toHaveBeenLastCalledWith(expect.objectContaining({ isDeleted: 0 }));

    req.params = { id: "../evil" };
    await handler("/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));

    mocks.docGet.mockResolvedValue({ exists: false });
    req.params = { id: "fin_missing" };
    await handler("/admin/:id", "delete")(req, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 404 }));
  });
});
