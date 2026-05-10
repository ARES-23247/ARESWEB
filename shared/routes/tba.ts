/**
 * ─────────────────────────────────────────────────────────────────────────────
 * THE BLUE ALLIANCE (TBA) API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for The Blue Alliance API integration.
 *
 * NOTE: These schemas define request/response contracts for TBA's external API,
 * not database entities. They do not use auto-generated Drizzle schemas because
 * they interact with TBA's API directly, not our database.
 *
 * TBA API Docs: https://www.thebluealliance.com/apidocs
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

/**
 * GET /rankings/{eventKey} - Get TBA rankings for an event
 */
export const getRankingsRoute = createRoute({
  method: "get",
  path: "/rankings/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string().openapi({
        example: "2026wvawe",
        description: "TBA event key (e.g., {year}{event_code})",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            rankings: z
              .array(z.unknown())
              .openapi({ description: "Rankings data from TBA API" }),
          }),
        },
      },
      description: "Get TBA rankings for an event",
    },
  },
  tags: ["tba"],
  summary: "Get event rankings",
  description: "Retrieves rankings data for a specific event from The Blue Alliance.",
});

/**
 * GET /matches/{eventKey} - Get TBA matches for an event
 */
export const getMatchesRoute = createRoute({
  method: "get",
  path: "/matches/{eventKey}",
  request: {
    params: z.object({
      eventKey: z.string().openapi({
        example: "2026wvawe",
        description: "TBA event key (e.g., {year}{event_code})",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            matches: z
              .array(z.unknown())
              .openapi({ description: "Match data from TBA API" }),
          }),
        },
      },
      description: "Get TBA matches for an event",
    },
  },
  tags: ["tba"],
  summary: "Get event matches",
  description: "Retrieves match data for a specific event from The Blue Alliance.",
});

/**
 * GET /ftc-events/{season}/{eventCode}/{type} - Fetch official FTC Events API data
 */
export const getFtcEventsRoute = createRoute({
  method: "get",
  path: "/ftc-events/{season}/{eventCode}/{type}",
  request: {
    params: z.object({
      season: z.string().openapi({
        example: "2026",
        description: "FTC season year",
      }),
      eventCode: z.string().openapi({
        example: "USWV",
        description: "FTC event code",
      }),
      type: z
        .enum(["matches", "rankings", "alliances"])
        .openapi({
          example: "matches",
          description: "Type of data to fetch",
        }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.unknown().openapi({
            description: "Official FTC Events API response",
          }),
        },
      },
      description: "Fetch official data from FTC Events API",
    },
  },
  tags: ["tba"],
  summary: "Get FTC Events official data",
  description:
    "Fetches official match, ranking, or alliance data from the FTC Events API.",
});
