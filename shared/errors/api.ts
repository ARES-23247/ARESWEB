/**
 * ─────────────────────────────────────────────────────────────────────────────
 * API ERROR RESPONSE UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Helper functions for creating standardized error responses in Hono routes.
 // eslint-disable-next-line @typescript-eslint/no-explicit-any
 * These functions eliminate the need for `as any` type assertions.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { Context } from "hono";
import type { ApiError } from "../routes/common";
import { ErrorCode } from "../routes/common";

// Re-export ErrorCode for convenience
export { ErrorCode };

/**
 * Creates a standardized error response object
 */
export function createErrorResponse(
  error: string,
  code?: string,
  details?: unknown
): ApiError {
  const response: ApiError = { error };
  if (code) response.code = code;
  if (details !== undefined) response.details = details;
  return response;
}

/**
 * Returns a JSON error response with the given status code
 *
 * @example
 * return errorResponse(c, "Post not found", 404, ErrorCode.NOT_FOUND);
 */
export function errorResponse<T extends Context>(
  c: T,
  message: string,
  status: 400 | 401 | 403 | 404 | 409 | 429 | 500,
  code?: string,
  details?: unknown
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return c.json(createErrorResponse(message, code, details), status);
}

/**
 * Pre-configured error responses for common scenarios
 */
export const errorResponses = {
  /**
   * Bad Request (400) - Invalid input or validation error
   */
  badRequest: (c: Context, message: string = "Bad Request", details?: unknown) =>
    errorResponse(c, message, 400, ErrorCode.VALIDATION_ERROR, details),

  /**
   * Unauthorized (401) - Authentication required
   */
  unauthorized: (c: Context, message: string = "Unauthorized: Please log in") =>
    errorResponse(c, message, 401, ErrorCode.UNAUTHORIZED),

  /**
   * Forbidden (403) - Insufficient permissions
   */
  forbidden: (c: Context, message: string = "Forbidden: Insufficient permissions") =>
    errorResponse(c, message, 403, ErrorCode.FORBIDDEN),

  /**
   * Not Found (404) - Resource does not exist
   */
  notFound: (c: Context, resource: string = "Resource") =>
    errorResponse(c, `${resource} not found`, 404, ErrorCode.NOT_FOUND),

  /**
   * Conflict (409) - Resource already exists or state conflict
   */
  conflict: (c: Context, message: string = "Conflict") =>
    errorResponse(c, message, 409, ErrorCode.CONFLICT),

  /**
   * Too Many Requests (429) - Rate limit exceeded
   */
  tooManyRequests: (c: Context, message: string = "Too many requests. Please try again later.") =>
    errorResponse(c, message, 429, ErrorCode.RATE_LIMIT_EXCEEDED),

  /**
   * Internal Server Error (500) - Server-side error
   */
  internalError: (c: Context, message: string = "Internal server error") =>
    errorResponse(c, message, 500, ErrorCode.INTERNAL_SERVER_ERROR),
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * VALIDATION ERROR HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Helpers for creating zod-compatible validation error responses
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Format zod validation errors into a standardized details object
 */
export function formatZodError(zodError: {
  errors: Array<{ path: Array<string | number>; message: string }>;
}): Record<string, string> {
  const details: Record<string, string> = {};
  for (const error of zodError.errors) {
    const key = error.path.join(".") || "value";
    details[key] = error.message;
  }
  return details;
}

/**
 * Creates a validation error response from zod error details
 */
export function validationErrorResponse(
  c: Context,
  validationErrors: Record<string, string>
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  return c.json(
    createErrorResponse("Validation failed", ErrorCode.VALIDATION_ERROR, validationErrors),
    400
  );
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ROUTE RESPONSE HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Type-safe response helpers that work with Hono's OpenAPI integration
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Creates a success response (200, 201, etc.)
 *
 * @example
 * return successResponse(c, { id: "123", name: "Post" }, 201);
 */
export function successResponse<T extends Context, D>(
  c: T,
  data: D,
  status: 200 | 201 | 202 | 204 = 200
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return c.json(data, status as any);
}

/**
 * Creates a paginated list response
 *
 * @example
 * return paginatedResponse(c, items, 10, 0, 50);
 */
export function paginatedResponse<T extends Context, D>(
  c: T,
  items: D[],
  limit: number,
  offset: number,
  total?: number
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): any {
  const response: {
    items: D[];
    limit: number;
    offset: number;
    hasMore: boolean;
    total?: number;
  } = {
    items,
    limit,
    offset,
    hasMore: total !== undefined ? offset + limit < total : items.length === limit,
  };
  if (total !== undefined) {
    response.total = total;
  }
  return c.json(response, 200);
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASYNC RESULT TYPE
 * ─────────────────────────────────────────────────────────────────────────────
 * Use this pattern to avoid try-catch boilerplate in route handlers
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

/**
 * Wrap an async operation in a Result type
 *
 * @example
 * const result = await fromAsync(() => db.select().from(posts).where(eq(posts.slug, slug)).get());
 * if (!result.success) {
 *   return errorResponses.internalError(c, "Failed to fetch post");
 * }
 * const post = result.data;
 */
export async function fromAsync<T, E = Error>(
  fn: () => Promise<T>
): Promise<Result<T, E>> {
  try {
    return { success: true, data: await fn() };
  } catch (error) {
    return { success: false, error: error as E };
  }
}

/**
 * Sync version of fromAsync
 */
export function fromSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    return { success: true, data: fn() };
  } catch (error) {
    return { success: false, error: error as E };
  }
}
