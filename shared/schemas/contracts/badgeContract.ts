import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

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
    200: {
      description: "List all badge definitions",
      content: { "application/json": { schema: z.object({ badges: z.array(badgeSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const createBadgeRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: { "application/json": { schema: badgeSchema.omit({ created_at: true }) } },
    },
  },
  responses: {
    200: {
      description: "Create a new badge definition",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
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
    200: {
      description: "Grant a badge to a user",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
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
    200: {
      description: "Revoke a badge from a user",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
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
    200: {
      description: "Delete a badge definition",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const leaderboardBadgeRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    200: {
      description: "Get public badge leaderboard",
      content: {
        "application/json": {
          schema: z.object({
            leaderboard: z.array(
              z.object({
                user_id: z.string(),
                nickname: z.string().nullable(),
                member_type: z.string().nullable(),
                badge_count: z.number(),
              }),
            ),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
