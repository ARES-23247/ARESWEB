import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

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
    ...standardErrors,
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
  tags: ["entities"],
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
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), id: z.string() }),
        },
      },
      description: "Create a bi-directional link in the knowledge graph",
    },
  },
  tags: ["entities"],
});

export const deleteEntityLinkRoute = createRoute({
  method: "delete",
  path: "/links/{id}",
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
      description: "Remove a link from the knowledge graph",
    },
  },
  tags: ["entities"],
});
