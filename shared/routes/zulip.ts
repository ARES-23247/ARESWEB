/**
 * ─────────────────────────────────────────────────────────────────────────────
 * ZULIP API ROUTES
 * ─────────────────────────────────────────────────────────────────────────────
 * Routes for Zulip chat integration.
 *
 * NOTE: These schemas define request/response contracts for Zulip's external API,
 * not database entities. They do not use auto-generated Drizzle schemas because
 * they interact with Zulip's API directly, not our database.
 *
 * Zulip API Docs: https://zulip.com/api/
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";

/**
 * Zulip Presence Schema
 * Represents presence status for Zulip users
 */
export const zulipPresenceSchema = z.record(
  z.string().openapi({ description: "User email or ID" }),
  z.object({
    active: z
      .object({
        status: z.string().openapi({
          example: "active",
          description: "Active status string",
        }),
        timestamp: z.number().openapi({
          example: 1715260800,
          description: "Unix timestamp of last activity",
        }),
      })
      .optional()
      .openapi({ description: "Active presence data" }),
    idle: z
      .object({
        status: z.string().openapi({
          example: "idle",
          description: "Idle status string",
        }),
        timestamp: z.number().openapi({
          example: 1715260800,
          description: "Unix timestamp when user went idle",
        }),
      })
      .optional()
      .openapi({ description: "Idle presence data" }),
  })
);

/**
 * GET /presence - Get Zulip team presence data
 */
export const getPresenceRoute = createRoute({
  method: "get",
  path: "/presence",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            presence: zulipPresenceSchema.openapi({
              description: "Map of user IDs to presence data",
            }),
            userNames: z
              .record(z.string(), z.string())
              .optional()
              .openapi({ description: "Map of user IDs to display names" }),
          }),
        },
      },
      description: "Zulip team presence data",
    },
  },
  tags: ["zulip"],
  summary: "Get team presence",
  description:
    "Retrieves presence information (online/idle/offline) for all team members.",
});

/**
 * POST /message - Send a message to a Zulip stream
 */
export const sendMessageRoute = createRoute({
  method: "post",
  path: "/message",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            stream: z.string().openapi({
              example: "general",
              description: "Zulip stream name",
            }),
            topic: z.string().openapi({
              example: "Meeting notes",
              description: "Zulip topic within the stream",
            }),
            content: z.string().openapi({
              example: "Hello from ARES Web!",
              description: "Message content (supports Markdown)",
            }),
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean().openapi({ example: true }) }),
        },
      },
      description: "Message sent successfully",
    },
  },
  tags: ["zulip"],
  summary: "Send message",
  description: "Sends a message to a specified Zulip stream and topic.",
});

/**
 * GET /topic - Get messages from a specific topic
 */
export const getTopicMessagesRoute = createRoute({
  method: "get",
  path: "/topic",
  request: {
    query: z.object({
      stream: z.string().openapi({
        example: "general",
        description: "Zulip stream name",
      }),
      topic: z.string().openapi({
        example: "Meeting notes",
        description: "Zulip topic within the stream",
      }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              messages: z.array(z.unknown()).openapi({
                description: "Array of Zulip message objects",
              }),
            })
            .openapi({ description: "Messages for the specified topic" }),
        },
      },
      description: "Messages for the specified topic",
    },
  },
  tags: ["zulip"],
  summary: "Get topic messages",
  description: "Retrieves all messages from a specific stream topic.",
});

/**
 * GET /invites/audit - Audit missing Zulip users
 */
export const auditMissingUsersRoute = createRoute({
  method: "get",
  path: "/invites/audit",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({ example: true }),
            missingEmails: z.array(z.string()).openapi({
              description: "Emails of ARES users not in Zulip",
              example: ["newuser@example.com"],
            }),
            debug: z.object({
              totalZulipUsers: z.number().openapi({
                example: 25,
                description: "Total users in Zulip organization",
              }),
              totalAresUsers: z.number().openapi({
                example: 30,
                description: "Total users in ARES system",
              }),
              sampleZulipEmails: z.array(z.string()).openapi({
                description: "Sample of Zulip user emails for debugging",
              }),
              sampleMissingEmails: z.array(z.string()).openapi({
                description: "Sample of missing emails for debugging",
              }),
            }),
          }),
        },
      },
      description: "Audit results of missing Zulip users",
    },
  },
  tags: ["zulip"],
  summary: "Audit missing users",
  description:
    "Compares ARES user list with Zulip organization members to identify users who need invitations.",
});

/**
 * POST /invites/send - Send Zulip invitations
 */
export const inviteUsersRoute = createRoute({
  method: "post",
  path: "/invites/send",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            emails: z.array(z.string().email()).openapi({
              description: "List of email addresses to invite",
              example: ["newuser@example.com"],
            }),
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z
            .object({
              success: z.boolean().openapi({ example: true }),
              invitedCount: z.number().openapi({
                example: 5,
                description: "Number of invitations sent",
              }),
            })
            .openapi({ description: "Invitations sent" }),
        },
      },
      description: "Invitations sent",
    },
  },
  tags: ["zulip"],
  summary: "Send invitations",
  description: "Sends invitations to join the Zulip organization to the specified email addresses.",
});
