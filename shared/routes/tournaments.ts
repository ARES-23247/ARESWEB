import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrorsWithAuth, standardErrors } from "./common";
import { 
  tournamentSchema, 
  tournamentPayloadSchema,
  tournamentMatchSchema,
  tournamentAwardSchema,
  tournamentAwardPayloadSchema
} from "../schemas/tournamentSchema";

export const getTournamentsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            tournaments: z.array(tournamentSchema),
          }),
        },
      },
      description: "Get all tournaments",
    },
  },
  tags: ["tournaments"],
});

export const getTournamentRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            tournament: tournamentSchema,
            matches: z.array(tournamentMatchSchema),
            awards: z.array(tournamentAwardSchema),
          }),
        },
      },
      description: "Get tournament by ID",
    },
  },
  tags: ["tournaments"],
});

export const createTournamentRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: { "application/json": { schema: tournamentPayloadSchema } },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: "Tournament created",
    },
  },
  tags: ["tournaments", "admin"],
});

export const updateTournamentRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: tournamentPayloadSchema } },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Tournament updated",
    },
  },
  tags: ["tournaments", "admin"],
});

export const deleteTournamentRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Tournament deleted",
    },
  },
  tags: ["tournaments", "admin"],
});

export const syncTournamentMatchesRoute = createRoute({
  method: "post",
  path: "/{id}/sync-matches",
  request: { params: z.object({ id: z.string() }) },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Synchronized matches from FTC Events API",
    },
  },
  tags: ["tournaments", "admin"],
});

export const updateTournamentMatchVideoRoute = createRoute({
  method: "patch",
  path: "/{id}/matches/{matchId}",
  request: {
    params: z.object({ id: z.string(), matchId: z.string() }),
    body: {
      content: { "application/json": { schema: z.object({ youtubeVideoId: z.string().nullable() }) } },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Match video updated",
    },
  },
  tags: ["tournaments", "admin"],
});

export const updateTournamentAwardRoute = createRoute({
  method: "post",
  path: "/{id}/awards",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: { "application/json": { schema: tournamentAwardPayloadSchema } },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean(), id: z.string() }) },
      },
      description: "Award updated/created",
    },
  },
  tags: ["tournaments", "admin"],
});

export const deleteTournamentAwardRoute = createRoute({
  method: "delete",
  path: "/{id}/awards/{awardId}",
  request: {
    params: z.object({ id: z.string(), awardId: z.string() }),
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": { schema: z.object({ success: z.boolean() }) },
      },
      description: "Award deleted",
    },
  },
  tags: ["tournaments", "admin"],
});
