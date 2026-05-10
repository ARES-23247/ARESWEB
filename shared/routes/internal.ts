import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectAuditLogSchema } from "../db/schema-zod";
import { createResponseSchema } from "../db/schema-openapi";

// Response schemas derived from Drizzle
export const gcDeletedSchema = z.object({
  docs: z.number().openapi({ example: 5 }),
  comments: z.number().openapi({ example: 12 }),
  seasons: z.number().openapi({ example: 0 }),
}).openapi({ title: "GC Deleted Counts" });

export const gcResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  deleted: gcDeletedSchema,
}).openapi({ title: "GC Response" });

export const searchResultSchema = z.object({
  type: z.enum(["blog", "event", "doc"]).openapi({ example: "blog" }),
  id: z.string().openapi({ example: "post-123" }),
  title: z.string().openapi({ example: "Competition Match Preview" }),
  snippet: z.string().openapi({ example: "A preview of our upcoming competition match..." }),
}).openapi({ title: "Search Result" });

export const searchResultsSchema = z.object({
  results: z.array(searchResultSchema),
}).openapi({ title: "Search Results" });

export const auditLogSchema = createResponseSchema(
  selectAuditLogSchema.pick({
    id: true,
    actor: true,
    action: true,
    resourceType: true,
    resourceId: true,
    createdAt: true,
    details: true,
  }),
  {
    title: "Audit Log Entry",
    example: {
      id: "log-123",
      actor: "user@example.com",
      action: "delete",
      resourceType: "post",
      resourceId: "post-456",
      createdAt: "2025-01-15T10:00:00Z",
      details: "Soft-deleted post",
    },
  }
);

export const auditLogsResponseSchema = z.object({
  logs: z.array(auditLogSchema),
}).openapi({ title: "Audit Logs Response" });

export const gcRoute = createRoute({
  method: "post",
  path: "/gc",
  tags: ["internal"],
  summary: "Internal Garbage Collection",
  description: "Triggers cleanup of soft-deleted records older than 30 days.",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: gcResponseSchema,
          example: {
            success: true,
            deleted: {
              docs: 5,
              comments: 12,
              seasons: 0,
            },
          },
        },
      },
      description: "GC completed",
    },
  },
});

export const searchRoute = createRoute({
  method: "get",
  path: "/search",
  tags: ["search"],
  summary: "Global Search",
  request: {
    query: z.object({
      q: z.string().min(3).openapi({ example: "competition" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: searchResultsSchema,
          example: {
            results: [
              {
                type: "blog",
                id: "post-123",
                title: "Competition Match Preview",
                snippet: "A preview of our upcoming competition match...",
              },
              {
                type: "event",
                id: "event-456",
                title: "Competition Day",
                snippet: "Regional qualifier event at the convention center...",
              },
            ],
          },
        },
      },
      description: "Search results",
    },
  },
});

export const auditLogRoute = createRoute({
  method: "get",
  path: "/admin/audit-log",
  tags: ["admin"],
  summary: "Get Admin Audit Logs",
  request: {
    query: z.object({
      limit: z.string().optional().openapi({ example: "50" }),
      offset: z.string().optional().openapi({ example: "0" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: auditLogsResponseSchema,
          example: {
            logs: [
              {
                id: "log-123",
                actor: "user@example.com",
                action: "delete",
                resourceType: "post",
                resourceId: "post-456",
                createdAt: "2025-01-15T10:00:00Z",
                details: "Soft-deleted post",
              },
            ],
          },
        },
      },
      description: "Audit logs",
    },
  },
});
