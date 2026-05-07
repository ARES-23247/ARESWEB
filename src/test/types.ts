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

// ── MockDrizzle ────────────────────────────────────────────────────────────────
/**
 * Partial Drizzle ORM interface for database mocks.
 *
 * Provides fluent chaining for the most commonly used Drizzle methods in tests.
 * Each method returns a vi.fn mock configured with mockReturnThis() for chaining.
 */
export type MockDrizzle = {
  select: ReturnType<typeof vi.fn>;
  selectDistinct: ReturnType<typeof vi.fn>;
  from: ReturnType<typeof vi.fn>;
  insert: ReturnType<typeof vi.fn>;
  update: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
  values: ReturnType<typeof vi.fn>;
  set: ReturnType<typeof vi.fn>;
  returning: ReturnType<typeof vi.fn>;
  /** Chain methods for fluent query building */
  innerJoin: ReturnType<typeof vi.fn>;
  leftJoin: ReturnType<typeof vi.fn>;
  where: ReturnType<typeof vi.fn>;
  orderBy: ReturnType<typeof vi.fn>;
  limit: ReturnType<typeof vi.fn>;
  offset: ReturnType<typeof vi.fn>;
  groupBy: ReturnType<typeof vi.fn>;
  having: ReturnType<typeof vi.fn>;
  onConflictDoUpdate: ReturnType<typeof vi.fn>;
  onConflictDoNothing: ReturnType<typeof vi.fn>;
  /** Execution methods */
  then: ReturnType<typeof vi.fn>;
  batch: ReturnType<typeof vi.fn>;
  transaction: ReturnType<typeof vi.fn>;
  all: ReturnType<typeof vi.fn>;
  run: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  query: {
    [table: string]: {
      findFirst: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    }
  };
};

// ── TestEnv ───────────────────────────────────────────────────────────────────
/**
 * Hono environment binding for tests.
 *
 * Defines the Variables and Bindings available in test contexts.
 * Use with Hono<TestEnv> for type-safe route handler testing.
 */
export type TestEnv = {
  Variables: {
    db: MockDrizzle;
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
 */
export interface MockExecutionContext extends ExecutionContext {
  waitUntil: Mock<(promise: Promise<unknown>) => void | Promise<unknown>>;
  passThroughOnException: Mock<() => void>;
  props: Record<string, unknown>;
}
