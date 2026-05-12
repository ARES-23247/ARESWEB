import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { selectOutreachLogSchema } from "@shared/db/schema-zod";
import { responseWrappers } from "@shared/db/schema-openapi";
import { openApiStandardErrors } from "./common";

// ============================================================================
// DERIVED RESPONSE SCHEMAS (from Drizzle)
// ============================================================================

/**
 * Outreach log schema - derived from Drizzle select schema
 * Exported as `outreachSchema` for backward compatibility with consumers
 */
export const outreachSchema = selectOutreachLogSchema.extend({
  id: z.union([z.number(), z.string()]),
  isDynamic: z.boolean().optional(),
});

/**
 * Outreach log response schema - extends Drizzle schema to allow string IDs
 * for dynamic volunteer events.
 */
export const outreachResponseSchema = selectOutreachLogSchema.extend({
  id: z.union([z.number(), z.string()]),
  isDynamic: z.boolean().optional(),
});

/**
 * Save outreach request schema (create/update)
 * Derived from Drizzle schema with id optional for updates
 * Note: id is integer in DB but string in API for consistency
 */
export const saveOutreachSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1),
  date: z.string().min(1),
  location: z.string().nullable().optional(),
  hours: z.number().min(0).optional(),
  peopleReached: z.number().int().min(0).optional(),
  studentsCount: z.number().int().min(0).max(1000).optional(),
  impactSummary: z.string().nullable().optional(),
  cfEmail: z.string().nullable().optional(),
  isMentoring: z.boolean().optional(),
  mentoredTeamNumber: z.string().nullable().optional(),
  metadata: z.string().nullable().optional(),
  seasonId: z.number().nullable().optional(),
  eventId: z.string().nullable().optional(),
  mentorCount: z.number().int().min(0).max(100).optional(),
  mentorHours: z.number().min(0).max(1000).optional(),
  isDeleted: z.number().min(0).max(1).optional(),
});

// ============================================================================
// ROUTES
// ============================================================================

export const listOutreachRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(outreachResponseSchema),
          }),
        },
      },
      description: "List all outreach logs",
    },
  },
});

export const adminListOutreachRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(outreachResponseSchema),
          }),
        },
      },
      description: "List all outreach logs (admin view)",
    },
  },
});

export const saveOutreachRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: saveOutreachSchema,
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
          schema: responseWrappers.success(),
        },
      },
      description: "Delete an outreach log",
    },
  },
});
