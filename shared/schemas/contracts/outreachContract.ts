import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

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

export const listOutreachRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "List all outreach logs",
      content: { "application/json": { schema: z.object({ logs: z.array(outreachSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const adminListOutreachRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "List all outreach logs (admin)",
      content: { "application/json": { schema: z.object({ logs: z.array(outreachSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveOutreachRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: outreachSchema.omit({ id: true }).extend({
            id: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create or Update an outreach log",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const deleteOutreachRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Delete an outreach log",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
