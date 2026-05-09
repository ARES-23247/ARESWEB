import { createRoute, z } from "@hono/zod-openapi";

export const AuthCheckResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string().nullable(),
    role: z.string(),
    image: z.string().optional().nullable(),
  }).optional(),
});

export const authCheckRoute = createRoute({
  method: "get",
  path: "/auth-check",
  tags: ["auth"],
  summary: "Check authentication status",
  description: "Verifies the current session and returns user info if authenticated",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: AuthCheckResponseSchema,
        },
      },
      description: "Authentication status",
    },
    401: {
      content: {
        "application/json": {
          schema: z.object({
            authenticated: z.literal(false),
          }),
        },
      },
      description: "Not authenticated",
    },
  },
});

export const emergencyClearRoute = createRoute({
  method: "get",
  path: "/emergency-clear",
  tags: ["auth"],
  summary: "Emergency session clear",
  description: "Force clears all authentication cookies. Useful for resolving session issues in development.",
  responses: {
    302: {
      description: "Redirect to home page with cleared cookies",
    },
  },
});

export const testLoginRequestSchema = z.object({
  userId: z.string().optional().openapi({
    description: "User ID to create a test session for. Defaults to 'admin-user'.",
    example: "admin-user",
  }),
});

export const testLoginResponseSchema = z.object({
  success: z.boolean(),
  user: z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string(),
    role: z.string().nullable(),
  }),
  sessionToken: z.string().openapi({
    description: "Session token for testing. Automatically set as cookie.",
  }),
});

export const testLoginRoute = createRoute({
  method: "post",
  path: "/test-login",
  tags: ["auth", "testing"],
  summary: "Create test session (E2E testing only)",
  description: "Creates a test authentication session for E2E testing. Only works in test environments or with x-test-bypass-auth header.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: testLoginRequestSchema.optional(),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: testLoginResponseSchema,
        },
      },
      description: "Test session created successfully",
    },
    403: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Not in test environment",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Test user not found",
    },
    500: {
      content: {
        "application/json": {
          schema: z.object({
            error: z.string(),
          }),
        },
      },
      description: "Failed to create test session",
    },
  },
});
