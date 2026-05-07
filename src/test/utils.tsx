import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, RenderHookOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModalProvider } from "../contexts/ModalContext";
import { vi } from "vitest";
import type { MockExecutionContext } from "./types";

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
export function createMockDrizzle(defaultResolve: any = []) {
  const mockDb: any = {
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
    then: vi.fn((resolve) => resolve(defaultResolve)),
    transaction: vi.fn().mockImplementation(async (cb: any) => cb(mockDb)),
    batch: vi.fn().mockResolvedValue([]),
    all: vi.fn().mockResolvedValue(defaultResolve),
    run: vi.fn().mockResolvedValue({ success: true }),
    get: vi.fn().mockResolvedValue(defaultResolve[0] || null),
    query: new Proxy({}, {
      get: (target: any, prop: string) => {
        if (!target[prop]) {
          target[prop] = {
            findFirst: vi.fn().mockResolvedValue(null),
            findMany: vi.fn().mockResolvedValue([]),
          };
        }
        return target[prop];
      }
    })
  };
  return mockDb;
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
