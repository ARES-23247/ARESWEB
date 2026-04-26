import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const locationSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Alias is required"),
  address: z.string().min(1, "Address is required"),
  maps_url: z.string().optional().nullable(),
  is_deleted: z.number().default(0),
});

export const locationContract = c.router({
  list: {
    method: "GET",
    path: "/",
    responses: {
      200: z.object({
        locations: z.array(locationSchema),
      }),
    },
    summary: "Get all public locations",
  },
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      200: z.object({
        locations: z.array(locationSchema),
      }),
    },
    summary: "Get all locations (admin)",
  },
  save: {
    method: "POST",
    path: "/admin/save",
    body: locationSchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
      }),
    },
    summary: "Create or update a location",
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
    },
    summary: "Delete a location",
  },
});
