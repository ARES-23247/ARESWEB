import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";

export const githubWebhookRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["webhooks"],
  summary: "GitHub Webhook",
  description: "Handles incoming GitHub webhook events.",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.record(z.any()), // Webhook payloads are dynamic
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            received: z.boolean(),
            event: z.string(),
          }),
        },
      },
      description: "Webhook received",
    },
    401: { description: "Invalid signature" },
    400: { description: "Invalid JSON" },
    503: { description: "Webhook not configured" },
  },
});

export const zulipWebhookRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["webhooks"],
  summary: "Zulip Webhook",
  description: "Handles outgoing Zulip webhook events (bot commands).",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            token: z.string(),
            message: z.object({
              id: z.number(),
              sender_id: z.number(),
              sender_email: z.string(),
              sender_full_name: z.string(),
              content: z.string(),
              display_recipient: z.string(),
              subject: z.string(),
              topic: z.string().optional(),
              type: z.string(),
            }),
            trigger: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            content: z.string(),
          }),
        },
      },
      description: "Zulip response",
    },
    401: { description: "Unauthorized" },
  },
});
