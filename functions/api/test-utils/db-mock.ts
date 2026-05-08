import { vi } from "vitest";

// Mock database types - simplified to avoid complex circular types
type MockFn = ReturnType<typeof vi.fn>;

interface MockDbFunctions {
  all: MockFn;
  get: MockFn;
  run: MockFn;
  execute: MockFn;
  executeTakeFirst: MockFn;
  first: MockFn;
  [key: string]: MockFn;
}

interface ChainableQuery {
  select: MockFn & ChainableQuery;
  from: MockFn & ChainableQuery;
  where: MockFn & ChainableQuery;
  insert: MockFn & ChainableQuery;
  values: MockFn & ChainableQuery;
  update: MockFn & ChainableQuery;
  set: MockFn & ChainableQuery;
  delete: MockFn & ChainableQuery;
  limit: MockFn & ChainableQuery;
  offset: MockFn & ChainableQuery;
  orderBy: MockFn & ChainableQuery;
  returning: MockFn & ChainableQuery;
  transaction: MockFn;
  [key: string]: MockFn | ChainableQuery | unknown;
}

type MockDb = MockDbFunctions & ChainableQuery;

type MockMethodNames = 'mockResolvedValueOnce' | 'mockResolvedValue' | 'mockRejectedValueOnce' | 'mockRejectedValue';

export const createDbMock = () => {
  let chainable: MockDb;
  const resetDbMock = () => {
    const fns: MockDbFunctions = {
      all: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      run: vi.fn().mockResolvedValue({ success: true }),
      execute: vi.fn().mockResolvedValue([]),
      executeTakeFirst: vi.fn().mockResolvedValue(null),
      first: vi.fn().mockResolvedValue(null)
    };
    const methods: MockMethodNames[] = ['mockResolvedValueOnce', 'mockResolvedValue', 'mockRejectedValueOnce', 'mockRejectedValue'];
    // Use object with indexed access to avoid type issues with bound mock methods
    const orig: Record<string, Record<string, unknown>> = {} as Record<string, Record<string, unknown>>;
    for (const m of methods) {
      orig[m] = {
        all: fns.all[m].bind(fns.all),
        get: fns.get[m].bind(fns.get),
        run: fns.run[m].bind(fns.run),
        execute: fns.execute[m].bind(fns.execute),
        executeTakeFirst: fns.executeTakeFirst[m].bind(fns.executeTakeFirst),
        first: fns.first[m].bind(fns.first)
      };
    }
    const terminalsList = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
    for (const key of terminalsList) {
      for (const m of methods) {
        // Use a function that wraps the mock method properly
        (fns[key] as unknown as Record<string, unknown>)[m] = (...args: unknown[]) => {
          const terminals = ['all', 'get', 'run', 'execute', 'executeTakeFirst', 'first'] as const;
          for (const k of terminals) {
            if (typeof orig[m][k] === 'function') {
              (orig[m][k] as (...args: unknown[]) => unknown)(...args);
            }
          }
          return fns[key];
        };
      }
    }

    chainable = new Proxy(fns, {
      get: (target, prop) => {
        if (prop === 'then') return undefined;
        if (prop in target) {
          const fn = target[prop as keyof MockDbFunctions] as MockFn;
          // For terminal methods, return them as-is so they work correctly
          return fn;
        }
        if (prop === 'transaction') return vi.fn(async (cb: (tx: MockDb) => Promise<unknown>) => cb(chainable));
        // For chain methods, create mocks that return the chainable object
        (target[prop as string] as MockFn) = vi.fn().mockReturnValue(chainable);
        return target[prop as string];
      }
    }) as MockDb;
  };
  resetDbMock();
  return { getChainable: () => chainable, resetDbMock };
};
