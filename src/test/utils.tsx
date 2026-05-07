import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, RenderHookOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
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
  const mockDb = {
    select: vi.fn().mockReturnThis(),
    selectDistinct: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockReturnThis(),
    onConflictDoNothing: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    having: vi.fn().mockReturnThis(),
    then: vi.fn().mockImplementation((resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => mockDb.all().then(resolve, reject)),
    transaction: vi.fn().mockImplementation(async (cb: (db: typeof mockDb) => Promise<unknown>) => cb(mockDb)),
    batch: vi.fn().mockResolvedValue([]),
    all: vi.fn().mockResolvedValue(defaultResolve),
    execute: vi.fn().mockResolvedValue(defaultResolve),
    run: vi.fn().mockResolvedValue({ success: true }),
    get: vi.fn().mockResolvedValue(defaultResolve[0] || null),
    $dynamic: vi.fn().mockReturnThis(),
    query: new Proxy({}, {
      get: (_target: unknown, _prop: string) => {
        return {
          findFirst: vi.fn().mockResolvedValue(null),
          findMany: vi.fn().mockResolvedValue([]),
        };
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

  const drizzleMethods: Partial<Record<string, ReturnType<typeof vi.fn>>> = {
    select: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = false;
      if ((dbMock as DrizzleMock).selectFrom) (dbMock as DrizzleMock).selectFrom!(...args);
      else if ((dbMock as DrizzleMock).select) (dbMock as DrizzleMock).select!(...args);
      return proxy;
    }),
    from: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
    all: vi.fn().mockImplementation(async (...args: unknown[]) => {
      if ((dbMock as DrizzleProxyTarget).execute) {
        return (dbMock as DrizzleProxyTarget).execute!(...args);
      }
      return Promise.resolve([]);
    }),
    get: vi.fn().mockImplementation(async (...args: unknown[]) => {
      if ((dbMock as DrizzleProxyTarget).executeTakeFirst) {
        return (dbMock as DrizzleProxyTarget).executeTakeFirst!(...args);
      }
      return Promise.resolve(null);
    }),
    run: vi.fn().mockImplementation(async (...args: unknown[]) => {
      if ((dbMock as DrizzleProxyTarget).execute) {
        return (dbMock as DrizzleProxyTarget).execute!(...args).then(() => ({ success: true, meta: { changes: 1 } }));
      }
      return Promise.resolve({ success: true, meta: { changes: 1 } });
    }),
    insert: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
      if ((dbMock as DrizzleMock).insertInto) (dbMock as DrizzleMock).insertInto!(...args);
      return proxy;
    }),
    update: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
      if ((dbMock as DrizzleMock).updateTable) (dbMock as DrizzleMock).updateTable!(...args);
      return proxy;
    }),
    delete: vi.fn().mockImplementation((...args: unknown[]) => {
      isMutation = true;
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
    returning: vi.fn().mockImplementation((..._args: unknown[]) => proxy),
  };

  const proxy = new Proxy(dbMock, {
    get(target, prop) {
      if (prop === 'transaction') {
        return vi.fn().mockImplementation(async (cb: (db: DrizzleProxy) => Promise<unknown>) => cb(proxy as DrizzleProxy));
      }
      if (prop === 'query') {
        return {
          userProfiles: { findFirst: vi.fn().mockResolvedValue(null) },
          teams: { findFirst: vi.fn().mockResolvedValue(null) },
          entities: { findFirst: vi.fn().mockResolvedValue(null) }
        };
      }
      if (prop === 'then') {
        return function(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          if (isMutation && (target as DrizzleProxyTarget).executeTakeFirst) {
            return (target as DrizzleProxyTarget).executeTakeFirst!()
              .then(() => ({ success: true, meta: { changes: 1 } }))
              .then(resolve, reject);
          } else if ((target as DrizzleProxyTarget).execute) {
            return (target as DrizzleProxyTarget).execute!().then(resolve, reject);
          }
          return Promise.resolve([]).then(resolve, reject);
        };
      }
      if (prop in drizzleMethods) {
        return drizzleMethods[prop as string];
      }
      return (target as DrizzleProxyTarget)[prop as string];
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

  const Wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={testQueryClient}>
      <MemoryRouter>
        <ModalProvider>
          {children}
        </ModalProvider>
      </MemoryRouter>
    </QueryClientProvider>
  );

  return renderHook(render, { wrapper: Wrapper, ...options });
}
