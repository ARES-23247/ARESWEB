/**
 * Standardized Error Response Schemas
 *
 * IN-02: Standardized error response shapes across all API endpoints.
 * This provides consistent error handling for client code.
 */

import { z } from "zod";

/**
 * Standard error response schema for API errors.
 * Use this for all error responses to maintain consistency.
 */
export const errorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  code: z.string().optional(),
  details: z.unknown().optional(),
});

export type ErrorResponse = z.infer<typeof errorResponseSchema>;

/**
 * Not found response schema (specific for 404 errors).
 */
export const notFoundResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
});

export type NotFoundResponse = z.infer<typeof notFoundResponseSchema>;

/**
 * Validation error response with field-level details.
 */
export const validationErrorResponseSchema = z.object({
  success: z.literal(false),
  error: z.string(),
  details: z.record(z.string(), z.array(z.string())).optional(),
});

export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

/**
 * Simple error response (legacy compatibility).
 * Some endpoints return just { error: string }.
 */
export const simpleErrorResponseSchema = z.object({
  error: z.string(),
});

export type SimpleErrorResponse = z.infer<typeof simpleErrorResponseSchema>;

/**
 * Helper function to create a standard error response.
 */
export function createErrorResponse(message: string, code?: string): ErrorResponse {
  const response: ErrorResponse = {
    success: false,
    error: message,
  };
  if (code) {
    response.code = code;
  }
  return response;
}

/**
 * Helper function to create a validation error response.
 */
export function createValidationErrorResponse(
  message: string,
  details?: Record<string, string[]>
): ValidationErrorResponse {
  const response: ValidationErrorResponse = {
    success: false,
    error: message,
  };
  if (details) {
    response.details = details;
  }
  return response;
}
