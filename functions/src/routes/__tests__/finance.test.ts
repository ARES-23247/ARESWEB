import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
}));

vi.mock("../../lib/firebase-admin", () => {
  const queryChain = {
    orderBy: vi.fn(),
    limit: mocks.limit,
    startAfter: mocks.startAfter,
    get: mocks.get,
    doc: vi.fn(() => ({ get: vi.fn() })),
  };
  queryChain.orderBy.mockReturnValue(queryChain);
  mocks.limit.mockReturnValue(queryChain);
  mocks.startAfter.mockReturnValue(queryChain);
  return { adminDb: { collection: vi.fn(() => queryChain) } };
});

vi.mock("express-rate-limit", () => ({
  default: vi.fn(() => (_req: unknown, _res: unknown, next: () => void) => next()),
}));

import financeRouter from "../finance";

describe("public finance route", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns only explicitly public transaction fields", async () => {
    mocks.get.mockResolvedValue({
      docs: [{
        id: "tx-1",
        data: () => ({
          amount: 125,
          type: "income",
          category: "Sponsor",
          date: "2026-08-01",
          description: "Public description",
          seasonId: 2026,
          receiptUrl: "https://private.example/receipt",
          loggedBy: "student-uid",
        }),
      }],
    });

    const layer = financeRouter.stack.find((item) => item.route?.path === "/");
    const handler = layer!.route!.stack.at(-1)!.handle;
    const req = { query: {} } as never;
    const json = vi.fn();
    const next = vi.fn();

    await handler(req, { json } as never, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.limit).toHaveBeenCalledWith(51);
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
  });
});
