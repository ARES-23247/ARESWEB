import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

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

export const seasonContract = c.router({
  list: {
    method: "GET",
    path: "/",
    responses: {
      ...standardErrors,
      200: z.object({
        seasons: z.array(seasonSchema),
      }),
    },
    summary: "List all published seasons",
  },
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      ...standardErrors,
      200: z.object({
        seasons: z.array(seasonSchema),
      }),
    },
    summary: "List all seasons (admin)",
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        season: seasonSchema,
      }),
    },
    summary: "Get season details (admin)",
  },
  getDetail: {
    method: "GET",
    path: "/:year",
    pathParams: z.object({
      year: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        season: seasonSchema,
        awards: z.array(z.unknown()),
        events: z.array(z.unknown()),
        posts: z.array(z.unknown()),
        outreach: z.array(z.unknown()),
      }),
    },
    summary: "Get public season details",
  },
  save: {
    method: "POST",
    path: "/admin/save",
    body: seasonSchema,
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Save/Update a season",
  },
  delete: {
    method: "DELETE",
    path: "/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Soft delete a season",
  },
  undelete: {
    method: "POST",
    path: "/admin/:id/undelete",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Restore a deleted season",
  },
  purge: {
    method: "DELETE",
    path: "/admin/:id/purge",
    pathParams: z.object({
      id: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Permanently delete a season",
  },
});
export type SeasonContract = typeof seasonContract;
