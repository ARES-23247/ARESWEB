import { createRoute, z } from "@hono/zod-openapi";

export const AuthCheckResponseSchema = z.object({
  authenticated: z.boolean(),
  user: z.object({
    id: z.string(),
    email: z.string(),
    name: z.string(),
    role: z.string(),
    image: z.string().optional().nullable(),
  }).optional(),
});

export const authCheckRoute = createRoute({
  method: "get",
  path: "/auth-check",
  summary: "Check authentication status",
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
