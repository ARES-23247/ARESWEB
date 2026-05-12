/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ERROR HANDLING UTILITIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Custom error classes and global error handler for Hono routes.
 * Use with app.onError() for centralized error handling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { Context } from "hono";
import { ZodError } from "zod";
import type { AppEnv } from "./utils";
import { createErrorResponse, ErrorCode } from "../../../shared/errors/api";

/**
 * Valid HTTP status codes for API responses with JSON body
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
 * ─────────────────────────────────────────────────────────────────────────────
 * GLOBAL ERROR HANDLER
 * ─────────────────────────────────────────────────────────────────────────────
 * Use with Hono's app.onError() to catch thrown errors globally.
 *
 * @example
 * const app = new Hono<AppEnv>();
 * app.onError(globalErrorHandler);
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const globalErrorHandler = (err: Error, c: Context<AppEnv>): Response => {
  if (err instanceof ApiError) {
    const status = err.status as HttpStatus;
    const response = createErrorResponse(err.message, err.code, err.details);
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
