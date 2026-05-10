import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

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
          schema: z.object({
            success: z.boolean(),
            deleted: z.object({
              docs: z.number(),
              comments: z.number(),
              seasons: z.number(),
            }),
          }),
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
      q: z.string().min(3),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            results: z.array(z.object({
              type: z.enum(["blog", "event", "doc"]),
              id: z.string(),
              title: z.string(),
              snippet: z.string(),
            })),
          }),
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
      limit: z.string().optional(),
      offset: z.string().optional(),
    }),
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            logs: z.array(z.object({
              id: z.string(),
              actor: z.string().nullable(),
              action: z.string(),
              resourceType: z.string().nullable(),
              resourceId: z.string().nullable(),
              createdAt: z.string(),
              details: z.string(),
            })),
          }),
        },
      },
      description: "Audit logs",
    },
  },
});
