import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const seasonSchema = z.object({
  original_year: z.number().optional(),
  start_year: z.number(),
  end_year: z.number(),
  challenge_name: z.string(),
  robot_name: z.string().nullish(),
  robot_image: z.string().nullish(),
  robot_description: z.string().nullish(),
  robot_cad_url: z.string().nullish(),
  summary: z.string().nullish(),
  album_url: z.string().nullish(),
  album_cover: z.string().nullish(),
  status: z.string().nullish(),
  is_deleted: z.number().nullish(),
  created_at: z.string().nullish(),
  updated_at: z.string().nullish(),
});

export const listSeasonsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "List all published seasons",
      content: { "application/json": { schema: z.object({ seasons: z.array(seasonSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const adminListSeasonsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "List all seasons (admin)",
      content: { "application/json": { schema: z.object({ seasons: z.array(seasonSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const adminDetailSeasonRoute = createRoute({
  method: "get",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Get season details (admin)",
      content: { "application/json": { schema: z.object({ season: seasonSchema }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getDetailSeasonRoute = createRoute({
  method: "get",
  path: "/{year}",
  request: {
    params: z.object({
      year: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Get public season details",
      content: {
        "application/json": {
          schema: z.object({
            season: seasonSchema,
            awards: z.array(z.unknown()),
            events: z.array(z.unknown()),
            posts: z.array(z.unknown()),
            outreach: z.array(z.unknown()),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const saveSeasonRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: seasonSchema } },
    },
  },
  responses: {
    200: {
      description: "Save/Update a season",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteSeasonRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Soft delete a season",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const undeleteSeasonRoute = createRoute({
  method: "post",
  path: "/admin/{id}/undelete",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Restore a deleted season",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const purgeSeasonRoute = createRoute({
  method: "delete",
  path: "/admin/{id}/purge",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Permanently delete a season",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
