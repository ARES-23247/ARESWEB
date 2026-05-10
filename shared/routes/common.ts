import { z } from "@hono/zod-openapi";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STANDARD ERROR RESPONSE TYPES
 * ─────────────────────────────────────────────────────────────────────────────
 * All API errors MUST follow this format for consistent client-side handling.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Standard error response schema
 * - `error`: Human-readable error message (required)
 * - `code`: Machine-readable error code for programmatic handling (optional)
 * - `details`: Additional context for validation errors or debugging (optional)
 */
export const ErrorSchema = z.object({
  error: z.string().openapi({
    description: "Human-readable error message",
    example: "Resource not found",
  }),
  code: z.string().optional().openapi({
    description: "Machine-readable error code for programmatic handling",
    example: "NOT_FOUND",
  }),
  details: z.unknown().optional().openapi({
    description: "Additional context for validation errors or debugging",
  }),
});

/**
 * Infer the TypeScript type from ErrorSchema
 */
export type ApiError = z.infer<typeof ErrorSchema>;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * STANDARD ERROR CODES
 * ─────────────────────────────────────────────────────────────────────────────
 * Use these codes for consistent error handling across all routes.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const ErrorCode = {
  // Validation errors (400)
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_INPUT: "INVALID_INPUT",
  MISSING_REQUIRED_FIELD: "MISSING_REQUIRED_FIELD",
  INVALID_FORMAT: "INVALID_FORMAT",
  EXCEEDS_MAX_LENGTH: "EXCEEDS_MAX_LENGTH",

  // Authentication/Authorization errors (401, 403)
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  SESSION_EXPIRED: "SESSION_EXPIRED",

  // Not found errors (404)
  NOT_FOUND: "NOT_FOUND",
  RESOURCE_NOT_FOUND: "RESOURCE_NOT_FOUND",

  // Conflict errors (409)
  CONFLICT: "CONFLICT",
  ALREADY_EXISTS: "ALREADY_EXISTS",

  // Rate limiting (429)
  RATE_LIMIT_EXCEEDED: "RATE_LIMIT_EXCEEDED",

  // Server errors (500)
  INTERNAL_SERVER_ERROR: "INTERNAL_SERVER_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",
  EXTERNAL_SERVICE_ERROR: "EXTERNAL_SERVICE_ERROR",
} as const;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OPENAPI STANDARD ERROR RESPONSES
 * ─────────────────────────────────────────────────────────────────────────────
 * Use these in your route definitions for consistent error documentation.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const openApiStandardErrors = {
  400: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Bad Request - Invalid input or validation error",
  },
  401: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Unauthorized - Authentication required",
  },
  403: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Forbidden - Insufficient permissions",
  },
  404: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Not Found - Resource does not exist",
  },
  409: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Conflict - Resource already exists or state conflict",
  },
  429: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Too Many Requests - Rate limit exceeded",
  },
  500: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Internal Server Error - Server-side error occurred",
  },
};

export const standardErrors = openApiStandardErrors;

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * OPENAPI SECURITY SCHEMES
 * ─────────────────────────────────────────────────────────────────────────────
 */
export const BearerAuthSecurityScheme = {
  BearerAuth: {
    type: "http",
    scheme: "bearer",
  },
} as const;

export const standardErrorsWithAuth = {
  ...standardErrors,
  401: standardErrors[401],
  403: standardErrors[403],
};
