import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Gmail message schemas
export const gmailHeaderSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export type GmailPayload = {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: { name: string; value: string; }[];
  body?: { data?: string; size?: number; attachmentId?: string; };
  parts?: GmailPayload[];
};

export const gmailPayloadSchema: z.ZodType<GmailPayload> = z.object({
  partId: z.string().optional(),
  mimeType: z.string().optional(),
  filename: z.string().optional(),
  headers: z.array(gmailHeaderSchema).optional(),
  body: z.object({
    data: z.string().optional(),
    size: z.number().optional(),
    attachmentId: z.string().optional(),
  }).optional(),
  parts: z.lazy(() => z.array(gmailPayloadSchema)).optional(),
});

export const gmailMessageSchema = z.object({
  id: z.string(),
  threadId: z.string(),
  labelIds: z.array(z.string()).optional(),
  snippet: z.string(),
  payload: gmailPayloadSchema.optional(),
  internalDate: z.string(),
});

export const gmailThreadSchema = z.object({
  id: z.string(),
  historyId: z.string(),
  messages: z.array(gmailMessageSchema),
});

export const gmailLabelSchema = z.object({
  id: z.string(),
  name: z.string(),
  messageListVisibility: z.string().optional(),
  labelListVisibility: z.string().optional(),
  type: z.enum(["system", "user"]).optional(),
});

export const listMessagesQuerySchema = z.object({
  labelIds: z.string().optional().openapi({ example: "INBOX" }),
  maxResults: z.coerce.number().int().max(50).default(20).openapi({ example: 20 }),
  pageToken: z.string().optional().openapi({ example: "token_pagination" }),
  q: z.string().optional().openapi({ example: "from:sponsor@example.com" }),
});

export const listMessagesResponseSchema = z.object({
  messages: z.array(z.object({
    id: z.string(),
    threadId: z.string(),
    snippet: z.string().optional(),
  })).optional(),
  nextPageToken: z.string().optional(),
  resultSizeEstimate: z.number().optional(),
});

export const getMessageResponseSchema = gmailMessageSchema;

export const getThreadResponseSchema = gmailThreadSchema;

export const listLabelsResponseSchema = z.object({
  labels: z.array(gmailLabelSchema),
});

export const sendMessageInputSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient is required"),
  subject: z.string().min(1, "Subject is required"),
  body: z.string().min(1, "Email body is required"),
  cc: z.array(z.string().email()).optional(),
  bcc: z.array(z.string().email()).optional(),
  threadId: z.string().optional().openapi({ description: "Include to reply to a thread" }),
});

export const sendMessageResponseSchema = z.object({
  id: z.string().openapi({ description: "The message ID" }),
  threadId: z.string().openapi({ description: "The thread ID" }),
  labelIds: z.array(z.string()).optional(),
});

// Routes
export const checkAuthStatusRoute = createRoute({
  method: "get",
  path: "/status",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            isAuthenticated: z.boolean(),
            memberType: z.enum(["student", "mentor", "coach"]).optional(),
          }),
        },
      },
      description: "Returns true if Google OAuth is connected (Gmail uses unified OAuth)",
    },
  },
  tags: ["gmail", "admin"],
});

export const listMessagesRoute = createRoute({
  method: "get",
  path: "/messages",
  request: {
    query: listMessagesQuerySchema,
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: listMessagesResponseSchema,
        },
      },
      description: "List of messages in the mailbox",
    },
  },
  tags: ["gmail", "admin"],
});

export const getMessageRoute = createRoute({
  method: "get",
  path: "/messages/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "18e4a12b34c56d78" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: getMessageResponseSchema,
        },
      },
      description: "Full message details including payload",
    },
  },
  tags: ["gmail", "admin"],
});

export const getThreadRoute = createRoute({
  method: "get",
  path: "/threads/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "18e4a12b34c56d78" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: getThreadResponseSchema,
        },
      },
      description: "Thread with all messages in the conversation",
    },
  },
  tags: ["gmail", "admin"],
});

export const listLabelsRoute = createRoute({
  method: "get",
  path: "/labels",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: listLabelsResponseSchema,
        },
      },
      description: "List of all labels in the mailbox",
    },
  },
  tags: ["gmail", "admin"],
});

export const sendMessageRoute = createRoute({
  method: "post",
  path: "/messages/send",
  request: {
    body: {
      content: {
        "application/json": {
          schema: sendMessageInputSchema,
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: sendMessageResponseSchema,
        },
      },
      description: "Message sent successfully",
    },
  },
  tags: ["gmail", "admin"],
});
