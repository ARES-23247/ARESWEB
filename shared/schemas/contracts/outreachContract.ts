import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const outreachSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  location: z.string().nullable(),
  students_count: z.number(),
  hours_logged: z.number(),
  reach_count: z.number(),
  description: z.string().nullable(),
  is_mentoring: z.coerce.boolean().optional(),
  mentored_team_number: z.string().nullable().optional(),
  season_id: z.coerce.number().nullable().optional(),
  is_dynamic: z.boolean().optional(),
});

export const outreachContract = c.router({
  list: {
    method: "GET",
    path: "/",
    responses: {
      200: z.object({
        logs: z.array(outreachSchema),
      }),
      500: z.object({ error: z.string() }),
    },
    summary: "List all outreach logs",
  },
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      200: z.object({
        logs: z.array(outreachSchema),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "List all outreach logs (admin)",
  },
  save: {
    method: "POST",
    path: "/admin/save",
    body: outreachSchema.omit({ id: true }).extend({
      id: z.string().optional(),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Create or Update an outreach log",
  },
  delete: {
    method: "DELETE",
    path: "/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.noBody(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      401: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete an outreach log",
  },
});
