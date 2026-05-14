import { createRoute, z } from "@hono/zod-openapi";

/**
 * FTC Events API Routes
 * Provides access to FIRST FTC event data (season, matches, rankings)
 */

export const getFtcEventsRoute = createRoute({
  method: "get",
  path: "/ftc-events/{season}/{eventCode}/{type}",
  request: {
    params: z.object({
      season: z.string().openapi({
        description: "FTC Season year (e.g., '2024')",
        example: "2024",
      }),
      eventCode: z.string().uppercase().openapi({
        description: "FTC event code (e.g., 'MIMIL')",
        example: "MIMIL",
      }),
      type: z.enum(["matches", "rankings"]).openapi({
        description: "Type of data to retrieve",
        example: "matches",
      }),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.array(z.object({
            matchNumber: z.number().optional(),
            description: z.string().optional(),
          })).openapi({
            description: "FTC event data",
          }),
        },
      },
      description: "Successfully retrieved FTC event data",
    },
    401: {
      description: "Unauthorized - authentication required",
    },
    429: {
      description: "Too many requests - rate limited",
    },
    500: {
      description: "Failed to fetch FTC event data",
    },
  },
  tags: ["ftc"],
});
