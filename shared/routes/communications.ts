import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Request schemas
export const sendMassEmailSchema = z.object({
  subject: z.string().min(1, "Subject is required").openapi({ example: "Important Team Update" }),
  htmlContent: z.string().min(1, "Content is required").openapi({ example: "<p>Hello team...</p>" }),
});

// Response schemas
export const massEmailResponseSchema = z.object({
  success: z.boolean().openapi({ example: true }),
  message: z.string().openapi({ example: "Emails dispatched successfully" }),
  recipientCount: z.number().optional().openapi({ example: 25 }),
});

export const statsResponseSchema = z.object({
  activeUsers: z.number().openapi({ example: 42 }),
});

// Routes
export const sendMassEmailRoute = createRoute({
  method: "post",
  path: "/mass-email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: sendMassEmailSchema,
          example: {
            subject: "Important Team Update",
            htmlContent: "<p>Hello team, this is an important announcement...</p>",
          },
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      description: "Emails dispatched successfully",
      content: {
        "application/json": {
          schema: massEmailResponseSchema,
          example: {
            success: true,
            message: "Emails dispatched successfully",
            recipientCount: 25,
          },
        },
      },
    },
  },
  tags: ["communications", "admin"],
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/stats",
  responses: {
    ...standardErrors,
    200: {
      description: "Get count of active users for mass email preview",
      content: {
        "application/json": {
          schema: statsResponseSchema,
          example: {
            activeUsers: 42,
          },
        },
      },
    },
  },
  tags: ["communications", "admin"],
});
