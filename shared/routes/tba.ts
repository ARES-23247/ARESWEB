import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const getRankingsRoute = createRoute({
  method: "get",
  path: "/rankings/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ rankings: z.array(z.unknown()) }),
        },
      },
      description: "Get TBA rankings for an event",
    },
  },
  tags: ["tba"],
});

export const getMatchesRoute = createRoute({
  method: "get",
  path: "/matches/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ matches: z.array(z.unknown()) }),
        },
      },
      description: "Get TBA matches for an event",
    },
  },
  tags: ["tba"],
});

export const getFtcEventsRoute = createRoute({
  method: "get",
  path: "/ftc-events/{season}/{eventCode}/{type}",
  request: {
    params: z.object({
      season: z.string(),
      eventCode: z.string(),
      type: z.enum(["matches", "rankings", "alliances"]),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.unknown(),
        },
      },
      description: "Fetch official data from FTC Events API",
    },
  },
  tags: ["tba"],
});
