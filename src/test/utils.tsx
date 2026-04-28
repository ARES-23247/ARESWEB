/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, RenderHookOptions } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ModalProvider } from "../contexts/ModalContext";
import { vi } from "vitest";

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
export const mockExecutionContext: any = {
  waitUntil: vi.fn((promise) => promise),
  passThroughOnException: vi.fn(),
};

/**
 * Awaits all promises passed to `mockExecutionContext.waitUntil` so far,
 * allowing background tasks in edge functions to finish before test assertions.
 */
export async function flushWaitUntil() {
  const promises = mockExecutionContext.waitUntil.mock.calls.map((call: any[]) => call[0]);
  mockExecutionContext.waitUntil.mockClear();
  await Promise.all(promises);
}

/**
 * Creates a unified, chainable Kysely ExpressionBuilder mock
 * which avoids coverage drops from missing internal builder methods.
 */
export function createMockExpressionBuilder() {
  const ebMock: any = vi.fn().mockReturnThis();
  const asMock = { as: vi.fn().mockReturnValue(ebMock) };
  
  ebMock.or = vi.fn().mockReturnThis();
  ebMock.and = vi.fn().mockReturnThis();
  ebMock.val = vi.fn().mockReturnThis();
  ebMock.fn = {
    count: vi.fn().mockReturnValue(asMock),
    sum: vi.fn().mockReturnValue(asMock),
    max: vi.fn().mockReturnValue(asMock),
    min: vi.fn().mockReturnValue(asMock),
    coalesce: vi.fn().mockReturnValue(asMock),
  };
  ebMock.case = vi.fn().mockReturnValue({
    when: vi.fn().mockReturnThis(),
    and: vi.fn().mockReturnThis(),
    then: vi.fn().mockReturnThis(),
    else: vi.fn().mockReturnThis(),
    end: vi.fn().mockReturnThis(),
  });
  ebMock.selectFrom = vi.fn().mockReturnThis();
  ebMock.select = vi.fn().mockReturnThis();
  ebMock.where = vi.fn().mockReturnThis();
  ebMock.execute = vi.fn().mockResolvedValue([]);
  return ebMock;
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
