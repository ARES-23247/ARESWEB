import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const liveblocksCopilotRequestBodySchema = z.object({
  documentContext: z.string(),
  prompt: z.string(),
  action: z.enum(["summarize", "expand", "question", "ghost-text"]),
});

export const ragChatbotRequestBodySchema = z.object({
  query: z.string(),
  turnstileToken: z.string(),
  sessionId: z.string().optional(),
});

export const liveblocksCopilotRoute = createRoute({
  method: "post",
  path: "/liveblocks-copilot",
  request: {
    body: {
      content: { "application/json": { schema: liveblocksCopilotRequestBodySchema } },
    },
  },
  responses: {
    // Server-Sent Events (SSE) don't have a standard OpenAPI response type,
    // but we define the expected success response for completeness.
    200: {
      description: "Interact with the Liveblocks AI Copilot via SSE",
      content: { "text/event-stream": { schema: z.unknown() } },
    },
    ...openApiStandardErrors,
  },
});

export const ragChatbotRoute = createRoute({
  method: "post",
  path: "/rag-chatbot",
  request: {
    body: {
      content: { "application/json": { schema: ragChatbotRequestBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Query the Global RAG Chatbot via SSE",
      content: { "text/event-stream": { schema: z.unknown() } },
    },
    ...openApiStandardErrors,
  },
});
