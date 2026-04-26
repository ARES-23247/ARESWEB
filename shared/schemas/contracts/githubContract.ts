import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

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

export const githubContract = c.router({
  getBoard: {
    method: "GET",
    path: "/projects",
    responses: {
      200: z.object({
        success: z.boolean(),
        board: z.array(githubProjectItemSchema),
      }),
    },
    summary: "Get GitHub Projects board",
  },
  createItem: {
    method: "POST",
    path: "/projects/items",
    body: z.object({
      title: z.string(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Create a GitHub Project item",
  },
  getActivity: {
    method: "GET",
    path: "/activity",
    responses: {
      200: z.object({
        grid: z.array(z.array(githubHeatmapDaySchema)),
        totalCommits: z.number(),
        repoCount: z.number(),
      }),
    },
    summary: "Get team GitHub contribution heatmap data",
  },
});
