import "@testing-library/jest-dom";
import { beforeAll, afterEach, afterAll, vi } from "vitest";
import { server } from "./mocks/server";

// Start MSW Server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));

// Reset handlers after each test to ensure test isolation
afterEach(() => server.resetHandlers());

// Close server after all tests
afterAll(() => server.close());

export { server };

// Mock jsdom missing methods
window.scrollTo = vi.fn();

// Mock Cloudflare-specific globals
vi.stubGlobal("caches", {
  default: {
    match: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
  open: vi.fn(),
});

// Mock ExecutionContext for Hono request testing
export const mockExecutionContext = {
  waitUntil: vi.fn((promise) => promise),
  passThroughOnException: vi.fn(),
};
