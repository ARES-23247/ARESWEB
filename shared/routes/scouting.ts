import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectScoutingAnalysisSchema } from "../db/schema-zod";
import { createResponseSchema } from "../db/schema-openapi";

// Auto-generated response schema from Drizzle
export const ScoutingAnalysisSchema = createResponseSchema(selectScoutingAnalysisSchema, {
  title: "Scouting Analysis",
  example: {
    id: "analysis_123",
    seasonKey: "2025-relaunch",
    eventKey: "2025wvama",
    teamNumber: 23247,
    mode: "team_analysis",
    model: "claude-3-5-sonnet",
    markdown: "# Team 23247 Analysis\n\nStrong autonomous...",
    tokensUsed: 1500,
    createdBy: "user_456",
    createdAt: "2025-01-15T10:00:00Z",
  },
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
            context: z.record(z.string(), z.any()),
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
