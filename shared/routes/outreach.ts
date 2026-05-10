import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const outreachSchema = z.object({
  id: z.string(),
  title: z.string(),
  date: z.string(),
  location: z.string().nullable(),
  studentsCount: z.number().int().min(0).max(1000),
  hoursLogged: z.number().min(0).max(24),
  reachCount: z.number().int().min(0).max(1000000),
  description: z.string().nullable(),
  isMentoring: z.coerce.boolean().optional(),
  mentoredTeamNumber: z.string().nullable().optional(),
  seasonId: z.coerce.number().nullable().optional(),
  isDynamic: z.boolean().optional(),
  eventId: z.string().nullable().optional(),
  mentorCount: z.number().int().min(0).max(100).optional(),
  mentorHours: z.number().min(0).max(1000).optional(),
});

// Route: List all outreach logs (Public)
export const listOutreachRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(outreachSchema),
          }),
        },
      },
      description: "List all outreach logs",
    },
  },
});

// Route: List all outreach logs (Admin)
export const adminListOutreachRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(outreachSchema),
          }),
        },
      },
      description: "List all outreach logs (admin view)",
    },
  },
});

// Route: Save/Update outreach log
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string().optional(),
          }),
        },
      },
      description: "Create or update an outreach log",
    },
  },
});

// Route: Delete outreach log
export const deleteOutreachRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Delete an outreach log",
    },
  },
});
