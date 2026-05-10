import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectLocationSchema, insertLocationSchema } from "@shared/db/schema-zod";
import { createResponseSchema, responseWrappers, toCamelCaseResponse } from "@shared/db/schema-openapi";

// ============================================================================
// LOCATION RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * Location schema derived from Drizzle locations table.
 * Uses camelCase naming (maps_url -> mapsUrl, is_deleted -> isDeleted).
 */
export const locationSchema = createResponseSchema(
  toCamelCaseResponse(
    selectLocationSchema.pick({
      id: true,
      name: true,
      address: true,
      mapsUrl: true,
      isDeleted: true,
    })
  ),
  {
    title: "Location",
    description: "A physical location for team events and activities",
    example: {
      id: "loc_123",
      name: "WVU Innovation Corporation",
      address: "2350 Engineering Dr, Morgantown, WV 26505",
      mapsUrl: "https://maps.google.com/?q=2350+Engineering+Dr",
      isDeleted: 0,
    },
  }
);

/**
 * Input schema for creating/updating locations.
 * Omits id (auto-generated) and uses camelCase naming.
 */
export const locationInputSchema = toCamelCaseResponse(
  insertLocationSchema.omit({ id: true })
).extend({
  mapsUrl: z.string().url("Invalid maps URL format").optional().nullable().or(z.literal("")),
}).openapi({
  description: "Input for creating or updating a location",
  example: {
    name: "WVU Innovation Corporation",
    address: "2350 Engineering Dr, Morgantown, WV 26505",
    mapsUrl: "https://maps.google.com/?q=2350+Engineering+Dr",
  },
});

// ============================================================================
// LOCATION ROUTES
// ============================================================================

export const listLocationsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get all public locations",
      content: {
        "application/json": {
          schema: z.object({
            locations: z.array(locationSchema).openapi({
              description: "Array of public locations (non-deleted)",
            }),
          }),
        },
      },
    },
    ...standardErrors,
  },
  tags: ["locations"],
  summary: "List public locations",
  description: "Retrieves all non-deleted locations. Available to all users.",
});

export const adminListLocationsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "Get all locations (admin)",
      content: {
        "application/json": {
          schema: z.object({
            locations: z.array(locationSchema).openapi({
              description: "Array of all locations including deleted ones",
            }),
          }),
        },
      },
    },
    ...standardErrors,
  },
  tags: ["locations", "admin"],
  summary: "List all locations (admin)",
  description: "Retrieves all locations including soft-deleted ones. Requires admin authentication.",
});

export const saveLocationRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: locationSchema.openapi({
            description: "Location to create or update. Include id to update existing location.",
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create or update a location",
      content: {
        "application/json": {
          schema: responseWrappers.created().extend({
            id: z.string().optional().openapi({
              example: "loc_123",
              description: "ID of the created/updated location",
            }),
          }),
        },
      },
    },
    ...standardErrors,
  },
  tags: ["locations", "admin"],
  summary: "Save location (admin)",
  description: "Creates a new location or updates an existing one. Requires admin authentication.",
});

export const deleteLocationRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        example: "loc_123",
        description: "Location ID to delete",
      }),
    }),
  },
  responses: {
    200: {
      description: "Delete a location",
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
    },
    ...standardErrors,
  },
  tags: ["locations", "admin"],
  summary: "Delete location (admin)",
  description: "Soft-deletes a location by ID. Requires admin authentication.",
});
