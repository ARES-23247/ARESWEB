import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const tbaContract = c.router({
  getRankings: {
    method: "GET",
    path: "/rankings/:eventKey",
    pathParams: z.object({
      eventKey: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ rankings: z.array(z.unknown()) }),
    },
    summary: "Get TBA rankings for an event",
  },
  getMatches: {
    method: "GET",
    path: "/matches/:eventKey",
    pathParams: z.object({
      eventKey: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ matches: z.array(z.unknown()) }),
    },
    summary: "Get TBA matches for an event",
  },
  getFtcEvents: {
    method: "GET",
    path: "/ftc-events/:season/:eventCode/:type",
    pathParams: z.object({
      season: z.string(),
      eventCode: z.string(),
      type: z.enum(["matches", "rankings", "alliances"]),
    }),
    responses: {
      ...standardErrors,
      200: z.unknown(),
    },
    summary: "Fetch official data from FTC Events API",
  },
});
export type TbaContract = typeof tbaContract;
