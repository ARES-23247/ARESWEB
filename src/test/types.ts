/**
 * Shared test type definitions for type-safe mocking.
 *
 * Provides typed interfaces for common test mocks:
 * - MockKysely: Type-safe database mocking
 * - TestEnv: Hono environment binding for tests
 * - MockExecutionContext: Cloudflare Workers ExecutionContext mock
 * - MockExpressionBuilder: Kysely ExpressionBuilder mock interface
 *
 * All types use vi.fn mock types and avoid `any` for compile-time safety.
 */

import type { vi, Mock } from "vitest";

// ── MockKysely ────────────────────────────────────────────────────────────────
/**
 * Partial Kysely interface for database mocks.
 *
 * Provides fluent chaining for the most commonly used Kysely methods in tests.
 * Each method returns a vi.fn mock configured with mockReturnThis() for chaining.
 *
 * @example
 * let mockDb: MockKysely;
 * beforeEach(() => {
 *   mockDb = {
 *     selectFrom: vi.fn().mockReturnThis(),
 *     execute: vi.fn().mockResolvedValue([]),
 *   };
 * });
 */
export type MockKysely = {
  selectFrom: ReturnType<typeof vi.fn>;
  insertInto: ReturnType<typeof vi.fn>;
  updateTable: ReturnType<typeof vi.fn>;
  deleteFrom: ReturnType<typeof vi.fn>;
  onConflict?: ReturnType<typeof vi.fn>;
  doUpdateSet?: ReturnType<typeof vi.fn>;
  /** Chain methods for fluent query building */
  innerJoin?: ReturnType<typeof vi.fn>;
  leftJoin?: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  selectAll?: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy?: ReturnType<typeof vi.fn>;
  limit?: ReturnType<typeof vi.fn>;
  offset?: ReturnType<typeof vi.fn>;
  groupBy?: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  /** Execution methods */
  execute: ReturnType<typeof vi.fn>;
  executeTakeFirst: ReturnType<typeof vi.fn>;
  run?: ReturnType<typeof vi.fn>;
  getExecutor?: ReturnType<typeof vi.fn>;
  fn?: unknown; // Kysely's function builder is complex to type accurately in mocks
};

// ── TestEnv ───────────────────────────────────────────────────────────────────
/**
 * Hono environment binding for tests.
 *
 * Defines the Variables and Bindings available in test contexts.
 * Use with Hono<TestEnv> for type-safe route handler testing.
 *
 * @example
 * let testApp: Hono<TestEnv>;
 * testApp.use("*", async (c, next) => {
 *   c.set("db", mockDb);
 *   c.set("sessionUser", mockUser);
 *   await next();
 * });
 */
export type TestEnv = {
  Variables: {
    db: MockKysely;
    sessionUser: {
      id: string;
      email: string;
      name: string | null;
      nickname?: string | null;
      image?: string | null;
      role: string;
      member_type: string;
    };
    socialConfig?: Record<string, string | undefined>;
    requestId?: string;
  };
  Bindings: {
    DEV_BYPASS?: string;
    DB: D1Database;
    ENVIRONMENT?: string;
    [key: string]: unknown;
  };
};

// ── MockExecutionContext ───────────────────────────────────────────────────────
/**
 * Cloudflare Workers ExecutionContext mock.
 *
 * Use for testing edge functions that use waitUntil() for background tasks.
 *
 * @example
 * import { mockExecutionContext, flushWaitUntil } from "~/src/test/utils";
 *
 * test("background task completes", async () => {
 *   await handler(c, mockExecutionContext);
 *   await flushWaitUntil(); // Awaits all waitUntil promises
 * });
 */
export interface MockExecutionContext extends ExecutionContext {
  /** Registers a promise to execute in the background */
  waitUntil: Mock<(promise: Promise<unknown>) => void | Promise<unknown>>;
  /** Passes through exceptions to the runtime */
  passThroughOnException: Mock<() => void>;
  /** Execution Context Props */
  props: Record<string, unknown>;
}

// ── MockExpressionBuilder ──────────────────────────────────────────────────────
/**
 * Kysely ExpressionBuilder mock interface.
 *
 * Provides a complete mock surface for Kysely's ExpressionBuilder,
 * used in select() callbacks for complex query building.
 *
 * @example
 * const eb = createMockExpressionBuilder();
 * select: vi.fn((args) => {
 *   if (Array.isArray(args)) {
 *     args.forEach((arg) => {
 *       if (typeof arg === "function") arg(eb);
 *     });
 *   }
 *   return mockDb;
 * }),
 */
export interface MockExpressionBuilder {
  // Boolean operators
  or: ReturnType<typeof vi.fn>;
  and: ReturnType<typeof vi.fn>;
  val: ReturnType<typeof vi.fn>;
  // Function helpers - use loose mock typing for flexibility
  fn: {
    count: ReturnType<typeof vi.fn> & { as: ReturnType<typeof vi.fn> };
    sum: ReturnType<typeof vi.fn> & { as: ReturnType<typeof vi.fn> };
    max: ReturnType<typeof vi.fn> & { as: ReturnType<typeof vi.fn> };
    min: ReturnType<typeof vi.fn> & { as: ReturnType<typeof vi.fn> };
    coalesce: ReturnType<typeof vi.fn> & { as: ReturnType<typeof vi.fn> };
    as: ReturnType<typeof vi.fn>;
  };
  // Case expressions - use loose mock typing for flexibility
  case: ReturnType<typeof vi.fn> & {
    when: ReturnType<typeof vi.fn>;
    and: ReturnType<typeof vi.fn>;
    then: ReturnType<typeof vi.fn>;
    else: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  // Query building
  selectFrom: ReturnType<typeof vi.fn>;
  select: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  execute: ReturnType<typeof vi.fn>;
  // Self-reference (callable)
  (...args: unknown[]): unknown;
}
