import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";

export const zulipPresenceSchema = z.record(
  z.string(),
  z.object({
    active: z
      .object({
        status: z.string(),
        timestamp: z.number(),
      })
      .optional(),
    idle: z
      .object({
        status: z.string(),
        timestamp: z.number(),
      })
      .optional(),
  }),
);

export const getPresenceRoute = createRoute({
  method: "get",
  path: "/presence",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            presence: zulipPresenceSchema,
            userNames: z.record(z.string(), z.string()).optional(),
          }),
        },
      },
      description: "Zulip team presence data",
    },
  },
  tags: ["zulip"],
});

export const sendMessageRoute = createRoute({
  method: "post",
  path: "/message",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            stream: z.string().openapi({ example: "general" }),
            topic: z.string().openapi({ example: "Meeting notes" }),
            content: z.string().openapi({ example: "Hello from ARES Web!" }),
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
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Message sent successfully",
    },
  },
  tags: ["zulip"],
});

export const getTopicMessagesRoute = createRoute({
  method: "get",
  path: "/topic",
  request: {
    query: z.object({
      stream: z.string().openapi({ example: "general" }),
      topic: z.string().openapi({ example: "Meeting notes" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean(), messages: z.array(z.unknown()) }),
        },
      },
      description: "Messages for the specified topic",
    },
  },
  tags: ["zulip"],
});

export const auditMissingUsersRoute = createRoute({
  method: "get",
  path: "/invites/audit",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            missingEmails: z.array(z.string()),
            debug: z.object({
              totalZulipUsers: z.number(),
              totalAresUsers: z.number(),
              sampleZulipEmails: z.array(z.string()),
              sampleMissingEmails: z.array(z.string()),
            }),
          }),
        },
      },
      description: "Audit results of missing Zulip users",
    },
  },
  tags: ["zulip"],
});

export const inviteUsersRoute = createRoute({
  method: "post",
  path: "/invites/send",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            emails: z.array(z.string()),
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
          schema: z.object({ success: z.boolean(), invitedCount: z.number() }),
        },
      },
      description: "Invitations sent",
    },
  },
  tags: ["zulip"],
});
