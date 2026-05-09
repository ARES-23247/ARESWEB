import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const awardSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number(),
  eventName: z.string().nullable(),
  description: z.string().nullable(),
  imageUrl: z.string().nullable(),
  seasonId: z.coerce.number().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// Shared form schema for creating/editing awards
export const awardFormSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(1, "Title is required"),
  year: z.number().min(2000, "Year must be 2000 or later").max(2100, "Year must be 2100 or earlier"),
  eventName: z.string().optional().nullable(),
  description: z.string().optional().nullable(),
  imageUrl: z.string().optional().nullable(),
  seasonId: z.number().nullable().optional(),
});

export type AwardFormPayload = z.infer<typeof awardFormSchema>;

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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            awards: z.array(awardSchema),
          }),
        },
      },
      description: "Get all awards",
    },
  },
  tags: ["awards"],
});

export const saveAwardRoute = createRoute({
  method: "post",
  path: "/admin/save",
  request: {
    body: {
      content: {
        "application/json": {
          schema: awardFormSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string().optional() }),
        },
      },
      description: "Create or update an award",
    },
  },
  tags: ["awards", "admin"],
});

export const deleteAwardRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Soft-delete an award",
    },
  },
  tags: ["awards", "admin"],
});
