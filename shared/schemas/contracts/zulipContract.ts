import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

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
    200: {
      description: "Get Zulip team presence",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            presence: zulipPresenceSchema,
            userNames: z.record(z.string(), z.string()).optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const sendMessageRoute = createRoute({
  method: "post",
  path: "/message",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            stream: z.string(),
            topic: z.string(),
            content: z.string(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Send a Zulip message",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const getTopicMessagesRoute = createRoute({
  method: "get",
  path: "/topic",
  request: {
    query: z.object({
      stream: z.string(),
      topic: z.string(),
    }),
  },
  responses: {
    200: {
      description: "Get messages for a specific Zulip topic",
      content: { "application/json": { schema: z.object({ success: z.boolean(), messages: z.array(z.unknown()) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const auditMissingUsersRoute = createRoute({
  method: "get",
  path: "/invites/audit",
  responses: {
    200: {
      description: "Audit ARESWEB database against Zulip directory to find missing users",
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
    },
    ...openApiStandardErrors,
  },
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
    200: {
      description: "Send Zulip invitations to the specified emails",
      content: { "application/json": { schema: z.object({ success: z.boolean(), invitedCount: z.number() }) } },
    },
    ...openApiStandardErrors,
  },
});
