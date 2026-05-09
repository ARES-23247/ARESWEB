/**
 * Test utilities for Cloudflare Functions route handlers
 *
 * Provides mock environment, D1 database, and request helpers for testing Hono routes.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Context } from 'hono';
import type { AppEnv } from '../api/middleware';

/**
 * Mock D1 result for single row queries
 */
export function mockSingleResult<T>(data: T | null): D1Result {
  const results = data ? [data as unknown as D1Result] : [];
  return {
    results,
    success: true,
    meta: {
      duration: 1,
      last_row_id: null,
      changes: 0,
      served_by: 'test',
    },
  } as unknown as D1Result;
}

/**
 * Mock D1 result for multiple row queries
 */
export function mockMultiResult<T>(data: T[]): D1Result {
  return {
    results: data as unknown as D1Result[],
    success: true,
    meta: {
      duration: 1,
      last_row_id: null,
      changes: 0,
      served_by: 'test',
    },
  } as unknown as D1Result;
}

/**
 * Mock D1 result for insert/update/delete operations
 */
export function mockMutationResult(changes: number, lastRowId: string | number = 'test-id'): D1Result {
  return {
    results: [],
    success: true,
    meta: {
      duration: 1,
      last_row_id: lastRowId.toString(),
      changes,
      served_by: 'test',
    },
  } as unknown as D1Result;
}

/**
 * Create a mock D1 database
 */
export function createMockDb() {
  const mockData = {
    user: new Map<string, unknown>(),
    badges: new Map<string, unknown>(),
    userBadges: new Map<string, unknown>(),
    posts: new Map<string, unknown>(),
    tasks: new Map<string, unknown>(),
  };

  const firstMock = vi.fn();
  const allMock = vi.fn();
  const runMock = vi.fn();

  // Setup mock data helper
  const setMockData = (table: string, id: string, data: unknown) => {
    (mockData[table as keyof typeof mockData] as Map<string, unknown>).set(id, data);
  };

  const getMockData = (table: string, id: string) => {
    return (mockData[table as keyof typeof mockData] as Map<string, unknown>).get(id);
  };

  const mockDb = {
    prepare: vi.fn((query: string) => {
      // Determine if this is a first, all, or run query based on the query string
      const isSelect = query.toLowerCase().includes('select');
      const isSingle = query.toLowerCase().includes('where') || query.toLowerCase().includes('limit 1');

      return {
        bind: vi.fn((...args: unknown[]) => {
          // For testing, return the first matching mock data
          if (isSelect && isSingle) {
            return {
              first: firstMock,
            };
          } else if (isSelect) {
            return {
              all: allMock,
            };
          } else {
            return {
              run: runMock,
            };
          }
        }),
      };
    }),
    batch: vi.fn(async (statements: unknown[]) =>
      statements.map(() => mockMutationResult(1))
    ),
    exec: vi.fn(async () => mockMutationResult(0)),
    _setMockData: setMockData,
    _getMockData: getMockData,
    _mockFirst: firstMock,
    _mockAll: allMock,
    _mockRun: runMock,
  } as unknown as D1Database & { _setMockData: typeof setMockData; _getMockData: typeof getMockData; _mockFirst: typeof firstMock; _mockAll: typeof allMock; _mockRun: typeof runMock };

  return { mockDb, mockData };
}

/**
 * Create test environment with minimal setup
 */
export function createTestEnv(overrides: Partial<AppEnv> = {}): AppEnv['Bindings'] {
  return {
    DB: createMockDb().mockDb as D1Database,
    ENVIRONMENT: 'test',
    DEV_BYPASS: 'true',
    TURNSTILE_SECRET: 'test-secret',
    RESEND_API_KEY: 'test-key',
    OPENAI_API_KEY: 'test-ai-key',
    GH_WEBHOOK_SECRET: 'test-webhook-secret',
    GCAL_SYNC_ENABLED: 'false',
    ZULIP_ENABLED: 'false',
    DISCORD_WEBHOOK_URL: '',
    CF_PAGES: 'false',
    ...overrides,
  } as AppEnv['Bindings'];
}

/**
 * Create a mock Hono context for testing route handlers
 */
export function createMockContext(
  path: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    body?: unknown;
    env?: Partial<AppEnv['Bindings']>;
  } = {}
): Context<AppEnv> {
  const { method = 'GET', headers = {}, body, env = {} } = options;

  const url = new URL(path, 'http://localhost');
  const mockEnv = createTestEnv(env);

  const mockReq = {
    method,
    url: url.href,
    path: url.pathname,
    header: (name: string) => headers[name.toLowerCase()] || headers[name] || null,
    headers: new Headers(headers),
    json: vi.fn().mockResolvedValue(body),
    text: vi.fn().mockResolvedValue(typeof body === 'string' ? body : JSON.stringify(body)),
    body: body ? JSON.stringify(body) : undefined,
    query: () => ({}),
    param: (name: string) => null,
    cookie: (name: string) => headers[name] || null,
    valid: vi.fn().mockReturnValue(body || {}),
  };

  const mockExecutionContext = {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;

  return {
    req: mockReq as never,
    env: mockEnv,
    executionCtx: mockExecutionContext,
    path: url.pathname,
    url: url.href,
    get: vi.fn(),
    set: vi.fn(),
    newResponse: vi.fn(),
    body: vi.fn(),
    json: vi.fn(),
    text: vi.fn(),
    redirect: vi.fn(),
    header: vi.fn(),
    status: vi.fn(),
  } as unknown as Context<AppEnv>;
}
