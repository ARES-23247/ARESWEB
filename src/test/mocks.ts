/**
 * Shared mock type definitions for type-safe testing.
 *
 * Provides typed interfaces for common test mocks to avoid using `any`.
 */

import type { Mock } from "vitest";

// ── DrizzleMock ───────────────────────────────────────────────────────────────────
/**
 * Input database mock interface for createDrizzleProxy.
 *
 * This represents the raw database mock that can be either:
 * - A Kysely-style mock with selectFrom, insertInto, etc.
 * - A Drizzle-style mock with select, insert, etc.
 */
export interface DrizzleMock {
  select?: Mock;
  selectFrom?: Mock;
  insert?: Mock;
  insertInto?: Mock;
  update?: Mock;
  updateTable?: Mock;
  delete?: Mock;
  deleteFrom?: Mock;
  execute?: Mock;
  executeTakeFirst?: Mock;
  values?: Mock;
  set?: Mock;
  limit?: Mock;
  offset?: Mock;
  where?: Mock;
  orderBy?: Mock;
  groupBy?: Mock;
  having?: Mock;
}

// ── DrizzleProxy ───────────────────────────────────────────────────────────────────
/**
 * Output proxy interface that wraps a database mock.
 *
 * This proxy provides chainable methods for Drizzle ORM queries
 * and can handle both Kysely and Drizzle-style database mocks.
 */
export interface DrizzleProxy extends DrizzleMock {
  select: Mock;
  selectDistinct: Mock;
  from: Mock;
  all: Mock;
  get: Mock;
  run: Mock;
  insert: Mock;
  update: Mock;
  delete: Mock;
  onConflictDoUpdate: Mock;
  onConflictDoNothing: Mock;
  leftJoin: Mock;
  innerJoin: Mock;
  values: Mock;
  set: Mock;
  limit: Mock;
  offset: Mock;
  where: Mock;
  orderBy: Mock;
  groupBy: Mock;
  having: Mock;
  returning: Mock;
  transaction: Mock;
  batch: Mock;
  $dynamic: Mock;
  execute: Mock;
  query: Record<string, { findFirst: Mock; findMany: Mock }>;
  then: Mock;
  __isDrizzleProxy: true;
  [key: string]: unknown;
}

// ── DrizzleProxyTarget ─────────────────────────────────────────────────────────────
/**
 * Extended interface for proxy target with additional methods.
 */
export interface DrizzleProxyTarget extends DrizzleMock {
  execute?: Mock;
  executeTakeFirst?: Mock;
  [key: string]: unknown;
}

// ── PromiseLike ───────────────────────────────────────────────────────────────────
/**
 * Promise then callback functions.
 */
export type ThenFn<R = unknown, T = unknown> = (value: T) => R | PromiseLike<R>;
export type CatchFn = (reason: unknown) => unknown;

// ── ExecutionContext Mock ───────────────────────────────────────────────────────────
/**
 * Mock waitUntil function signature.
 */
export type MockWaitUntil = (promise: Promise<unknown>) => void | Promise<unknown>;

// ── Test Environment Bindings ───────────────────────────────────────────────────────
/**
 * Mock environment bindings for Cloudflare Workers.
 */
export interface MockBindings {
  DEV_BYPASS?: string;
  ENVIRONMENT?: string;
  [key: string]: unknown;
}

// ── Route Handler Mocks ─────────────────────────────────────────────────────────────
/**
 * Mock Hono context variables.
 */
export interface MockContextVariables {
  db: DrizzleProxy;
  sessionUser?: {
    id: string;
    email: string;
    name: string | null;
    nickname?: string | null;
    image?: string | null;
    role: string;
    memberType: string;
  };
  socialConfig?: Record<string, string | undefined>;
  requestId?: string;
}

// ── Generic Mock Function ───────────────────────────────────────────────────────────
/**
 * Generic mock implementation callback.
 */
export type MockImplementation<T = unknown> = (...args: unknown[]) => T;

