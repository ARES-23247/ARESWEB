import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Convert standardErrors to OpenAPI responses format
const openApiErrorResponses = {
  400: { content: { "application/json": { schema: standardErrors[400] } }, description: "Bad Request" },
  401: { content: { "application/json": { schema: standardErrors[401] } }, description: "Unauthorized" },
  403: { content: { "application/json": { schema: standardErrors[403] } }, description: "Forbidden" },
  404: { content: { "application/json": { schema: standardErrors[404] } }, description: "Not Found" },
  500: { content: { "application/json": { schema: standardErrors[500] } }, description: "Internal Server Error" },
};

export const getEntityLinksRoute = createRoute({
  method: "get",
  path: "/links",
  request: {
    query: z.object({
      type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
      id: z.string(),
    }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            links: z.array(z.object({
              id: z.string(),
              target_type: z.string(),
              target_id: z.string(),
              target_title: z.string().nullable(),
              link_type: z.string(),
            })),
          }),
        },
      },
      description: "Get knowledge graph links for an entity",
    },
  },
});

export const saveEntityLinkRoute = createRoute({
  method: "post",
  path: "/links",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            source_type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
            source_id: z.string(),
            target_type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
            target_id: z.string(),
            link_type: z.string().default('reference'),
          }),
        },
      },
    },
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: "Create a bi-directional link in the knowledge graph",
    },
  },
});

export const deleteEntityLinkRoute = createRoute({
  method: "delete",
  path: "/links/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...openApiErrorResponses,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Remove a link from the knowledge graph",
    },
  },
});
