import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectEntityLinkSchema } from "../db/schema-zod";
import { createResponseSchema, responseWrappers } from "../db/schema-openapi";

// Response schemas derived from Drizzle
export const entityLinkSchema = createResponseSchema(
  selectEntityLinkSchema.pick({
    id: true,
    sourceType: true,
    sourceId: true,
    targetType: true,
    targetId: true,
    linkType: true,
  }),
  {
    title: "Entity Link",
    example: {
      id: "link-123",
      sourceType: "doc",
      sourceId: "doc-456",
      targetType: "task",
      targetId: "task-789",
      linkType: "reference",
    },
  }
);

export const entityLinkWithTargetSchema = z.object({
  id: z.string().openapi({ example: "link-123" }),
  targetType: z.string().openapi({ example: "task" }),
  targetId: z.string().openapi({ example: "task-789" }),
  targetTitle: z.string().nullable().optional().openapi({ example: "Design new chassis" }),
  linkType: z.string().openapi({ example: "reference" }),
}).openapi({ title: "Entity Link with Target Title" });

// Request schemas
export const entityLinkQuerySchema = z.object({
  type: z.enum(['doc', 'task', 'event', 'post', 'outreach']).openapi({ example: 'doc' }),
  id: z.string().openapi({ example: 'doc-456' }),
});

export const saveEntityLinkSchema = z.object({
  sourceType: z.enum(['doc', 'task', 'event', 'post', 'outreach']).openapi({ example: 'doc' }),
  sourceId: z.string().openapi({ example: 'doc-456' }),
  targetType: z.enum(['doc', 'task', 'event', 'post', 'outreach']).openapi({ example: 'task' }),
  targetId: z.string().openapi({ example: 'task-789' }),
  linkType: z.string().default('reference').openapi({ example: 'reference' }),
});

// Routes
export const getEntityLinksRoute = createRoute({
  method: "get",
  path: "/links",
  request: {
    query: entityLinkQuerySchema,
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            links: z.array(entityLinkWithTargetSchema),
          }),
          example: {
            links: [
              {
                id: "link-123",
                targetType: "task",
                targetId: "task-789",
                targetTitle: "Design new chassis",
                linkType: "reference",
              },
            ],
          },
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
          schema: saveEntityLinkSchema,
          example: {
            sourceType: "doc",
            sourceId: "doc-456",
            targetType: "task",
            targetId: "task-789",
            linkType: "reference",
          },
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.created(),
          example: {
            success: true,
            id: "link-123",
          },
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
    params: z.object({ id: z.string().openapi({ example: "link-123" }) }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
          example: { success: true },
        },
      },
      description: "Remove a link from the knowledge graph",
    },
  },
  tags: ["entities"],
});
