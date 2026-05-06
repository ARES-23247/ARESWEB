import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
};

export const getRankingsRoute = createRoute({
  method: "get",
  path: "/rankings/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ rankings: z.array(z.unknown()) }),
        },
      },
      description: "Get TBA rankings for an event",
    },
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
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ matches: z.array(z.unknown()) }),
        },
      },
      description: "Get TBA matches for an event",
    },
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
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.unknown(),
        },
      },
      description: "Fetch official data from FTC Events API",
    },
  },
});
