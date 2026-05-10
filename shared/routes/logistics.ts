import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { responseWrappers } from "../db/schema-openapi";

// Response schemas
export const logisticsSummarySchema = z.object({
  totalCount: z.number().openapi({ example: 25 }),
  memberCounts: z.record(z.string(), z.number()).openapi({
    example: { "Mechanical": 8, "Programming": 10, "Electrical": 5, "Outreach": 2 }
  }),
  dietary: z.record(z.string(), z.number()).openapi({
    example: { "Vegetarian": 3, "Gluten-free": 1, "None": 21 }
  }),
  tshirts: z.record(z.string(), z.number()).openapi({
    example: { "S": 5, "M": 10, "L": 7, "XL": 3 }
  }),
}).openapi({ title: "Logistics Summary" });

export const logisticsUserSchema = z.object({
  name: z.string().openapi({ example: "Jane Doe" }),
  email: z.string().openapi({ example: "jane@example.com" }),
  role: z.string().openapi({ example: "member" }),
  emergencyName: z.string().nullable().optional().openapi({ example: "John Doe" }),
  emergencyPhone: z.string().nullable().optional().openapi({ example: "555-1234" }),
}).openapi({ title: "Logistics User" });

export const logisticsEmailsSchema = z.object({
  users: z.array(logisticsUserSchema),
}).openapi({ title: "Logistics Emails Export" });

export const getLogisticsSummaryRoute = createRoute({
  method: "get",
  path: "/admin/summary",
  responses: {
    200: {
      description: "Get aggregated logistics for event planning",
      content: {
        "application/json": {
          schema: logisticsSummarySchema,
          example: {
            totalCount: 25,
            memberCounts: { "Mechanical": 8, "Programming": 10, "Electrical": 5, "Outreach": 2 },
            dietary: { "Vegetarian": 3, "Gluten-free": 1, "None": 21 },
            tshirts: { "S": 5, "M": 10, "L": 7, "XL": 3 },
          },
        },
      },
      ...standardErrors,
    },
  },
  tags: ["logistics", "admin"],
});

export const exportLogisticsEmailsRoute = createRoute({
  method: "get",
  path: "/admin/export-emails",
  responses: {
    200: {
      description: "Get all active member emails for mass communication",
      content: {
        "application/json": {
          schema: logisticsEmailsSchema,
          example: {
            users: [
              {
                name: "Jane Doe",
                email: "jane@example.com",
                role: "member",
                emergencyName: "John Doe",
                emergencyPhone: "555-1234",
              },
            ],
          },
        },
      },
      ...standardErrors,
    },
  },
  tags: ["logistics", "admin"],
});
