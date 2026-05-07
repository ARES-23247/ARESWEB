import "@testing-library/jest-dom";
import { server } from "./mocks/server";

// Start MSW Server
server.listen({ onUnhandledRequest: "warn" });

// Reset handlers after each test to ensure test isolation
// Note: Test isolation handled by individual test suites

export { server };

// Mock jsdom missing methods
const scrollTo = () => {};
window.scrollTo = scrollTo;

// Mock Cloudflare-specific globals
// Full Cache API mock for Hono cache middleware
(globalThis as unknown as { caches: unknown }).caches = {
  // caches.match() - direct matching across all caches
  match: () => Promise.resolve(undefined),
  // caches.open() - returns a Cache object
  open: () => Promise.resolve({
    match: () => Promise.resolve(undefined),
    put: () => Promise.resolve(undefined),
    delete: () => Promise.resolve(undefined),
    keys: () => Promise.resolve([]),
  }),
  // caches.default - Cloudflare-style default cache
  default: {
    match: () => Promise.resolve(undefined),
    put: () => Promise.resolve(undefined),
    delete: () => Promise.resolve(undefined),
  },
};

// Mock ExecutionContext for Hono request testing
export const mockExecutionContext = {
  waitUntil: (promise: Promise<unknown>) => promise,
  passThroughOnException: () => {},
};
