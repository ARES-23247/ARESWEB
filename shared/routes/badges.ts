import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const badgeSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  icon: z.string(),
  colorTheme: z.string(),
  createdAt: z.string(),
});

export const userBadgeSchema = z.object({
  userId: z.string(),
  badgeId: z.string(),
  grantedAt: z.string(),
});

export const listBadgesRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
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
  tags: ["badges"],
});

export const createBadgeRoute = createRoute({
  method: "post",
  path: "/admin",
  request: {
    body: {
      content: {
        "application/json": {
          schema: badgeSchema.omit({ createdAt: true }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Create a new badge definition",
    },
  },
  tags: ["badges", "admin"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Grant a badge to a user",
    },
  },
  tags: ["badges", "admin"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Revoke a badge from a user",
    },
  },
  tags: ["badges", "admin"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Delete a badge definition",
    },
  },
  tags: ["badges", "admin"],
});

export const leaderboardBadgeRoute = createRoute({
  method: "get",
  path: "/leaderboard",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            leaderboard: z.array(z.object({
              userId: z.string(),
              nickname: z.string().nullable(),
              memberType: z.string().nullable(),
              badgeCount: z.number(),
            })),
          }),
        },
      },
      description: "Get public badge leaderboard",
    },
  },
  tags: ["badges"],
});
