import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as honoClient from "./honoClient";
import * as aiApi from "./ai";

// Mock the honoClient module
vi.mock("./honoClient", () => ({
  client: {
    ai: {
      status: {
        $get: vi.fn(),
      },
      "rag-chatbot": {
        $post: vi.fn(),
      },
      "sim-playground": {
        $post: vi.fn(),
      },
      suggest: {
        $post: vi.fn(),
      },
    },
  },
  unwrapResponse: vi.fn(),
  withMutationCallbacks: vi.fn((queryClient, options, callbacks) => {
    // Run internal callbacks first
    const originalOnSuccess = options?.onSuccess;
    const originalOnError = options?.onError;
    return {
      ...options,
      onSuccess: async (...args: unknown[]) => {
        await callbacks.onSuccess?.(queryClient, ...(args as [unknown, unknown]));
        await originalOnSuccess?.(...args as [unknown, unknown, unknown]);
      },
      onError: async (...args: unknown[]) => {
        await callbacks.onError?.(queryClient, ...(args as [unknown, unknown]));
        await originalOnError?.(...args as [unknown, unknown, unknown]);
      },
    };
  }),
  ApiError: class extends Error {
    constructor(public status: number, message: string) {
      super(message);
      this.name = "ApiError";
    }
  },
}));

// Mock global fetch for non-honoClient requests
global.fetch = vi.fn();

const mockClient = honoClient.client as unknown as {
  ai: {
    status: {
      $get: ReturnType<typeof vi.fn>;
    };
    "rag-chatbot": {
      $post: ReturnType<typeof vi.fn>;
    };
    "sim-playground": {
      $post: ReturnType<typeof vi.fn>;
    };
    suggest: {
      $post: ReturnType<typeof vi.fn>;
    };
  };
};
const mockUnwrapResponse = honoClient.unwrapResponse as ReturnType<typeof vi.fn>;

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={createQueryClient()}>{children}</QueryClientProvider>
);

describe("AI API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("useGetAIStatus", () => {
    it("should fetch AI status successfully", async () => {
      const mockResponse = {
        zai: true,
        workersAI: true,
        vectorize: true,
        primaryModel: "claude-3-5-sonnet",
        indexErrors: null,
      };
      mockClient.ai.status.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => aiApi.useGetAIStatus(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.ai.status.$get).toHaveBeenCalled();
    });

    it("should handle API errors", async () => {
      const mockError = new Error("Failed to fetch AI status");
      mockClient.ai.status.$get.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => aiApi.useGetAIStatus(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });

    it("should handle index errors", async () => {
      const mockResponse = {
        zai: true,
        workersAI: true,
        vectorize: false,
        primaryModel: "claude-3-5-sonnet",
        indexErrors: {
          timestamp: "2024-01-15T10:00:00Z",
          errors: ["Failed to index doc1", "Failed to index doc2"],
        },
      };
      mockClient.ai.status.$get.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => aiApi.useGetAIStatus(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data?.indexErrors).toBeDefined();
      expect(result.current.data?.indexErrors?.errors).toHaveLength(2);
    });
  });

  describe("ragChatbotRequest", () => {
    it("should send rag chatbot request successfully", async () => {
      const mockResponse = { ok: true };
      mockClient.ai["rag-chatbot"].$post.mockResolvedValue(mockResponse);

      const response = await aiApi.ragChatbotRequest("Hello AI", "turnstile-token", "session-123");

      expect(response).toEqual(mockResponse);
      expect(mockClient.ai["rag-chatbot"].$post).toHaveBeenCalledWith({
        json: { query: "Hello AI", turnstileToken: "turnstile-token", sessionId: "session-123" },
      });
    });

    it("should handle rag chatbot request without sessionId", async () => {
      const mockResponse = { ok: true };
      mockClient.ai["rag-chatbot"].$post.mockResolvedValue(mockResponse);

      await aiApi.ragChatbotRequest("Hello AI", "turnstile-token");

      expect(mockClient.ai["rag-chatbot"].$post).toHaveBeenCalledWith({
        json: { query: "Hello AI", turnstileToken: "turnstile-token", sessionId: undefined },
      });
    });
  });

  describe("simPlaygroundRequest", () => {
    it("should send sim playground request successfully", async () => {
      const mockResponse = { ok: true };
      const systemPrompt = "You are a coding assistant";
      const messages = [{ role: "user" as const, content: "Help me write code" }];
      const imageUrl = "https://example.com/image.png";

      mockClient.ai["sim-playground"].$post.mockResolvedValue(mockResponse);

      const response = await aiApi.simPlaygroundRequest(systemPrompt, messages, imageUrl);

      expect(response).toEqual(mockResponse);
      expect(mockClient.ai["sim-playground"].$post).toHaveBeenCalledWith({
        json: { systemPrompt, messages, imageUrl },
      });
    });

    it("should handle sim playground request without image", async () => {
      const mockResponse = { ok: true };
      const systemPrompt = "You are a coding assistant";
      const messages = [{ role: "user" as const, content: "Help me write code" }];

      mockClient.ai["sim-playground"].$post.mockResolvedValue(mockResponse);

      await aiApi.simPlaygroundRequest(systemPrompt, messages);

      expect(mockClient.ai["sim-playground"].$post).toHaveBeenCalledWith({
        json: { systemPrompt, messages, imageUrl: undefined },
      });
    });
  });

  describe("useAISuggest", () => {
    it("should get AI suggestion successfully", async () => {
      const mockResponse = { suggestion: "Consider using async/await here" };
      mockClient.ai.suggest.$post.mockResolvedValue({ ok: true });
      mockUnwrapResponse.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => aiApi.useAISuggest(), { wrapper });

      const context = "function getData() { return fetch('/api'); }";
      result.current.mutate({ context });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(mockClient.ai.suggest.$post).toHaveBeenCalledWith({
        json: { context },
      });
    });

    it("should handle suggestion errors", async () => {
      const mockError = new Error("Failed to get suggestion");
      mockClient.ai.suggest.$post.mockResolvedValue({ ok: false });
      mockUnwrapResponse.mockRejectedValue(mockError);

      const { result } = renderHook(() => aiApi.useAISuggest(), { wrapper });

      result.current.mutate({ context: "some code context" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(mockError);
    });
  });

  describe("useGetExternalSources", () => {
    it("should fetch external sources successfully", async () => {
      const mockSources = [
        {
          id: "github-1",
          type: "github",
          url: "https://github.com/ares23247/docs",
          branch: "main",
          status: "indexed",
          createdAt: "2024-01-01T00:00:00Z",
          last_indexed_at: "2024-01-15T00:00:00Z",
        },
        {
          id: "gitlab-1",
          type: "gitlab",
          url: "https://gitlab.com/ares/docs",
          branch: "master",
          status: "pending",
          createdAt: "2024-01-10T00:00:00Z",
        },
      ];

      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockSources,
      });

      const { result } = renderHook(() => aiApi.useGetExternalSources(), { wrapper });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockSources);
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/external-sources");
    });

    it("should handle fetch errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
      });

      const { result } = renderHook(() => aiApi.useGetExternalSources(), { wrapper });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Failed to fetch external sources");
    });
  });

  describe("useAddExternalSource", () => {
    it("should add external source successfully", async () => {
      const mockResponse = { id: "new-source-id", success: true };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const queryClient = createQueryClient();

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => aiApi.useAddExternalSource(), { wrapper: customWrapper });

      result.current.mutate({
        type: "github",
        url: "https://github.com/new/repo",
        branch: "main",
      });

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(result.current.data).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/external-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "github", url: "https://github.com/new/repo", branch: "main" }),
      });
    });

    it("should handle add source errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        text: async () => "Invalid URL",
      });

      const { result } = renderHook(() => aiApi.useAddExternalSource(), { wrapper });

      result.current.mutate({ type: "github", url: "invalid-url" });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Invalid URL");
    });
  });

  describe("useDeleteExternalSource", () => {
    it("should delete external source successfully", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
      });

      const queryClient = createQueryClient();

      const customWrapper = ({ children }: { children: React.ReactNode }) => (
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      );

      const { result } = renderHook(() => aiApi.useDeleteExternalSource(), { wrapper: customWrapper });

      result.current.mutate("source-123");

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/external-sources/source-123", {
        method: "DELETE",
      });
    });

    it("should handle delete errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        text: async () => "Source not found",
      });

      const { result } = renderHook(() => aiApi.useDeleteExternalSource(), { wrapper });

      result.current.mutate("nonexistent-id");

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error?.message).toBe("Source not found");
    });
  });

  describe("reindexExternalRequest", () => {
    it("should reindex all sources successfully", async () => {
      const mockResponse = { success: true, indexed: 10, errors: [] };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await aiApi.reindexExternalRequest();

      expect(response).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/reindex-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: undefined }),
      });
    });

    it("should reindex specific source successfully", async () => {
      const mockResponse = { success: true, indexed: 1, errors: [] };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await aiApi.reindexExternalRequest("source-123");

      expect(response).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/reindex-external", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: "source-123" }),
      });
    });

    it("should handle reindex errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        statusText: "Service Unavailable",
      });

      await expect(aiApi.reindexExternalRequest()).rejects.toThrow("Reindex failed: Service Unavailable");
    });

    it("should handle partial success with errors", async () => {
      const mockResponse = { success: true, indexed: 8, errors: ["Failed to index source-5"] };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await aiApi.reindexExternalRequest();

      expect(response.errors).toHaveLength(1);
      expect(response.indexed).toBe(8);
    });
  });

  describe("getChatSession", () => {
    it("should get chat session successfully", async () => {
      const mockMessages = [
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there!" },
      ];
      const mockResponse = { messages: mockMessages };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await aiApi.getChatSession("session-123");

      expect(response).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith("/api/ai/chat-session/session-123");
    });

    it("should handle get session errors", async () => {
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      await expect(aiApi.getChatSession("nonexistent")).rejects.toThrow(
        "Failed to load chat session: 404"
      );
    });

    it("should handle empty session", async () => {
      const mockResponse = { messages: [] };
      (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse,
      });

      const response = await aiApi.getChatSession("empty-session");

      expect(response.messages).toEqual([]);
    });
  });
});

