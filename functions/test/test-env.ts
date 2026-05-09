/**
 * Test utilities for Cloudflare Functions route handlers
 *
 * Provides mock environment, D1 database, and request helpers for testing Hono routes.
 */

import type { D1Database } from '@cloudflare/workers-types';
import type { Context } from 'hono';
import { Hono } from 'hono';
import type { AppEnv, DrizzleDB } from '../api/middleware';
import { errorHandlerMiddleware } from '../api/middleware/errorHandler';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../../src/db/schema';
import { Next } from 'hono';

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
 * Mock Drizzle query result - returns the data array directly
 * Use this for Drizzle .all() queries
 */
export function mockDrizzleResult<T>(data: T[]): { results: T[]; meta: { duration: number; last_row_id: number | null; changes: number; served_by: string } } {
  return {
    results: data,
    meta: {
      duration: 1,
      last_row_id: null,
      changes: 0,
      served_by: 'test',
    },
  };
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

  // Track prepare calls for debugging
  const prepareMock = vi.fn((_query: string) => {
    return {
      bind: vi.fn(() => {
        return {
          raw: vi.fn(() => ({ raw: true })),
          first: firstMock,
          all: allMock,
          run: runMock,
        };
      }),
      first: firstMock,
      all: allMock,
      run: runMock,
    };
  });

  const mockDb = {
    prepare: prepareMock,
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
export function createTestEnv(overrides: Partial<AppEnv['Bindings']> = {}): AppEnv['Bindings'] {
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
 * Test-specific dbMiddleware that creates a Drizzle instance from the mock D1 database.
 * Use this in tests to set up the db context variable that routes depend on.
 *
 * @example
 * ```ts
 * const app = new Hono<AppEnv>();
 * app.use('*', createTestDbMiddleware());
 * app.route('/api/auth', authRouter);
 * ```
 */
export function createTestDbMiddleware(mockDbOverride?: DrizzleDB, mockD1Db?: D1Database) {
  return async (c: Context<AppEnv>, next: Next) => {
    // Don't cache the db in tests - create a new instance each time
    let db: DrizzleDB;
    if (mockDbOverride) {
      db = mockDbOverride;
    } else {
      // Create a Drizzle instance from the mock D1 database
      // Note: This only works if the mock DB fully implements D1 API
      const dbToUse = mockD1Db || c.env.DB;
      db = drizzle(dbToUse, { schema }) as unknown as DrizzleDB;
    }
    c.set('db', db);
    await next();
  };
}

/**
 * Create a mock DrizzleDB for testing.
 * This provides a minimal implementation of the Drizzle query interface.
 *
 * @example
 * ```ts
 * const mockDb = createMockDrizzleDb();
 * vi.mocked(mockDb.select).mockReturnValue({...});
 * ```
 */
export function createMockDrizzleDb(): DrizzleDB {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(),
          all: vi.fn(),
          limit: vi.fn(() => ({ offset: vi.fn(() => ({ execute: vi.fn() })) })),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoUpdate: vi.fn(() => ({ run: vi.fn() })),
        onConflictDoNothing: vi.fn(() => ({ run: vi.fn() })),
        run: vi.fn(),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
          returning: vi.fn(),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(() => ({
        run: vi.fn(),
      })),
    })),
    query: {
      user: vi.fn(),
      session: vi.fn(),
    },
  } as unknown as DrizzleDB;
}

/**
 * Clear the cached test database. Call this in beforeEach if needed.
 */
export function clearTestDbCache() {
  // The cachedDb is local to each middleware instance, so this is a no-op
  // but kept for API compatibility if needed in the future
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
    param: (_name: string) => null,
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

/**
 * Create a base test Hono app with errorHandlerMiddleware and DB middleware pre-wired.
 *
 * This is the canonical way to create test apps. It ensures:
 * 1. errorHandlerMiddleware converts thrown ApiErrors to proper HTTP status codes
 * 2. The DB context variable is set so routes can call getDb(c)
 *
 * @example
 * ```ts
 * const app = createTestAppBase();
 * app.route('/api/social-queue', socialQueueRouter);
 * ```
 */
export function createTestAppBase(mockDrizzleDb?: DrizzleDB, mockD1Db?: D1Database): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.use('*', errorHandlerMiddleware);
  app.use('*', createTestDbMiddleware(mockDrizzleDb, mockD1Db));
  return app;
}

