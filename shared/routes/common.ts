import { z } from "zod";

/**
 * Standard error response schemas for OpenAPI routes
 */

export const ErrorSchema = z.object({
  error: z.string(),
});

export const standardErrors = {
  400: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Bad Request",
  },
  401: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Unauthorized",
  },
  403: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Forbidden",
  },
  404: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Not Found",
  },
  429: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Too Many Requests",
  },
  500: {
    content: {
      "application/json": {
        schema: ErrorSchema,
      },
    },
    description: "Internal Server Error",
  },
};

export const BearerAuthSecurityScheme = {
  BearerAuth: {
    type: "http",
    scheme: "bearer",
  },
};

export const standardErrorsWithAuth = {
  ...standardErrors,
  401: standardErrors[401],
  403: standardErrors[403],
};
