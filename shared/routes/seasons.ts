import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { selectSeasonSchema } from "@shared/db/schema-zod";
import { responseWrappers } from "@shared/db/schema-openapi";
import { standardErrors } from "./common";

// ============================================================================
// DERIVED RESPONSE SCHEMAS (from Drizzle)
// ============================================================================

/**
 * Season schema - derived from Drizzle select schema
 * Exported as `seasonSchema` for backward compatibility with consumers
 */
export const seasonSchema = selectSeasonSchema;

/**
 * Season response schema - derived from Drizzle select schema
 */
export const seasonResponseSchema = selectSeasonSchema;

/**
 * Save season request schema (create/update)
 * Derived from Drizzle insert schema with all fields optional for partial updates
 */
export const saveSeasonSchema = selectSeasonSchema
  .omit({ createdAt: true, updatedAt: true })
  .partial()
  .extend({
    originalYear: z.number().optional(),
    startYear: z.number(),
    endYear: z.number(),
    challengeName: z.string(),
  });

// ============================================================================
// ROUTES
// ============================================================================

export const listSeasonsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            seasons: z.array(seasonResponseSchema),
          }),
        },
      },
      description: "List all published seasons",
    },
  },
  tags: ["seasons"],
});

export const adminListSeasonsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            seasons: z.array(seasonResponseSchema),
          }),
        },
      },
      description: "List all seasons (admin)",
    },
  },
  tags: ["seasons"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            season: seasonResponseSchema,
          }),
        },
      },
      description: "Get season details (admin)",
    },
  },
  tags: ["seasons"],
});

export const getSeasonDetailRoute = createRoute({
  method: "get",
  path: "/{year}",
  request: {
    params: z.object({
      year: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            season: seasonResponseSchema,
            // Related data - schemas may be defined elsewhere or kept as unknown for now
            awards: z.array(z.unknown()),
            events: z.array(z.unknown()),
            posts: z.array(z.unknown()),
            outreach: z.array(z.unknown()),
          }),
        },
      },
      description: "Get public season details",
    },
  },
  tags: ["seasons"],
});

export const saveSeasonRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: saveSeasonSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Save/Update a season",
    },
  },
  tags: ["seasons"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Soft delete a season",
    },
  },
  tags: ["seasons"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Restore a deleted season",
    },
  },
  tags: ["seasons"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Permanently delete a season",
    },
  },
  tags: ["seasons"],
});
