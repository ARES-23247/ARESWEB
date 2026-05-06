import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Alias is required"),
  address: z.string().min(1, "Address is required"),
  maps_url: z.string().url("Invalid maps URL format").optional().nullable().or(z.literal("")),
  is_deleted: z.number().default(0),
});

export const listLocationsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    200: {
      description: "Get all public locations",
      content: { "application/json": { schema: z.object({ locations: z.array(locationSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const adminListLocationsRoute = createRoute({
  method: "get",
  path: "/admin/list",
  responses: {
    200: {
      description: "Get all locations (admin)",
      content: { "application/json": { schema: z.object({ locations: z.array(locationSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveLocationRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: { "application/json": { schema: locationSchema } },
    },
  },
  responses: {
    200: {
      description: "Create or update a location",
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string().optional() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteLocationRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete a location",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
