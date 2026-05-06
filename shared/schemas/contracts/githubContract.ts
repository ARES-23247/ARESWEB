import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const githubProjectItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  status: z.string(),
  updated_at: z.string(),
  assignees: z.array(z.string()).default([]),
  type: z.string().default("DRAFT_ISSUE"),
});

export const githubHeatmapDaySchema = z.object({
  date: z.string(),
  count: z.number(),
  level: z.number(),
});

export const getBoardRoute = createRoute({
  method: "get",
  path: "/projects",
  responses: {
    200: {
      description: "Get GitHub Projects board",
      content: { "application/json": { schema: z.object({ success: z.boolean(), board: z.array(githubProjectItemSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const createItemRoute = createRoute({
  method: "post",
  path: "/projects/items",
  request: {
    body: {
      content: { "application/json": { schema: z.object({ title: z.string() }) } },
    },
  },
  responses: {
    200: {
      description: "Create a GitHub Project item",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getActivityRoute = createRoute({
  method: "get",
  path: "/activity",
  responses: {
    200: {
      description: "Get team GitHub contribution heatmap data",
      content: {
        "application/json": {
          schema: z.object({
            grid: z.array(z.array(githubHeatmapDaySchema)),
            totalCommits: z.number(),
            repoCount: z.number(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
