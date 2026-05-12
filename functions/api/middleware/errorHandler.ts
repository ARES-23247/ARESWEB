/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERROR HANDLER MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────────────────
 * Centralized error handling for Hono routes.
 * Catches errors and returns standardized error responses.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Context, Next } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "./utils";
import { createErrorResponse, ErrorCode } from "../../../shared/errors/api";

/**
 * Valid HTTP status codes for API responses with JSON body
 * Note: 204 No Content and 304 Not Modified are excluded because they're incompatible with c.json()
 */
type HttpStatus =
  | 200 | 201           // Success
  | 301 | 302           // Redirection
  | 400 | 401 | 403 | 404 | 409 | 422 | 429  // Client errors
  | 500 | 502 | 503 | 504;  // Server errors

/**
 * Custom API error class with status code
 *
 * @example
 * throw new ApiError("Post not found", 404, ErrorCode.NOT_FOUND);
 */
export class ApiError extends Error {
  constructor(
    public message: string,
    public status: number = 400,
    public code?: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Extract user-friendly error message from various error types
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return "An unexpected error occurred";
}

/**
 * Extract status code from various error types
 */
function getStatusCode(error: unknown): number {
  if (error instanceof ApiError || (error && typeof error === "object" && (error as any).name === "ApiError")) {
    return (error as ApiError).status;
  }
  if (error instanceof ZodError) {
    return 400;
  }
  return 500;
}

/**
 * Extract error code from various error types
 */
function getErrorCode(error: unknown): string | undefined {
  if (error instanceof ApiError || (error && typeof error === "object" && (error as any).name === "ApiError")) {
    return (error as ApiError).code;
  }
  if (error instanceof ZodError) {
    return ErrorCode.VALIDATION_ERROR;
  }
  return undefined;
}

/**
 * Extract details from various error types
 */
function getErrorDetails(error: unknown): unknown {
  if (error instanceof ApiError || (error && typeof error === "object" && (error as any).name === "ApiError")) {
    return (error as ApiError).details;
  }
  if (error instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".") || "value";
      details[key] = issue.message;
    }
    return details;
  }
  return undefined;
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERROR HANDLER MIDDLEWARE
 * ─────────────────────────────────────────────────────────────────────────────
 * Catches all errors thrown in route handlers and returns standardized responses.
 *
 * Usage:
 * 1. Add this middleware LAST in your middleware chain
 * 2. Throw ApiError instances for known error cases
 * 3. Let other errors bubble up for generic handling
 *
 * @example
 * router.use("*", errorHandlerMiddleware);
 * ─────────────────────────────────────────────────────────────────────────────
 */
export async function errorHandlerMiddleware(c: Context<AppEnv>, next: Next) {
  try {
    await next();
  } catch (error) {
    // Log the error for debugging
    console.error("[ErrorHandler]", {
      error: getErrorMessage(error),
      status: getStatusCode(error),
      code: getErrorCode(error),
      path: c.req.path,
      method: c.req.method,
    });

    // Return standardized error response
    const status = getStatusCode(error) as HttpStatus;
    const response = createErrorResponse(
      getErrorMessage(error),
      getErrorCode(error),
      getErrorDetails(error)
    );
    if (status >= 500) {
      console.error("Unhandled API Error returning 500:", error);
    }

    return c.json(response, status);
  }
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ASYNC ROUTE WRAPPER
 * ─────────────────────────────────────────────────────────────────────────────
 * Wraps async route handlers to catch errors and return standardized responses.
 * Use this when you want error handling at the route level instead of middleware.
 *
 * @example
 * router.get("/posts", asyncHandler(async (c) => {
 *   const posts = await db.select().from(postsTable);
 *   return c.json({ posts });
 * }));
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function asyncHandler<T extends Context<AppEnv>>(
  handler: (c: T) => Promise<Response>
) {
  return async (c: T) => {
    try {
      return await handler(c);
    } catch (error) {
      const status = getStatusCode(error) as HttpStatus;
      const response = createErrorResponse(
        getErrorMessage(error),
        getErrorCode(error),
        getErrorDetails(error)
      );
      return c.json(response, status);
    }
  };
}

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * PRE-CONFIGURED ERROR HELPERS
 * ─────────────────────────────────────────────────────────────────────────────
 * Convenience functions for throwing common errors
 * ─────────────────────────────────────────────────────────────────────────────
 */
/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL ERROR HANDLER (for app.onError())
 * ─────────────────────────────────────────────────────────────────────────────
 * Use with Hono's app.onError() to catch thrown errors globally.
 * This matches the production pattern from [[route]].ts.
 *
 * @example
 * const app = new Hono<AppEnv>();
 * app.onError(globalErrorHandler);
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const globalErrorHandler = (err: Error, c: Context<AppEnv>): Response => {
  if (err instanceof ApiError) {
    const status = err.status as HttpStatus;
    const response = createErrorResponse(
      err.message,
      err.code,
      err.details
    );
    return c.json(response, status);
  }

  if (err instanceof ZodError) {
    const details: Record<string, string> = {};
    for (const issue of err.issues) {
      const key = issue.path.join(".") || "value";
      details[key] = issue.message;
    }
    return c.json(createErrorResponse(err.message, ErrorCode.VALIDATION_ERROR, details), 400);
  }

  // Generic errors — return 500
  console.error("[GlobalErrorHandler]", err);
  return c.json(createErrorResponse("Internal Server Error"), 500);
};

export const throwErrors = {
  badRequest: (message: string, details?: unknown) => {
    throw new ApiError(message, 400, ErrorCode.VALIDATION_ERROR, details);
  },
  unauthorized: (message: string = "Unauthorized: Please log in") => {
    throw new ApiError(message, 401, ErrorCode.UNAUTHORIZED);
  },
  forbidden: (message: string = "Forbidden: Insufficient permissions") => {
    throw new ApiError(message, 403, ErrorCode.FORBIDDEN);
  },
  notFound: (resource: string = "Resource") => {
    throw new ApiError(`${resource} not found`, 404, ErrorCode.NOT_FOUND);
  },
  conflict: (message: string) => {
    throw new ApiError(message, 409, ErrorCode.CONFLICT);
  },
  internal: (message: string = "Internal server error") => {
    throw new ApiError(message, 500, ErrorCode.INTERNAL_SERVER_ERROR);
  },
} as const;
