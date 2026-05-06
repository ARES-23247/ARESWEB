import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const ScoutingAnalysisSchema = z.object({
  id: z.string(),
  team_number: z.number(),
  event_key: z.string(),
  analysis_json: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const analyzeScoutingRoute = createRoute({
  method: "post",
  path: "/analyze",
  tags: ["scouting"],
  summary: "Analyze scouting data",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            mode: z.enum(["team_analysis", "match_prediction", "event_overview"]),
            teamNumber: z.number().optional(),
            eventKey: z.string().optional(),
            seasonKey: z.string(),
            context: z.record(z.any()),
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
            markdown: z.string(),
            model: z.string(),
            tokensUsed: z.number().optional(),
          }),
        },
      },
      description: "Analysis completed",
    },
  },
});

export const listScoutingAnalysesRoute = createRoute({
  method: "get",
  path: "/analyses",
  tags: ["scouting"],
  summary: "List scouting analyses",
  request: {
    query: z.object({
      teamNumber: z.string().optional(),
      eventKey: z.string().optional(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.array(ScoutingAnalysisSchema),
        },
      },
      description: "List of analyses",
    },
  },
});

export const toaProxyRoute = createRoute({
  method: "get",
  path: "/toa/{path}",
  tags: ["scouting"],
  summary: "TOA API Proxy",
  request: {
    params: z.object({
      path: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
      description: "Proxy response",
    },
  },
});

export const ftcEventsProxyRoute = createRoute({
  method: "get",
  path: "/ftcevents/{path}",
  tags: ["scouting"],
  summary: "FTC Events API Proxy",
  request: {
    params: z.object({
      path: z.string(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.any(),
        },
      },
      description: "Proxy response",
    },
  },
});
