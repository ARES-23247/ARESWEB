import { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, RenderHookOptions } from "@testing-library/react";
import { RouterProvider, createRouter, createMemoryHistory, createRootRoute } from "@tanstack/react-router";
import { ModalProvider } from "../contexts/ModalContext";
import { vi } from "vitest";
import type { MockExecutionContext, MockDrizzle } from "./types";
import type { DrizzleProxy, DrizzleMock, DrizzleProxyTarget } from "./mocks";

// We mock the confirm globally for tests that use the provider to avoid blocking
vi.mock("../contexts/ModalContext", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../contexts/ModalContext")>();
  return {
    ...actual,
    useModal: () => ({
      confirm: async () => true, // Auto-confirm
      prompt: async () => "test-prompt-value",
    }),
  };
});

// Mock hooks that are used in almost every dashboard test
// (Removed global mock as it interferes with testing the hook itself)

// Mock ExecutionContext for Hono request testing
export const mockExecutionContext: MockExecutionContext = {
  waitUntil: vi.fn((promise: Promise<unknown>) => promise) as unknown as MockExecutionContext["waitUntil"],
  passThroughOnException: vi.fn() as unknown as MockExecutionContext["passThroughOnException"],
  props: {},
};

/**
 * Awaits all promises passed to `mockExecutionContext.waitUntil` so far,
 * allowing background tasks in edge functions to finish before test assertions.
 */
export async function flushWaitUntil() {
  const calls = mockExecutionContext.waitUntil.mock.calls as unknown as ReadonlyArray<readonly [Promise<unknown>]>;
  const promises = calls.map((call) => call[0]);
  mockExecutionContext.waitUntil.mockClear();
  await Promise.all(promises);
}

/**
 * Creates a unified, chainable Drizzle ORM mock
 * which avoids coverage drops from missing internal builder methods.
 */
export function createMockDrizzle<T = unknown>(defaultResolve: T[] = []): MockDrizzle & DrizzleProxy {
  // Track which terminal method was called
  let terminalMethod: 'get' | 'all' | 'run' | null = null;
  let isMutation = false;

  // Create the mock functions with default implementations
  const allMock = vi.fn(() => { terminalMethod = 'all'; return Promise.resolve(defaultResolve); });
  const executeMock = vi.fn(() => { terminalMethod = 'all'; return Promise.resolve(defaultResolve); });
  const runMock = vi.fn(() => { terminalMethod = 'run'; return Promise.resolve({ success: true, meta: { changes: 1 } }); });
  const getMock = vi.fn(() => { terminalMethod = 'get'; return Promise.resolve(defaultResolve[0] || null); });
  const executeTakeFirstMock = vi.fn(() => { terminalMethod = 'get'; return Promise.resolve(defaultResolve[0] || null); });

  const resetTerminalState = () => {
    const method = terminalMethod;
    terminalMethod = null;
    const mutation = isMutation;
    isMutation = false;
    return { method, isMutation: mutation };
  };

  const mockDb = {
    select: vi.fn().mockImplementation(function(this: typeof mockDb) {
      isMutation = false;
      terminalMethod = null;
      return this;
    }),
    selectDistinct: vi.fn().mockImplementation(function(this: typeof mockDb) {
      isMutation = false;
      terminalMethod = null;
      return this;
    }),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockImplementation(function(this: typeof mockDb, cb: (eb: Record<string, ReturnType<typeof vi.fn>>) => void) {
      if (typeof cb === 'function') {
        const ebMock = Object.assign(vi.fn().mockReturnThis(), { or: vi.fn().mockReturnThis(), and: vi.fn().mockReturnThis(), not: vi.fn().mockReturnThis() }) as unknown as Record<string, ReturnType<typeof vi.fn>>;
        cb(ebMock);
      }
      return this;
    }),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockImplementation(function(this: typeof mockDb) {
      isMutation = true;
      terminalMethod = null;
      return this;
    }),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockImplementation(function(this: typeof mockDb) {
      isMutation = true;
      terminalMethod = null;
      return this;
    }),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockImplementation(function(this: typeof mockDb) {
      isMutation = true;
      terminalMethod = null;
      return this;
    }),
    returning: vi.fn().mockImplementation(function(this: typeof mockDb) {
      terminalMethod = 'run';
      return this;
    }),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation(function(this: typeof mockDb, resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
      const state = resetTerminalState();
      if (state.method === 'get') {
        return getMock().then(resolve, reject);
      }
      if (state.method === 'run' || state.isMutation) {
        return runMock().then(resolve, reject);
      }
      // Default to 'all' or execute
      return allMock().then(resolve, reject);
    }),
    transaction: vi.fn().mockImplementation(async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb)),
    batch: vi.fn().mockResolvedValue([]),
    all: allMock,
    execute: executeMock,
    run: runMock,
    get: getMock,
    executeTakeFirst: executeTakeFirstMock,
    $dynamic: vi.fn().mockReturnThis(),
    query: new Proxy({} as Record<string, { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }>, {
      get: (target: Record<string, { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }>, prop: string) => {
        if (!(prop in target)) {
          target[prop] = {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return target[prop];
      }
    }),
    // Proxy marker for identification
    __isDrizzleProxy: true,
  } as MockDrizzle & DrizzleProxy;
  return mockDb;
}

/**
 * Creates a Drizzle proxy that wraps a database mock.
 *
 * This proxy provides chainable methods for Drizzle ORM queries
 * and can handle both Kysely and Drizzle-style database mocks.
 */
export function createDrizzleProxy(dbMock: DrizzleMock | DrizzleProxy | null): DrizzleProxy | null {
  if (!dbMock) return dbMock;
  if ((dbMock as DrizzleProxy).__isDrizzleProxy) return dbMock as DrizzleProxy;

  let isMutation = false;
  // Track which terminal method was called (get, all, or run) to use correct execution
  let terminalMethod: 'get' | 'all' | 'run' | null = null;

  const drizzleMethods: Partial<Record<string, ReturnType<typeof vi.fn>>> = {
    select: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = false;
      terminalMethod = null;
      if ((dbMock as DrizzleMock).selectFrom) (dbMock as DrizzleMock).selectFrom!(...args);
      else if ((dbMock as DrizzleMock).select) (dbMock as DrizzleMock).select!(...args);
      return proxy;
    }),
    from: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
    all: vi.fn().mockImplementation((...args: unknown[]) => {
      terminalMethod = 'all';
      // Directly call through to the underlying mock's all method
      if ('all' in dbMock && typeof dbMock.all === 'function') {
        return (dbMock.all as (...a: unknown[]) => unknown)(...args);
      }
      if ((dbMock as DrizzleProxyTarget).execute) {
        return (dbMock as DrizzleProxyTarget).execute!(...args);
      }
      return Promise.resolve([]);
    }),
    get: vi.fn().mockImplementation((...args: unknown[]) => {
      terminalMethod = 'get';
      // Directly call through to the underlying mock's get method
      // Don't wrap or intercept - just return the result
      if ('get' in dbMock && typeof dbMock.get === 'function') {
        return (dbMock.get as (...a: unknown[]) => unknown)(...args);
      }
      if ((dbMock as DrizzleProxyTarget).executeTakeFirst) {
        return (dbMock as DrizzleProxyTarget).executeTakeFirst!(...args);
      }
      return Promise.resolve(null);
    }),
    run: vi.fn().mockImplementation((...args: unknown[]) => {
      terminalMethod = 'run';
      // Directly call through to the underlying mock's run method
      if ('run' in dbMock && typeof dbMock.run === 'function') {
        return (dbMock.run as (...a: unknown[]) => unknown)(...args);
      }
      if ((dbMock as DrizzleProxyTarget).execute) {
        return (dbMock as DrizzleProxyTarget).execute!(...args).then(() => ({ success: true, meta: { changes: 1 } }));
      }
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }),
    insert: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
      terminalMethod = null;
      if ((dbMock as DrizzleMock).insertInto) (dbMock as DrizzleMock).insertInto!(...args);
      return proxy;
    }),
    update: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
      terminalMethod = null;
      if ((dbMock as DrizzleMock).updateTable) (dbMock as DrizzleMock).updateTable!(...args);
      return proxy;
    }),
    delete: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
      terminalMethod = null;
      if ((dbMock as DrizzleMock).deleteFrom) (dbMock as DrizzleMock).deleteFrom!(...args);
      return proxy;
    }),
    onConflictDoUpdate: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
    leftJoin: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
    innerJoin: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
    values: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).values) (dbMock as DrizzleMock).values!(...args);
      return proxy;
    }),
    set: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).set) (dbMock as DrizzleMock).set!(...args);
      return proxy;
    }),
    limit: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).limit) (dbMock as DrizzleMock).limit!(...args);
      return proxy;
    }),
    where: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).where) (dbMock as DrizzleMock).where!(...args);
      return proxy;
    }),
    orderBy: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).orderBy) (dbMock as DrizzleMock).orderBy!(...args);
      return proxy;
    }),
    offset: vi.fn().mockImplementation((...args: unknown[]) => {
      if ((dbMock as DrizzleMock).offset) (dbMock as DrizzleMock).offset!(...args);
      return proxy;
    }),
    returning: vi.fn().mockImplementation((..._args: unknown[]) => {
      terminalMethod = 'run';
      return proxy;
    }),
    execute: vi.fn().mockImplementation(async (...args: unknown[]) => {
      if ((dbMock as DrizzleProxyTarget).execute) {
        return (dbMock as DrizzleProxyTarget).execute!(...args);
      }
      return Promise.resolve([]);
    }),
  };

  // Cache query table accessors so mock setups persist between test setup and handler execution
  const queryCache: Record<string, { findFirst: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn> }> = {};
  const queryProxy = new Proxy({}, {
    get: (_t: unknown, tableName: string) => {
      if (!(tableName in queryCache)) {
        queryCache[tableName] = {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        };
      }
      return queryCache[tableName];
    }
  });

  const proxy = new Proxy(dbMock, {
    get(target, prop) {
      if (prop === 'transaction') {
        return vi.fn().mockImplementation(async (cb: (db: DrizzleProxy) => Promise<unknown>) => cb(proxy as DrizzleProxy));
      }
      if (prop === 'query') {
        return queryProxy;
      }
      if (prop === 'then') {
        return function(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          // If a terminal method was explicitly called, use its result
          if (terminalMethod === 'get') {
            if ('get' in target && typeof target.get === 'function') {
              const result = (target.get as () => unknown)();
              if (result && typeof (result as Promise<unknown>).then === 'function') {
                return (result as Promise<unknown>).then(resolve, reject);
              }
            }
            if ((target as DrizzleProxyTarget).executeTakeFirst) {
              return (target as DrizzleProxyTarget).executeTakeFirst!().then(resolve, reject);
            }
            return Promise.resolve(null).then(resolve, reject);
          }
          if (terminalMethod === 'all') {
            if ('all' in target && typeof target.all === 'function') {
              const result = (target.all as () => unknown)();
              if (result && typeof (result as Promise<unknown>).then === 'function') {
                return (result as Promise<unknown>).then(resolve, reject);
              }
            }
            if ((target as DrizzleProxyTarget).execute) {
              return (target as DrizzleProxyTarget).execute!().then(resolve, reject);
            }
            return Promise.resolve([]).then(resolve, reject);
          }
          if (terminalMethod === 'run' || isMutation) {
            if ('run' in target && typeof target.run === 'function') {
              const result = (target.run as () => unknown)();
              if (result && typeof (result as Promise<unknown>).then === 'function') {
                return (result as Promise<unknown>).then(resolve, reject);
              }
            }
            if ((target as DrizzleProxyTarget).executeTakeFirst) {
              return (target as DrizzleProxyTarget).executeTakeFirst!()
                .then(() => ({ success: true, meta: { changes: 1 } }))
                .then(resolve, reject);
            }
            return Promise.resolve({ success: true, meta: { changes: 1 } }).then(resolve, reject);
          }
          // Default to 'all' for select queries
          if ('all' in target && typeof target.all === 'function') {
            const result = (target.all as () => unknown)();
            if (result && typeof (result as Promise<unknown>).then === 'function') {
              return (result as Promise<unknown>).then(resolve, reject);
            }
          }
          if ((target as DrizzleProxyTarget).execute) {
            return (target as DrizzleProxyTarget).execute!().then(resolve, reject);
          }
          return Promise.resolve([]).then(resolve, reject);
        };
      }
      if (prop in drizzleMethods) {
        return drizzleMethods[prop as string];
      }
      // For chainable Drizzle methods not explicitly listed ($dynamic, groupBy, etc.)
      // return a function that returns the proxy itself
      const targetProp = (target as DrizzleProxyTarget)[prop as string];
      if (targetProp !== undefined) return targetProp;
      return (..._args: unknown[]) => proxy;
    }
  }) as unknown as DrizzleProxy;

  (proxy as DrizzleProxy).__isDrizzleProxy = true;
  return proxy;
}

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

export function renderWithProviders<Result, Props>(
  render: (initialProps: Props) => Result,
  options?: RenderHookOptions<Props>
) {
  const testQueryClient = createTestQueryClient();

  const Wrapper = ({ children }: { children: ReactNode }) => {
    const rootRoute = createRootRoute({
      component: () => <>{children}</>
    });
    const router = createRouter({
      routeTree: rootRoute,
      history: createMemoryHistory(),
    });

    return (
      <QueryClientProvider client={testQueryClient}>
        <RouterProvider router={router} />
        <ModalProvider>
          {children}
        </ModalProvider>
      </QueryClientProvider>
    );
  };

  return renderHook(render, { wrapper: Wrapper, ...options });
}

