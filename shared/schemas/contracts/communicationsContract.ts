import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const sendMassEmailRequestBodySchema = z.object({
  subject: z.string().min(1, "Subject is required"),
  htmlContent: z.string().min(1, "Content is required"),
});

export const sendMassEmailRoute = createRoute({
  method: "post",
  path: "/mass-email",
  request: {
    body: {
      content: { "application/json": { schema: sendMassEmailRequestBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Send mass email to active Zulip members via Resend",
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
      content: { "application/json": { schema: z.object({ activeUsers: z.number() }) } },
    },
    ...openApiStandardErrors,
  },
});
