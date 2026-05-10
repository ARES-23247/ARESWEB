import { createRoute, z } from "@hono/zod-openapi";
import { selectExternalKnowledgeSourceSchema } from "../db/schema-zod";
import { createResponseSchema, responseWrappers } from "../db/schema-openapi";

// Discriminated union for better type safety - text and image have distinct required fields
const MessageContentTextSchema = z.object({
  type: z.literal("text"),
  text: z.string(),
});

const MessageContentImageSchema = z.object({
  type: z.literal("image"),
  source: z.object({
    type: z.literal("base64"),
    media_type: z.string(),
    data: z.string(),
  }),
});

const MessageContentItemSchema = z.discriminatedUnion("type", [
  MessageContentTextSchema,
  MessageContentImageSchema,
]);

// Content can be a simple string or an array of discriminated content items
export const MessageContentSchema = z.union([
  z.string(),
  z.array(MessageContentItemSchema),
]);

export const ChatMessageSchema = z.object({
  role: z.enum(["system", "user", "assistant"]),
  content: MessageContentSchema,
});

export const aiStatusRoute = createRoute({
  method: "get",
  path: "/status",
  summary: "Get AI service status",
  responses: {
    200: {
      content: {
        "application/json": {
          schema: z.object({
            zai: z.boolean(),
            workersAI: z.boolean(),
            vectorize: z.boolean(),
            primaryModel: z.string(),
            indexErrors: z.any().nullable(),
          }),
        },
      },
      description: "AI service status",
    },
  },
});

export const liveblocksCopilotRoute = createRoute({
  method: "post",
  path: "/liveblocks-copilot",
  summary: "AI Copilot for Liveblocks editor",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            documentContext: z.string(),
            action: z.enum(["summarize", "expand", "grammar", "modify"]),
            imageUrl: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "SSE stream of AI response",
    },
  },
});

export const simPlaygroundRoute = createRoute({
  method: "post",
  path: "/sim-playground",
  summary: "AI assistance for simulation playground",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            systemPrompt: z.string(),
            messages: z.array(ChatMessageSchema),
            imageUrl: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "SSE stream of AI response",
    },
  },
});

export const editorChatRoute = createRoute({
  method: "post",
  path: "/editor-chat",
  summary: "AI chat for document editor",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            systemPrompt: z.string(),
            messages: z.array(ChatMessageSchema),
            editorContent: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "SSE stream of AI response",
    },
  },
});

export const aiSuggestRoute = createRoute({
  method: "post",
  path: "/suggest",
  summary: "AI inline suggestions for editor",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            context: z.string(),
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
            suggestion: z.string(),
          }),
        },
      },
      description: "AI suggestion",
    },
  },
});

export const ragChatbotRoute = createRoute({
  method: "post",
  path: "/rag-chatbot",
  summary: "RAG-powered AI chatbot",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            query: z.string(),
            turnstileToken: z.string(),
            sessionId: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "SSE stream of AI response",
    },
  },
});

export const reindexRoute = createRoute({
  method: "post",
  path: "/admin/reindex",
  summary: "Reindex AI search database",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            force: z.boolean().optional(),
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
            indexed: z.number(),
            skipped: z.number(),
            errors: z.array(z.string()),
          }),
        },
      },
      description: "Reindex results",
    },
  },
});

export const reindexExternalRoute = createRoute({
  method: "post",
  path: "/admin/reindex-external",
  summary: "Reindex external knowledge source",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            sourceId: z.string().optional(),
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
            indexed: z.number(),
            skipped: z.number(),
            errors: z.array(z.string()),
          }),
        },
      },
      description: "External reindex results",
    },
  },
});

export const externalSourcesRoute = createRoute({
  method: "post",
  path: "/admin/external-sources",
  summary: "Add external knowledge source",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            type: z.string(),
            url: z.string().url(),
            branch: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.created().extend({
            source: createResponseSchema(selectExternalKnowledgeSourceSchema, {
              title: "External Knowledge Source",
              example: {
                id: "source_123",
                type: "github",
                url: "https://github.com/FTC-ARES/robot-code",
                branch: "main",
                status: "active",
                lastIndexedSha: null,
                lastIndexedAt: null,
                createdAt: "2025-01-15T10:00:00Z",
              },
            }).optional(),
          }),
        },
      },
      description: "External source added",
    },
  },
});
