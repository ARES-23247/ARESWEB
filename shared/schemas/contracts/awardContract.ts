import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

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

export const getAwardsRoute = createRoute({
  method: "get",
  path: "/",
  request: {
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "Get all awards",
      content: { "application/json": { schema: z.object({ awards: z.array(awardSchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const saveAwardRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            id: z.string().optional(),
            title: z.string(),
            year: z.coerce.number(),
            event_name: z.string().optional().nullable(),
            description: z.string().optional().nullable(),
            image_url: z.string().optional().nullable(),
            season_id: z.coerce.number().optional().nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Create or update an award",
      content: { "application/json": { schema: z.object({ success: z.boolean(), id: z.string().optional() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteAwardRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Soft-delete an award",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
