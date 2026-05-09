/**
 * AI API - RAG Chatbot, Content Generation, External Sources
 *
 * Types imported from backend route definitions in @shared/routes/ai.ts
 */

import { useQuery, useMutation, useQueryClient, type UseQueryOptions, type UseMutationOptions } from "@tanstack/react-query";
import { z } from "zod";
import { client, unwrapResponse, withMutationCallbacks } from "./honoClient";

// Re-export schemas for type inference
import {
  ChatMessageSchema,
  MessageContentSchema,
} from "@shared/routes/ai";

// Infer TypeScript types from Zod schemas
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type MessageContent = z.infer<typeof MessageContentSchema>;

export interface AIStatusResponse {
  zai: boolean;
  workersAI: boolean;
  vectorize: boolean;
  primaryModel: string;
  indexErrors?: {
    timestamp: string;
    errors: string[];
  } | null;
}

export interface AIExternalSource {
  id: string;
  type: string;
  url: string;
  branch: string;
  status: string;
  created_at: string;
  last_indexed_at?: string | null;
}

export interface AIExternalSourcesResponse {
  sources: AIExternalSource[];
}

export interface ReindexExternalResponse {
  success?: boolean;
  indexed?: number;
  errors?: string[];
  error?: string;
}

export interface AISuggestResponse {
  suggestion: string;
}

export interface ChatSessionResponse {
  messages: ChatMessage[];
}

// ============================================
// AI Status
// ============================================

/**
 * GET /api/ai/status - Get AI service status
 */
export function useGetAIStatus(
  options?: Omit<UseQueryOptions<AIStatusResponse>, "queryKey" | "queryFn">
) {
  return useQuery<AIStatusResponse>({
    queryKey: ["ai", "status"],
    queryFn: async () => {
      const response = await client.ai.status.$get();
      return unwrapResponse<AIStatusResponse>(response);
    },
    ...options,
  });
}

// ============================================
// RAG Chatbot
// ============================================

/**
 * POST /api/ai/rag-chatbot - RAG-powered AI chatbot (SSE stream)
 *
 * Note: This endpoint returns a Server-Sent Events stream.
 * The hook below only initiates the request. Callers should handle
 * the response body directly for streaming.
 */
export async function ragChatbotRequest(query: string, turnstileToken: string, sessionId?: string): Promise<Response> {
  const response = await client.ai["rag-chatbot"].$post({
    json: { query, turnstileToken, sessionId }
  });
  return response as unknown as Response;
}

/**
 * POST /api/ai/sim-playground - AI assistance for simulation playground (SSE stream)
 */
export async function simPlaygroundRequest(
  systemPrompt: string,
  messages: ChatMessage[],
  imageUrl?: string
): Promise<Response> {
  const response = await client.ai["sim-playground"].$post({
    json: { systemPrompt, messages, imageUrl }
  });
  return response as unknown as Response;
}

// ============================================
// AI Suggestions
// ============================================

/**
 * POST /api/ai/suggest - AI inline suggestions for editor
 */
export function useAISuggest(
  options?: Omit<UseMutationOptions<AISuggestResponse, Error, { context: string }>, "mutationFn">
) {
  return useMutation<AISuggestResponse, Error, { context: string }>({
    mutationFn: async (data) => {
      const response = await client.ai.suggest.$post({ json: data });
      return unwrapResponse<AISuggestResponse>(response);
    },
    ...options,
  });
}

// ============================================
// External Knowledge Sources (Admin)
// ============================================

/**
 * GET /api/ai/external-sources - List external knowledge sources
 */
export function useGetExternalSources(
  options?: Omit<UseQueryOptions<AIExternalSource[]>, "queryKey" | "queryFn">
) {
  return useQuery<AIExternalSource[]>({
    queryKey: ["ai", "external-sources"],
    queryFn: async () => {
      const response = await fetch("/api/ai/external-sources");
      if (!response.ok) {
        throw new Error("Failed to fetch external sources");
      }
      return response.json() as Promise<AIExternalSource[]>;
    },
    ...options,
  });
}

/**
 * POST /api/ai/external-sources - Add external knowledge source
 */
export function useAddExternalSource(
  options?: Omit<UseMutationOptions<{ id: string; success: boolean }, Error, { type: string; url: string; branch?: string }>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ id: string; success: boolean }, Error, { type: string; url: string; branch?: string }>({
    mutationFn: async (data) => {
      const response = await fetch("/api/ai/external-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to add external source");
      }
      return response.json() as Promise<{ id: string; success: boolean }>;
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["ai", "external-sources"] });
        qc.invalidateQueries({ queryKey: ["ai", "status"] });
      }
    })
  });
}

/**
 * DELETE /api/ai/external-sources/:id - Delete external knowledge source
 */
export function useDeleteExternalSource(
  options?: Omit<UseMutationOptions<{ success: boolean }, Error, string>, "mutationFn">
) {
  const queryClient = useQueryClient();
  return useMutation<{ success: boolean }, Error, string>({
    mutationFn: async (id) => {
      const response = await fetch(`/api/ai/external-sources/${id}`, { method: "DELETE" });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "Failed to delete external source");
      }
      return { success: true };
    },
    ...withMutationCallbacks(queryClient, options, {
      onSuccess: (qc) => {
        qc.invalidateQueries({ queryKey: ["ai", "external-sources"] });
      }
    })
  });
}

/**
 * POST /api/ai/reindex-external - Reindex external knowledge sources
 */
export async function reindexExternalRequest(sourceId?: string): Promise<ReindexExternalResponse> {
  const response = await fetch("/api/ai/reindex-external", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sourceId })
  });
  if (!response.ok) {
    throw new Error(`Reindex failed: ${response.statusText}`);
  }
  return response.json() as Promise<ReindexExternalResponse>;
}

// ============================================
// Chat Sessions
// ============================================

/**
 * GET /api/ai/chat-session/:id - Get chat session history
 */
export async function getChatSession(id: string): Promise<ChatSessionResponse> {
  const response = await fetch(`/api/ai/chat-session/${id}`);
  if (!response.ok) {
    throw new Error(`Failed to load chat session: ${response.status}`);
  }
  return response.json() as Promise<ChatSessionResponse>;
}
