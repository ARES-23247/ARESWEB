import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "../schemas/contracts/common";

// Routes
export const sendMassEmailRoute = createRoute({
  method: "post",
  path: "/mass-email",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            subject: z.string().min(1, "Subject is required"),
            htmlContent: z.string().min(1, "Content is required"),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Emails dispatched successfully",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
            recipientCount: z.number().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/stats",
  responses: {
    200: {
      description: "Get count of active users for mass email preview",
      content: {
        "application/json": {
          schema: z.object({
            activeUsers: z.number(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});
