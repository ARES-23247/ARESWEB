import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const logisticsSummarySchema = z.object({
  totalCount: z.number(),
  memberCounts: z.record(z.string(), z.number()),
  dietary: z.record(z.string(), z.number()),
  tshirts: z.record(z.string(), z.number()),
});

export const getLogisticsSummaryRoute = createRoute({
  method: "get",
  path: "/admin/summary",
  responses: {
    200: {
      description: "Get aggregated logistics for event planning",
      content: { "application/json": { schema: logisticsSummarySchema } },
    },
    ...openApiStandardErrors,
  },
});

export const exportLogisticsEmailsRoute = createRoute({
  method: "get",
  path: "/admin/export-emails",
  responses: {
    200: {
      description: "Get all active member emails for mass communication",
      content: {
        "application/json": {
          schema: z.object({
            users: z.array(z.object({
              name: z.string(),
              email: z.string(),
              role: z.string(),
              emergencyName: z.string().nullable().optional(),
              emergencyPhone: z.string().nullable().optional(),
            }))
          })
        }
      },
    },
    ...openApiStandardErrors,
  },
});
