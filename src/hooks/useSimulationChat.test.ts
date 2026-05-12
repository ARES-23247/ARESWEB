import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useSimulationChat } from "./useSimulationChat";
import { logger } from "../utils/logger";
import { ChatMessage } from "../utils/ai";

// Mock dependencies
vi.mock("../utils/logger", () => ({
  logger: {
    error: vi.fn(),
  },
}));

vi.mock("../utils/security", () => ({
  validateIdParam: (id: string) => id,
}));

// Mock sessionStorage
const mockSessionStorage = {
  store: new Map<string, string>(),
  getItem: (key: string) => mockSessionStorage.store.get(key) ?? null,
  setItem: (key: string, value: string) => mockSessionStorage.store.set(key, value),
  removeItem: (key: string) => mockSessionStorage.store.delete(key),
  clear: () => mockSessionStorage.store.clear(),
};

Object.defineProperty(window, "sessionStorage", {
  value: mockSessionStorage,
  writable: true,
});

describe("useSimulationChat hook", () => {
  let mockFetch: ReturnType<typeof vi.fn>;
  let mockCompileCode: ReturnType<typeof vi.fn<(files: Record<string, string>) => Promise<string | null>>>;
  let mockSetFiles: ReturnType<typeof vi.fn<(files: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void>>;
  let mockSetPendingAiChanges: ReturnType<typeof vi.fn<(changes: Record<string, string> | null) => void>>;

  const defaultOptions = {
    simId: null,
    files: { "main.tsx": "export default function App() { return <div /> }" },
    activeFile: "main.tsx",
    examples: {
      arm: "arm example code",
      elevator: "elevator example code",
    },
    consoleLogs: [],
    compileError: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStorage.clear();

    // Mock fetch — vi.stubGlobal handles vitest v4 stricter Mock types
    mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);

    mockCompileCode = vi.fn().mockResolvedValue("compiled-code");
    mockSetFiles = vi.fn();
    mockSetPendingAiChanges = vi.fn();
  });

  describe("initial state", () => {
    it("should initialize with default message when no saved chat", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
      expect(result.current.chatInput).toBe("");
      expect(result.current.isChatLoading).toBe(false);
      expect(result.current.attachedImage).toBe(null);
    });

    it("should provide refs and setter functions", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      expect(result.current.chatEndRef).toBeDefined();
      expect(result.current.chatInputRef).toBeDefined();
      expect(typeof result.current.setChatMessages).toBe("function");
      expect(typeof result.current.setChatInput).toBe("function");
      expect(typeof result.current.setAttachedImage).toBe("function");
      expect(typeof result.current.handleChatSend).toBe("function");
      expect(typeof result.current.handleFixWithAI).toBe("function");
      expect(typeof result.current.handleChatKeyDown).toBe("function");
      expect(typeof result.current.resetChat).toBe("function");
    });
  });

  describe("chatInput state management", () => {
    it("should update chatInput", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      act(() => {
        result.current.setChatInput("Hello AI");
      });

      expect(result.current.chatInput).toBe("Hello AI");
    });
  });

  describe("attachedImage state management", () => {
    it("should set attached image", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
      });

      expect(result.current.attachedImage).toBe("data:image/png;base64,abc123");
    });

    it("should clear attached image after sending", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // Setup mock streaming response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
        result.current.setChatInput("test message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(result.current.attachedImage).toBe(null);
    });
  });

  describe("chat persistence", () => {
    it("should save chat messages to sessionStorage when they change", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: "test-sim-123",
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      const newMessages: ChatMessage[] = [
        { role: "user", content: "Create a motor controller" },
        { role: "assistant", content: "Here is your motor controller" },
      ];

      await act(async () => {
        result.current.setChatMessages(newMessages);
      });

      expect(mockSessionStorage.getItem("sim_chat_v2_test-sim-123")).toBe(
        JSON.stringify(newMessages)
      );
    });

    it("should load chat messages from sessionStorage on mount", () => {
      const savedMessages: ChatMessage[] = [
        { role: "user", content: "Previous message" },
        { role: "assistant", content: "Previous response" },
      ];
      mockSessionStorage.setItem("sim_chat_v2_saved-sim", JSON.stringify(savedMessages));

      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: "saved-sim",
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      expect(result.current.chatMessages).toEqual(savedMessages);
    });

    it("should load default message when sessionStorage has invalid data", () => {
      mockSessionStorage.setItem("sim_chat_v2_invalid-sim", "invalid json");

      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: "invalid-sim",
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });

    it("should use 'new' key when simId is null", () => {
      const newMessages: ChatMessage[] = [
        { role: "user", content: "New sim message" },
      ];

      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: null,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      act(() => {
        result.current.setChatMessages(newMessages);
      });

      expect(mockSessionStorage.getItem("sim_chat_v2_new")).toBe(
        JSON.stringify(newMessages)
      );
    });

    it("should limit chat history to MAX_CHAT_MESSAGES (50)", () => {
      const longHistory: ChatMessage[] = Array.from({ length: 60 }, (_, i) => ({
        role: (i % 2 === 0 ? "user" : "assistant") as "user" | "assistant",
        content: `Message ${i}`,
      }));

      mockSessionStorage.setItem("sim_chat_v2_long-sim", JSON.stringify(longHistory));

      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: "long-sim",
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      expect(result.current.chatMessages).toHaveLength(50);
    });
  });

  describe("handleChatSend", () => {
    it("should not send empty message", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      act(() => {
        result.current.setChatInput("   ");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should send multiple messages sequentially", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // Mock fetch to resolve immediately
      mockFetch.mockResolvedValue({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      // Initial count (default assistant message)
      const initialCount = result.current.chatMessages.length;

      // Send the first message
      act(() => {
        result.current.setChatInput("first message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      // Should have added user message and assistant response (+2)
      expect(result.current.chatMessages.length).toBe(initialCount + 2);

      // Send another message
      act(() => {
        result.current.setChatInput("second message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      // Should have added another user message and assistant response (+2 more)
      expect(result.current.chatMessages.length).toBe(initialCount + 4);
    });

    it("should add user message to chat immediately", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Create a PID controller");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(result.current.chatMessages).toContainEqual({
        role: "user",
        content: "Create a PID controller",
      });
      expect(result.current.chatInput).toBe("");
    });

    it("should accept override message parameter", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("This will be ignored");
      });

      await act(async () => {
        await result.current.handleChatSend("Use the override message instead");
      });

      expect(result.current.chatMessages).toContainEqual({
        role: "user",
        content: "Use the override message instead",
      });
    });

    it("should clear input after sending", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(result.current.chatInput).toBe("");
    });

    it("should set loading state during request", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // Start with loading false
      expect(result.current.isChatLoading).toBe(false);

      // Mock a successful response that completes immediately
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test");
      });

      // Send and wait for completion
      await act(async () => {
        await result.current.handleChatSend();
      });

      // After completion, loading should be false
      expect(result.current.isChatLoading).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockRejectedValueOnce(new Error("Network error"));

      act(() => {
        result.current.setChatInput("Test message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(logger.error).toHaveBeenCalledWith(
        "[useSimulationChat] AI Chat error:",
        expect.any(Error)
      );
      expect(result.current.chatMessages).toContainEqual({
        role: "assistant",
        content: "⚠️ Error: Network error",
      });
      expect(result.current.isChatLoading).toBe(false);
    });

    it("should handle non-ok response", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: false,
        body: null,
      });

      act(() => {
        result.current.setChatInput("Test");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(result.current.chatMessages).toContainEqual({
        role: "assistant",
        content: "⚠️ Error: AI request failed",
      });
      expect(result.current.isChatLoading).toBe(false);
    });

    it("should make correct API request with system prompt and messages", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Make a motor");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(mockFetch).toHaveBeenCalledWith("/api/ai/sim-playground", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: expect.stringContaining("Make a motor"),
      });
    });

    it("should include imageUrl in request when attachedImage is set", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
        result.current.setChatInput("What's in this image?");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.imageUrl).toBe("data:image/png;base64,abc123");
    });
  });

  describe("handleChatKeyDown", () => {
    it("should send chat on Enter without shift", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test message");
      });

      const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: false });
      Object.defineProperty(event, "preventDefault", { value: vi.fn() });

      await act(async () => {
        await result.current.handleChatKeyDown(event as unknown as React.KeyboardEvent);
      });

      await waitFor(() => expect(mockFetch).toHaveBeenCalled());

      expect(event.preventDefault).toHaveBeenCalled();
    });

    it("should not send chat on Enter with shift", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true });
      Object.defineProperty(event, "preventDefault", { value: vi.fn() });

      act(() => {
        result.current.handleChatKeyDown(event as unknown as React.KeyboardEvent);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should not send chat for other keys", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      const event = new KeyboardEvent("keydown", { key: "a" });
      Object.defineProperty(event, "preventDefault", { value: vi.fn() });

      act(() => {
        result.current.handleChatKeyDown(event as unknown as React.KeyboardEvent);
      });

      expect(event.preventDefault).not.toHaveBeenCalled();
    });
  });

  describe("handleFixWithAI", () => {
    it("should not trigger when no errors exist", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
          consoleLogs: [],
          compileError: null,
        })
      );

      act(() => {
        result.current.handleFixWithAI();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should trigger fix with compile error", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
          consoleLogs: [],
          compileError: "SyntaxError: Unexpected token",
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      await act(async () => {
        await result.current.handleFixWithAI();
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.messages[fetchBody.messages.length - 1].content).toContain(
        "Compile Error"
      );
    });

    it("should trigger fix with runtime errors", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
          consoleLogs: [
            { level: "error", args: ["Runtime error occurred"] },
            { level: "info", args: ["Info message"] },
          ],
          compileError: null,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      await act(async () => {
        await result.current.handleFixWithAI();
      });

      expect(mockFetch).toHaveBeenCalled();
      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(fetchBody.messages[fetchBody.messages.length - 1].content).toContain(
        "Runtime Errors"
      );
    });

    it("should include both compile and runtime errors when both exist", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
          consoleLogs: [
            { level: "error", args: ["TypeError: undefined is not a function"] },
          ],
          compileError: "Missing semicolon",
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      await act(async () => {
        await result.current.handleFixWithAI();
      });

      const fetchBody = JSON.parse(mockFetch.mock.calls[0][1].body);
      const lastMessage = fetchBody.messages[fetchBody.messages.length - 1].content;
      expect(lastMessage).toContain("Compile Error");
      expect(lastMessage).toContain("Runtime Errors");
    });
  });

  describe("resetChat", () => {
    it("should reset chat messages to default", () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      act(() => {
        result.current.setChatMessages([
          { role: "user", content: "Previous conversation" },
          { role: "assistant", content: "Previous response" },
        ]);
      });

      expect(result.current.chatMessages).toHaveLength(2);

      act(() => {
        result.current.resetChat();
      });

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });
  });

  describe("simId change handling", () => {
    it("should use simId in storage key", () => {
      const testSimId = "test-sim-abc123";

      renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: testSimId,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // After initial render, the hook saves the default message
      const savedKey = `sim_chat_v2_${testSimId}`;
      expect(mockSessionStorage.store.has(savedKey)).toBe(true);
    });

    it("should use 'new' key when simId is null", () => {
      renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          simId: null,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // Should save with 'new' key
      expect(mockSessionStorage.store.has("sim_chat_v2_new")).toBe(true);
    });
  });

  describe("streaming response handling", () => {
    it("should handle empty streaming response", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      // Mock an empty stream
      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Hello");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      // Should complete without error
      expect(result.current.isChatLoading).toBe(false);
      expect(mockSetPendingAiChanges).not.toHaveBeenCalled();
    });

    it("should make fetch request to correct endpoint", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/ai/sim-playground",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        })
      );
    });

    it("should include system prompt with examples when files are small", async () => {
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          files: { "small.tsx": "code" }, // Small file - should include examples
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      expect(body.systemPrompt).toContain("EXAMPLES OF REAL ARESWEB SIMULATIONS");
    });

    it("should exclude examples when files are large", async () => {
      // Create multiple files that together exceed 15000 chars when JSON stringified
      // Each file is truncated to 10000 chars, so we need 2 files to exceed 15000
      const largeFile1 = "x".repeat(10000);
      const largeFile2 = "y".repeat(10000);
      const { result } = renderHook(() =>
        useSimulationChat({
          ...defaultOptions,
          files: {
            "file1.tsx": largeFile1,
            "file2.tsx": largeFile2,
          },
          compileCode: mockCompileCode,
          setFiles: mockSetFiles,
          setPendingAiChanges: mockSetPendingAiChanges,
        })
      );

      mockFetch.mockResolvedValueOnce({
        ok: true,
        body: {
          getReader: () => ({
            read: () =>
              Promise.resolve({
                done: true,
                value: new Uint8Array(),
              }),
          }),
        },
      });

      act(() => {
        result.current.setChatInput("Test");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      const fetchCall = mockFetch.mock.calls[0];
      const body = JSON.parse(fetchCall[1].body);
      // With two 10000-char files, the JSON will be > 20000 chars, so examples should be excluded
      expect(body.systemPrompt).not.toContain("EXAMPLES OF REAL ARESWEB SIMULATIONS");
    });
  });
});
