import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  queryGet: vi.fn(),
  documentGet: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  orderBy: vi.fn(),
  doc: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => {
  const queryChain = {
    orderBy: mocks.orderBy,
    limit: mocks.limit,
    startAfter: mocks.startAfter,
    get: mocks.queryGet,
  };
  mocks.orderBy.mockReturnValue(queryChain);
  mocks.limit.mockReturnValue(queryChain);
  mocks.startAfter.mockReturnValue(queryChain);
  mocks.doc.mockImplementation(() => ({ get: mocks.documentGet }));
  return {
    adminDb: {
      collection: vi.fn(() => ({
        orderBy: mocks.orderBy,
        doc: mocks.doc,
      })),
    },
  };
});

vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

import financeRouter from "../finance";

function transaction(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    data: () => ({
      amount: 125,
      type: "income",
      category: "Sponsor",
      date: "2026-08-01",
      description: "Public description",
      seasonId: 2026,
      isDeleted: 0,
      status: "cleared",
      ...overrides,
    }),
  };
}

function routeHandler() {
  const layer = financeRouter.stack.find((item) => item.route?.path === "/");
  return layer!.route!.stack.at(-1)!.handle;
}

describe("public finance route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only explicit DTO fields and excludes every deleted or void representation", async () => {
    mocks.queryGet.mockResolvedValue({
      empty: false,
      docs: [
        transaction("tx-1", {
          receiptUrl: "https://private.example/receipt",
          loggedBy: "student-uid",
        }),
        transaction("tx-deleted-number", { isDeleted: 1 }),
        transaction("tx-deleted-boolean", { isDeleted: true }),
        transaction("tx-void", { status: " VOID " }),
      ],
    });

    const json = vi.fn();
    const next = vi.fn();
    await routeHandler()({ query: {} }, { json }, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(100);
    expect(json).toHaveBeenCalledWith({
      success: true,
      transactions: [{
        id: "tx-1",
        amount: 125,
        type: "income",
        category: "Sponsor",
        date: "2026-08-01",
        description: "Public description",
        seasonId: 2026,
      }],
      hasMore: false,
      nextCursor: null,
    });
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain("receiptUrl");
    expect(JSON.stringify(json.mock.calls[0][0])).not.toContain("student-uid");
  });

  it("scans past excluded records so filtered pages remain full and cursors do not skip records", async () => {
    const excluded = Array.from({ length: 100 }, (_, index) => transaction(`deleted-${index}`, { isDeleted: true }));
    mocks.queryGet
      .mockResolvedValueOnce({ empty: false, docs: excluded })
      .mockResolvedValueOnce({ empty: false, docs: [transaction("tx-1"), transaction("tx-2")] });

    const json = vi.fn();
    const next = vi.fn();
    await routeHandler()({ query: { limit: "1" } }, { json }, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.queryGet).toHaveBeenCalledTimes(2);
    expect(mocks.startAfter).toHaveBeenCalledWith(excluded.at(-1));
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      transactions: [expect.objectContaining({ id: "tx-1" })],
      hasMore: true,
      nextCursor: "tx-1",
    }));
  });

  it("rejects malformed and missing cursors", async () => {
    const next = vi.fn();
    await routeHandler()({ query: { cursor: "bad/cursor" } }, { json: vi.fn() }, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400, message: "Invalid finance cursor." }));

    next.mockClear();
    mocks.documentGet.mockResolvedValueOnce({ exists: false });
    await routeHandler()({ query: { cursor: "missing-cursor" } }, { json: vi.fn() }, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400, message: "Finance cursor was not found." }));
    expect(mocks.queryGet).not.toHaveBeenCalled();
  });
});
