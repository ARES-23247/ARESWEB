import { vi } from "vitest";
import type { ChainableQuery, DbRows, MockFn } from "./testTypes";

export function createDrizzleMock(): ChainableQuery {
  const chainable: Record<string, MockFn> = {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    rightJoin: vi.fn().mockReturnThis(),
    fullJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    all: vi.fn().mockResolvedValue<DbRows>([]),
    get: vi.fn().mockResolvedValue<unknown>(null),
    run: vi.fn().mockResolvedValue({ success: true }),
    execute: vi.fn().mockResolvedValue<DbRows>([]),
  };

  // transaction callback is passed the mock itself so inner queries use it
  chainable.transaction = vi.fn(async (cb: (tx: ChainableQuery) => Promise<unknown>) => await cb(chainable as ChainableQuery));

  return chainable as ChainableQuery;
}
