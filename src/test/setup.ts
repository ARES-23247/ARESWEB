import "@testing-library/jest-dom";
import { vi } from "vitest";
import { server } from "./mocks/server";

// Mock drizzle-orm sql BEFORE any schema imports
// This must be hoisted to avoid "sql is not a function" errors when schema.ts is imported
// The mock needs to support both sql.raw() and sql`template` syntax
const mockSql = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
  sql: strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] ?? ''), ''),
  getSQL: () => strings.reduce((acc: string, str: string, i: number) => acc + str + (values[i] ?? ''), ''),
})) as ReturnType<typeof vi.fn> & { raw: (str: string) => { raw: string } };
(mockSql as ReturnType<typeof vi.fn> & { raw: (str: string) => { raw: string } }).raw = vi.fn((str: string) => ({ raw: str }));

vi.mock("drizzle-orm", () => {
  const relations = (..._args: unknown[]) => ({});
  const eq = (..._args: unknown[]) => ({});
  const and = (..._args: unknown[]) => ({});
  const or = (..._args: unknown[]) => ({});
  const not = (..._args: unknown[]) => ({});
  const desc = (..._args: unknown[]) => ({});
  const asc = (..._args: unknown[]) => ({});
  const ne = (..._args: unknown[]) => ({});
  const sql = mockSql;
  const exists = (..._args: unknown[]) => ({});
  const inArray = (..._args: unknown[]) => ({});
  const isNull = (..._args: unknown[]) => ({});
  const gt = (..._args: unknown[]) => ({});
  const gte = (..._args: unknown[]) => ({});
  const lt = (..._args: unknown[]) => ({});
  const lte = (..._args: unknown[]) => ({});
  const like = (..._args: unknown[]) => ({});
  const sql_EMPTY_ARRAY = [];

  return {
    sql,
    relations,
    eq,
    and,
    or,
    not,
    desc,
    asc,
    ne,
    exists,
    inArray,
    isNull,
    gt,
    gte,
    lt,
    lte,
    like,
    getPlaceholder: () => ({}),
    param: () => ({}),
    sql_EMPTY_ARRAY,
  };
});

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
