import { createRoute, z } from "@hono/zod-openapi";

export const MessageContentSchema = z.union([
  z.string(),
  z.array(z.object({
    type: z.enum(["text", "image"]),
    text: z.string().optional(),
    source: z.object({
      type: z.literal("base64"),
      media_type: z.string(),
      data: z.string(),
    }).optional(),
  })),
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
