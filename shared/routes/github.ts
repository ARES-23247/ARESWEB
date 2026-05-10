/**
 * ─────────────────────────────────────────────────────────────────────────────
 * GITHUB API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for GitHub API integration.
 *
 * NOTE: These schemas define request/response contracts for GitHub's external API,
 * not database entities. They do not use auto-generated Drizzle schemas because
 * they interact with GitHub's API directly, not our database.
 *
 * GitHub API Docs: https://docs.github.com/en/rest
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * GitHub Project Item Schema
 * Represents an item in a GitHub Project board (issue, PR, draft issue, etc.)
 */
export const githubProjectItemSchema = z.object({
  id: z.string().openapi({
    example: "PVTI_123",
    description: "GitHub Project item ID",
  }),
  title: z.string().openapi({
    example: "Implement feature",
    description: "Title of the project item",
  }),
  status: z.string().openapi({
    example: "In Progress",
    description: "Status of the item",
  }),
  updatedAt: z.string().openapi({
    example: "2026-05-06T12:00:00Z",
    description: "Last updated timestamp",
  }),
  assignees: z.array(z.string()).default([]).openapi({
    example: ["user1", "user2"],
    description: "GitHub usernames of assignees",
  }),
  type: z.string().default("DRAFT_ISSUE").openapi({
    example: "DRAFT_ISSUE",
    description: "Type of the item (ISSUE, DRAFT_ISSUE, etc.)",
  }),
});

/**
 * GitHub Heatmap Day Schema
 * Represents commit activity for a single day in the contribution heatmap
 */
export const githubHeatmapDaySchema = z.object({
  date: z.string().openapi({
    example: "2026-05-06",
    description: "Date in ISO format",
  }),
  count: z.number().openapi({
    example: 5,
    description: "Number of commits on this day",
  }),
  level: z.number().openapi({
    example: 3,
    description: "Activity level (0-4) for heatmap coloring",
    enum: [0, 1, 2, 3, 4],
  }),
});

/**
 * GET /projects - Get GitHub Projects board
 */
export const getBoardRoute = createRoute({
  method: "get",
  path: "/projects",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the fetch was successful",
            }),
            board: z.array(githubProjectItemSchema).openapi({
              description: "List of project board items",
            }),
          }),
        },
      },
      description: "Successfully fetched project board",
    },
  },
  tags: ["github"],
  summary: "Get GitHub Projects board",
  description:
    "Retrieves the team's GitHub Project board with all items, their status, and assignees.",
});

/**
 * POST /projects/items - Create a GitHub Project item
 */
export const createItemRoute = createRoute({
  method: "post",
  path: "/projects/items",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            title: z.string().min(1).openapi({
              example: "New task",
              description: "Title of the item to create",
            }),
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
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the item was created successfully",
            }),
          }),
        },
      },
      description: "Item created successfully",
    },
  },
  tags: ["github"],
  summary: "Create a GitHub Project item",
  description: "Creates a new draft issue in the team's GitHub Project board.",
});

/**
 * GET /activity - Get team GitHub contribution heatmap data
 */
export const getActivityRoute = createRoute({
  method: "get",
  path: "/activity",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            grid: z
              .array(z.array(githubHeatmapDaySchema))
              .openapi({
                description: "2D array representing weeks of daily activity",
              }),
            totalCommits: z.number().openapi({
              example: 1250,
              description:
                "Total commits across all repositories in the past year",
            }),
            repoCount: z.number().openapi({
              example: 15,
              description: "Number of public repositories in the organization",
            }),
          }),
        },
      },
      description: "Successfully fetched activity data",
    },
  },
  tags: ["github"],
  summary: "Get team GitHub contribution heatmap data",
  description:
    "Retrieves commit activity across all team repositories for the past year, formatted for heatmap visualization.",
});
