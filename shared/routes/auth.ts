import { createRoute, z } from "@hono/zod-openapi";
import { selectUserSchema, selectSessionSchema } from "@shared/db/schema-zod";
import { createResponseSchema, responseWrappers } from "@shared/db/schema-openapi";

// ============================================================================
// AUTH RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * User info for auth responses. Derived from selectUserSchema with
 * only the fields needed for authentication.
 */
export const authUserSchema = createResponseSchema(
  selectUserSchema.pick({
    id: true,
    email: true,
    name: true,
    image: true,
  }),
  {
    title: "Auth User",
    description: "User information returned in authentication responses",
  }
);

/**
 * Add role field to auth user (role is computed from session/user)
 */
const authUserWithRoleSchema = authUserSchema.extend({
  role: z.string().nullable().openapi({
    description: "User role (admin, member, etc.)",
    example: "admin",
  }),
});

/**
 * Authentication check response
 */
export const AuthCheckResponseSchema = createResponseSchema(
  z.object({
    authenticated: z.boolean().openapi({
      description: "Whether the user is authenticated",
      example: true,
    }),
    user: authUserWithRoleSchema.optional().openapi({
      description: "User information if authenticated",
    }),
  }),
  {
    title: "Auth Check Response",
    description: "Response from authentication status check",
  }
);

// ============================================================================
// AUTH ROUTES
// ============================================================================

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

/**
 * Test login response. Uses auth user schema derived from Drizzle.
 */
export const testLoginResponseSchema = responseWrappers.created().extend({
  user: authUserWithRoleSchema.openapi({
    description: "User information for the test session",
  }),
  sessionToken: z.string().openapi({
    description: "Session token for testing. Automatically set as cookie.",
    example: "abc123xyz789",
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
