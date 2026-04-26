import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const awardSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number(),
  event_name: z.string().nullable(),
  description: z.string().nullable(),
  image_url: z.string().nullable(),
  season_id: z.coerce.number().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const awardContract = c.router({
  getAwards: {
    method: "GET",
    path: "/",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        awards: z.array(awardSchema),
      }),
    },
    summary: "Get all awards",
  },
  saveAward: {
    method: "POST",
    path: "/admin/save",
    body: z.object({
      id: z.string().optional(),
      title: z.string(),
      year: z.coerce.number(),
      event_name: z.string().optional().nullable(),
      description: z.string().optional().nullable(),
      image_url: z.string().optional().nullable(),
      season_id: z.coerce.number().optional().nullable(),
    }),
    responses: {
      200: z.object({ success: z.boolean(), id: z.string().optional() }),
    },
    summary: "Create or update an award",
  },
  deleteAward: {
    method: "DELETE",
    path: "/admin/:id",
    body: c.noBody(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Soft-delete an award",
  },
});
