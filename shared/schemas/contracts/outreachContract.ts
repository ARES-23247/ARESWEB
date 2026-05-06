import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const outreachSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  location: z.string().nullable(),
  students_count: z.number().int().min(0).max(1000, "Student count cannot exceed 1000"),
  hours_logged: z.number().min(0).max(24, "Hours logged cannot exceed 24"),
  reach_count: z.number().int().min(0).max(1000000, "Reach count is unrealistically high"),
  description: z.string().nullable(),
  is_mentoring: z.coerce.boolean().optional(),
  mentored_team_number: z.string().nullable().optional(),
  season_id: z.coerce.number().nullable().optional(),
  is_dynamic: z.boolean().optional(),
  event_id: z.string().nullable().optional(),
  mentor_count: z.number().int().min(0).max(100, "Mentor count seems too high").optional(),
  mentor_hours: z.number().min(0).max(1000, "Mentor hours seem too high").optional(),
});

export const outreachContract = c.router({
  list: {
    method: "GET",
    path: "/",
    responses: {
      ...standardErrors,
      200: z.object({
        logs: z.array(outreachSchema),
      }),
    },
    summary: "List all outreach logs",
  },
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      ...standardErrors,
      200: z.object({
        logs: z.array(outreachSchema),
      }),
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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
      }),
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
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Delete an outreach log",
  },
});
export type OutreachContract = typeof outreachContract;
