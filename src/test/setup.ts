import "@testing-library/jest-dom";
import { vi as _vi } from "vitest";
import { server } from "./mocks/server";

// Start MSW Server - runs immediately when setup file loads
server.listen({ onUnhandledRequest: "warn" });

// Reset handlers after each test to ensure test isolation
// Note: Test isolation handled by individual test suites

export { server };

// Mock jsdom missing methods
const scrollTo = () => {};
window.scrollTo = scrollTo;

// Mock Cloudflare-specific globals
// Full Cache API mock for Hono cache middleware - functional implementation
const cacheStores = new Map<string, Map<string, Response>>();

// Helper to reset cache between tests if needed
export const clearTestCache = () => cacheStores.clear();

(globalThis as unknown as { caches: unknown }).caches = {
  // caches.match() - direct matching across all caches
  match: async (key: string) => {
    for (const store of cacheStores.values()) {
      const response = store.get(key);
      if (response) return response;
    }
    return undefined;
  },
  // caches.open() - returns a Cache object that actually stores responses
  open: async (cacheName: string) => {
    if (!cacheStores.has(cacheName)) {
      cacheStores.set(cacheName, new Map());
    }
    const store = cacheStores.get(cacheName)!;
    return {
      match: async (key: string) => store.get(key),
      put: async (key: string, response: Response) => {
        store.set(key, response);
      },
      delete: async (key: string) => store.delete(key),
      keys: async () => Array.from(store.keys()),
    };
  },
  // caches.default - Cloudflare-style default cache (alias to first store)
  get default() {
    const defaultStore = cacheStores.get("default") || new Map();
    if (!cacheStores.has("default")) cacheStores.set("default", defaultStore);
    return {
      match: async (key: string) => defaultStore.get(key),
      put: async (key: string, response: Response) => defaultStore.set(key, response),
      delete: async (key: string) => defaultStore.delete(key),
    };
  },
};

// Mock ExecutionContext for Hono request testing
export const mockExecutionContext = {
  waitUntil: (_promise: Promise<unknown>) => _promise,
  passThroughOnException: () => {},
};

// AbortSignal compatibility note:
// There is a known incompatibility between jsdom's AbortSignal polyfill and
// MSW's node interceptor when using Request/AbortSignal.timeout in tests.
// This affects tests that use new Request() with signal parameters.
// Workaround: For affected tests, use direct fetch mocking instead of MSW.
// See: https://github.com/mswjs/msw/issues/1755
