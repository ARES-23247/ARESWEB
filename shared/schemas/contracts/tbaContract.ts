import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const getRankingsRoute = createRoute({
  method: "get",
  path: "/rankings/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Get TBA rankings for an event",
      content: { "application/json": { schema: z.object({ rankings: z.array(z.unknown()) }) } },
    },
    ...openApiStandardErrors,
  },
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
    200: {
      description: "Get TBA matches for an event",
      content: { "application/json": { schema: z.object({ matches: z.array(z.unknown()) }) } },
    },
    ...openApiStandardErrors,
  },
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
    200: {
      description: "Fetch official data from FTC Events API",
      content: { "application/json": { schema: z.unknown() } },
    },
    ...openApiStandardErrors,
  },
});
