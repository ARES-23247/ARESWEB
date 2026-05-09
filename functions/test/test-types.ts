/**
 * Shared type definitions for test files
 *
 * Provides common types used across test files to avoid
 * repetitive type definitions and 'any' usage.
 */

import type { AppEnv, SessionUser } from '../api/middleware';
import type { Context, Next } from 'hono';

// Extend globalThis for test mocks
declare global {
  var __mockSessionUser: SessionUser | null;
}

/**
 * Helper types for mock return values
 */
export type MockD1Result = {
  success?: boolean;
  results?: unknown[];
  meta: {
    duration: number;
    last_row_id?: string | number | null;
    changes?: number;
    served_by?: string;
  };
};

export type MockRoute = {
  path?: string;
  method?: string;
  handler?: unknown;
};

/**
 * Type for Hono middleware mock functions
 */
export type MockMiddlewareFn = (c: Context<AppEnv>, next: Next) => Promise<unknown> | unknown;
