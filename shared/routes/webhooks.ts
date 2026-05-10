/**
 * ─────────────────────────────────────────────────────────────────────────────
 * WEBHOOK ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for handling incoming webhooks from external services.
 *
 * NOTE: These schemas define request/response contracts for webhook endpoints,
 * not database entities. They do not use auto-generated Drizzle schemas because
 * they handle external service events (GitHub webhooks, Zulip bot commands).
 *
 * GitHub Webhooks: https://docs.github.com/en/webhooks
 * Zulip Outgoing Webhooks: https://zulip.com/api/outgoing-webhooks
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";

/**
 * GitHub Webhook Route
 * Handles incoming webhook events from GitHub
 */
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
          schema: z
            .record(z.string(), z.any())
            .openapi({
              description:
                "Dynamic GitHub webhook payload (varies by event type)",
              example: {
                ref: "refs/heads/main",
                repository: {
                  name: "ARESWEB",
                  full_name: "FTC-ARES/ARESWEB",
                },
                pusher: {
                  name: "username",
                },
              },
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
            received: z.boolean().openapi({ example: true }),
            event: z.string().openapi({ example: "push" }),
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

/**
 * Zulip Webhook Route
 * Handles outgoing Zulip webhook events (bot commands)
 */
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
            token: z.string().openapi({
              description: "Verification token for webhook",
              example: "xxxxxxxxxxxx",
            }),
            message: z.object({
              id: z.number().optional().openapi({ example: 12345 }),
              sender_id: z.number().optional().openapi({ example: 6789 }),
              sender_email: z.string().optional().openapi({
                example: "user@example.com",
              }),
              sender_full_name: z.string().optional().openapi({
                example: "John Doe",
              }),
              content: z.string().optional().openapi({
                example: "@bot help",
              }),
              display_recipient: z.string().optional().openapi({
                example: "general",
              }),
              subject: z.string().optional().openapi({
                example: "Bot commands",
              }),
              topic: z.string().optional().openapi({
                example: "Bot commands",
              }),
              type: z.string().optional().openapi({
                example: "stream",
              }),
            }),
            trigger: z.string().optional().openapi({
              example: "mention",
              description: "What triggered the webhook",
            }),
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
            content: z.string().openapi({
              example: "Here are the available commands...",
              description: "Response message content",
            }),
          }),
        },
      },
      description: "Zulip response",
    },
    401: { description: "Unauthorized" },
    400: { description: "Validation Error" },
  },
});
