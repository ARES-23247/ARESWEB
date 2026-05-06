import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
};

export const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  color_theme: z.string(),
  created_at: z.string(),
});

export const userBadgeSchema = z.object({
  user_id: z.string(),
  badge_id: z.string(),
  granted_at: z.string(),
});

export const listBadgesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            badges: z.array(badgeSchema),
          }),
        },
      },
      description: "List all badge definitions",
    },
  },
});

export const createBadgeRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: badgeSchema.omit({ created_at: true }),
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Create a new badge definition",
    },
  },
});

export const grantBadgeRoute = createRoute({
  method: "post",
  path: "/admin/grant",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            userId: z.string(),
            badgeId: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Grant a badge to a user",
    },
  },
});

export const revokeBadgeRoute = createRoute({
  method: "delete",
  path: "/admin/grant/{userId}/{badgeId}",
  request: {
    params: z.object({
      userId: z.string(),
      badgeId: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Revoke a badge from a user",
    },
  },
});

export const deleteBadgeRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a badge definition",
    },
  },
});

export const leaderboardBadgeRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            leaderboard: z.array(z.object({
              user_id: z.string(),
              nickname: z.string().nullable(),
              member_type: z.string().nullable(),
              badge_count: z.number(),
            })),
          }),
        },
      },
      description: "Get public badge leaderboard",
    },
  },
});
