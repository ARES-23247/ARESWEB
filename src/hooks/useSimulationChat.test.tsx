import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { waitFor, act } from "@testing-library/react";
import { useSimulationChat } from "./useSimulationChat";
import { renderWithProviders } from "../test/utils";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";

// Mock dependencies
vi.mock("../utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("../utils/security", () => ({
  validateIdParam: (id: string) => id,
}));

vi.mock("../utils/ai", () => ({
  sanitizeUserInput: (input: string) => input,
  sanitizeFilesForAI: (files: Record<string, string>) => files,
  truncateChatHistory: (messages: Array<{ role: string; content: string }>) => messages,
}));

const mockExamples = {
  arm: "example arm code",
  elevator: "example elevator code",
};

const mockSetFiles = vi.fn();
const mockSetPendingAiChanges = vi.fn();
const mockCompileCode = vi.fn().mockResolvedValue(null);

const defaultOptions = {
  simId: "test-sim-id" as const,
  files: { "Main.tsx": "const x = 1;" },
  activeFile: "Main.tsx",
  compileCode: mockCompileCode,
  setFiles: mockSetFiles,
  setPendingAiChanges: mockSetPendingAiChanges,
  examples: mockExamples,
  consoleLogs: [],
  compileError: null,
};

describe("useSimulationChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    server.resetHandlers();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  describe("initial state", () => {
    it("should initialize with default message when no chat history exists", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });

    it("should initialize with empty chat input", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(result.current.chatInput).toBe("");
    });

    it("should initialize with loading state false", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(result.current.isChatLoading).toBe(false);
    });

    it("should initialize with no attached image", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(result.current.attachedImage).toBe(null);
    });

    it("should provide refs for chat scroll and input", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(result.current.chatEndRef).toBeDefined();
      expect(result.current.chatEndRef.current).toBeNull();
      expect(result.current.chatInputRef).toBeDefined();
      expect(result.current.chatInputRef.current).toBeNull();
    });
  });

  describe("chat input management", () => {
    it("should update chat input value", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Hello AI");
      });

      expect(result.current.chatInput).toBe("Hello AI");
    });

    it("should clear chat input", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Hello AI");
        result.current.setChatInput("");
      });

      expect(result.current.chatInput).toBe("");
    });
  });

  describe("chat messages management", () => {
    it("should update chat messages", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      const newMessages = [{ role: "user" as const, content: "Test message" }];

      act(() => {
        result.current.setChatMessages(newMessages);
      });

      expect(result.current.chatMessages).toEqual(newMessages);
    });

    it("should reset chat to default message", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatMessages([
          { role: "user" as const, content: "Previous chat" },
        ]);
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

  describe("attached image management", () => {
    it("should set attached image", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
      });

      expect(result.current.attachedImage).toBe("data:image/png;base64,abc123");
    });

    it("should clear attached image", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
        result.current.setAttachedImage(null);
      });

      expect(result.current.attachedImage).toBe(null);
    });
  });

  describe("chat persistence", () => {
    it("should save chat messages to sessionStorage when messages change", async () => {
      const simId = "test-persistence-sim";
      const storageKey = `sim_chat_v2_${simId}`;

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId })
      );

      const newMessages = [
        { role: "user" as const, content: "Test message" },
        { role: "assistant" as const, content: "Test response" },
      ];

      act(() => {
        result.current.setChatMessages(newMessages);
      });

      await waitFor(() => {
        const stored = sessionStorage.getItem(storageKey);
        expect(stored).toBeTruthy();
        expect(JSON.parse(stored!)).toEqual(newMessages);
      });
    });

    it("should load chat messages from sessionStorage on mount", () => {
      const simId = "test-load-sim";
      const storageKey = `sim_chat_v2_${simId}`;
      const storedMessages = [
        { role: "user" as const, content: "Stored message" },
        { role: "assistant" as const, content: "Stored response" },
      ];

      sessionStorage.setItem(storageKey, JSON.stringify(storedMessages));

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId })
      );

      expect(result.current.chatMessages).toEqual(storedMessages);
    });

    it("should handle corrupted sessionStorage data gracefully", () => {
      const simId = "test-corrupted-sim";
      const storageKey = `sim_chat_v2_${simId}`;

      sessionStorage.setItem(storageKey, "invalid-json{");

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId })
      );

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });

    it("should limit stored messages to MAX_CHAT_MESSAGES (50)", () => {
      const simId = "test-limit-sim";
      const storageKey = `sim_chat_v2_${simId}`;
      const manyMessages = Array.from({ length: 60 }, (_, i) => ({
        role: "user" as const,
        content: `Message ${i}`,
      }));

      sessionStorage.setItem(storageKey, JSON.stringify(manyMessages));

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId })
      );

      expect(result.current.chatMessages).toHaveLength(50);
    });

    it("should use 'new' key when simId is null", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId: null })
      );

      const newMessages = [{ role: "user" as const, content: "Test message" }];

      act(() => {
        result.current.setChatMessages(newMessages);
      });

      const stored = sessionStorage.getItem("sim_chat_v2_new");
      expect(stored).toBeTruthy();
      expect(JSON.parse(stored!)).toEqual(newMessages);
    });

    it("should load messages from 'new' key when simId is null", () => {
      const storedMessages = [
        { role: "user" as const, content: "New sim message" },
      ];

      sessionStorage.setItem("sim_chat_v2_new", JSON.stringify(storedMessages));

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId: null })
      );

      expect(result.current.chatMessages).toEqual(storedMessages);
    });

    it("should validate chat message structure on load", () => {
      const simId = "test-validation-sim";
      const storageKey = `sim_chat_v2_${simId}`;
      const invalidMessages = [
        { role: "user", content: "Valid" },
        { invalid: "data" },
        { role: "assistant", content: 123 },
      ];

      sessionStorage.setItem(storageKey, JSON.stringify(invalidMessages));

      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId })
      );

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });
  });

  describe("simId change handling", () => {
    it("should load default message for new simId when no stored data exists", () => {
      const { result, rerender } = renderWithProviders(
        ({ simId }) => useSimulationChat({ ...defaultOptions, simId }),
        {
          initialProps: { simId: "sim-1" },
        }
      );

      // sim-1 loads with default message
      expect(result.current.chatMessages[0].role).toBe("assistant");

      const storageKey1 = "sim_chat_v2_sim-1";
      expect(sessionStorage.getItem(storageKey1)).toBeTruthy();

      // When we change to sim-2 (with no stored data), it should load the default message
      act(() => {
        rerender({ simId: "sim-2" });
      });

      expect(result.current.chatMessages[0].role).toBe("assistant");
      expect(result.current.chatMessages[0].content).toContain("z.AI simulation assistant");
    });

    it("should load stored messages for simId with existing data", () => {
      // Set up stored data for sim-2 BEFORE creating hook
      const sim2Messages = [
        { role: "user" as const, content: "Sim 2 stored message" },
      ];
      sessionStorage.setItem("sim_chat_v2_sim-2", JSON.stringify(sim2Messages));

      // Create hook with sim-2 (should load stored messages)
      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId: "sim-2" })
      );

      expect(result.current.chatMessages).toEqual(sim2Messages);
    });
  });

  describe("handleChatSend", () => {
    it("should not send empty message", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.handleChatSend("");
      });

      expect(result.current.chatMessages).toEqual([
        {
          role: "assistant",
          content: "I'm your z.AI simulation assistant. Describe what you want to build — a motor controller, sensor visualizer, PID tuner, field navigator — and I'll generate or modify the code for you.",
        },
      ]);
    });

    it("should not send message when already loading", () => {
      let resolveRequest: ((value: any) => void) | null = null;

      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return new Promise((resolve) => {
            resolveRequest = resolve;
          });
        })
      );

      const { result, unmount } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        void result.current.handleChatSend("First message");
      });

      // Check that loading becomes true
      expect(result.current.isChatLoading).toBe(true);

      const initialMessageCount = result.current.chatMessages.length;

      act(() => {
        result.current.handleChatSend("Second message");
      });

      // Should not add new message while loading
      expect(result.current.chatMessages).toHaveLength(initialMessageCount);

      // Clean up: resolve the promise and unmount
      if (resolveRequest) {
        (resolveRequest as any)(null);
      }
      unmount();
    });

    it("should send message and add user message to chat", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      await act(async () => {
        await result.current.handleChatSend("Hello AI");
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe("Hello AI");
    });

    it("should clear chat input after sending", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Test message");
      });

      await act(async () => {
        await result.current.handleChatSend();
      });

      expect(result.current.chatInput).toBe("");
    });

    it("should set loading state during send", () => {
      let resolveResponse: ((value: any) => void) | null = null;

      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return new Promise((resolve) => {
            resolveResponse = () =>
              resolve(
                HttpResponse.json(
                  { success: true },
                  {
                    headers: {
                      "Content-Type": "text/event-stream",
                    },
                  }
                )
              );
          });
        })
      );

      const { result, unmount } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        void result.current.handleChatSend("Test");
      });

      // Check loading becomes true
      expect(result.current.isChatLoading).toBe(true);

      // Clean up: resolve the promise and unmount
      if (resolveResponse) {
        (resolveResponse as any)?.(null);
      }
      unmount();
    });

    it("should handle override message parameter", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Input value");
      });

      await act(async () => {
        await result.current.handleChatSend("Override message");
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages[0].content).toBe("Override message");
      expect(result.current.chatInput).toBe("");
    });

    it("should handle API error response", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json({ error: "API Error" }, { status: 500 });
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      await act(async () => {
        await result.current.handleChatSend("Test message");
      });

      await waitFor(() => {
        expect(result.current.isChatLoading).toBe(false);
      });

      const errorMessages = result.current.chatMessages.filter(
        (m) => m.role === "assistant" && m.content.includes("Error")
      );
      expect(errorMessages.length).toBeGreaterThan(0);
    });

    it("should clear attached image after sending", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setAttachedImage("data:image/png;base64,abc123");
      });

      await act(async () => {
        await result.current.handleChatSend("Test");
      });

      expect(result.current.attachedImage).toBe(null);
    });
  });

  describe("handleChatKeyDown", () => {
    it("should send message on Enter key (without Shift)", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Test message");
      });

      await act(async () => {
        const keyboardEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: false,
        });
        Object.assign(keyboardEvent, { preventDefault: vi.fn() });
        result.current.handleChatKeyDown(keyboardEvent as unknown as unknown as React.KeyboardEvent);
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages).toHaveLength(1);
    });

    it("should not send message on Shift+Enter", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Test message\n");
      });

      act(() => {
        const keyboardEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
        });
        Object.assign(keyboardEvent, { preventDefault: vi.fn() });
        result.current.handleChatKeyDown(keyboardEvent as unknown as unknown as React.KeyboardEvent);
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages).toHaveLength(0);
    });

    it("should prevent default on Enter key", async () => {
      server.use(
        http.post("*/api/ai/sim-playground", () => {
          return HttpResponse.json(
            { success: true },
            {
              headers: {
                "Content-Type": "text/event-stream",
              },
            }
          );
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Test");
      });

      let preventDefaultCalled = false;

      await act(async () => {
        const keyboardEvent = new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: false,
        });
        Object.assign(keyboardEvent, {
          preventDefault: () => {
            preventDefaultCalled = true;
          },
        });
        result.current.handleChatKeyDown(keyboardEvent as unknown as unknown as React.KeyboardEvent);
      });

      expect(preventDefaultCalled).toBe(true);
    });

    it("should ignore non-Enter keys", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      act(() => {
        result.current.setChatInput("Test message");
      });

      act(() => {
        const keyboardEvent = new KeyboardEvent("keydown", { key: "a" });
        Object.assign(keyboardEvent, { preventDefault: vi.fn() });
        result.current.handleChatKeyDown(keyboardEvent as unknown as unknown as React.KeyboardEvent);
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages).toHaveLength(0);
    });
  });

  describe("handleFixWithAI", () => {
    it("should not trigger when no errors exist", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [],
          compileError: null,
        })
      );

      const initialMessagesLength = result.current.chatMessages.length;

      act(() => {
        result.current.handleFixWithAI();
      });

      expect(result.current.chatMessages).toHaveLength(initialMessagesLength);
    });

    it("should include compile error in message when it exists", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [],
          compileError: "Syntax error on line 5",
        })
      );

      act(() => {
        result.current.handleFixWithAI();
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages.length).toBeGreaterThan(0);
      expect(userMessages[userMessages.length - 1].content).toContain(
        "Syntax error on line 5"
      );
    });

    it("should include runtime error logs in message", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [
            { level: "info", args: ["Some info"] },
            { level: "error", args: ["Runtime error occurred"] },
            { level: "warn", args: ["Warning message"] },
          ],
          compileError: null,
        })
      );

      act(() => {
        result.current.handleFixWithAI();
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages.length).toBeGreaterThan(0);
      expect(userMessages[userMessages.length - 1].content).toContain(
        "Runtime error occurred"
      );
    });

    it("should include both compile and runtime errors when both exist", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [{ level: "error", args: ["Console error"] }],
          compileError: "Compile error",
        })
      );

      act(() => {
        result.current.handleFixWithAI();
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      expect(userMessages.length).toBeGreaterThan(0);
      const lastMessage = userMessages[userMessages.length - 1].content;
      expect(lastMessage).toContain("Compile error");
      expect(lastMessage).toContain("Console error");
    });

    it("should include multiple runtime errors", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [
            { level: "error", args: ["First error"] },
            { level: "error", args: ["Second error"] },
            { level: "error", args: ["Third error"] },
          ],
          compileError: null,
        })
      );

      act(() => {
        result.current.handleFixWithAI();
      });

      const userMessages = result.current.chatMessages.filter(
        (m) => m.role === "user"
      );
      const lastMessage = userMessages[userMessages.length - 1].content;
      expect(lastMessage).toContain("First error");
      expect(lastMessage).toContain("Second error");
      expect(lastMessage).toContain("Third error");
    });

    it("should focus chat input ref after triggering", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          consoleLogs: [{ level: "error", args: ["Error"] }],
          compileError: null,
        })
      );

      const mockFocus = vi.fn();
      result.current.chatInputRef.current = {
        focus: mockFocus,
      } as unknown as HTMLTextAreaElement;

      act(() => {
        result.current.handleFixWithAI();
      });

      expect(mockFocus).toHaveBeenCalled();
    });
  });

  describe("streaming response handling", () => {
    it("should handle streaming response with code block", async () => {
      const streamChunks = [
        'data: {"chunk":"```tsx\\n"}\n\n',
        'data: {"chunk":"const x = 1;\\n"}\n\n',
        'data: {"chunk":"```\\n"}\n\n',
      ];

      server.use(
        http.post("*/api/ai/sim-playground", async () => {
          const stream = new ReadableStream({
            async start(controller) {
              const encoder = new TextEncoder();
              for (const chunk of streamChunks) {
                controller.enqueue(encoder.encode(chunk));
              }
              controller.close();
            },
          });
          return new HttpResponse(stream, {
            headers: {
              "Content-Type": "text/event-stream",
            },
          });
        })
      );

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      await act(async () => {
        await result.current.handleChatSend("Generate code");
      });

      await waitFor(() => {
        expect(result.current.isChatLoading).toBe(false);
      });

      const assistantMessages = result.current.chatMessages.filter(
        (m) => m.role === "assistant"
      );
      expect(assistantMessages.length).toBeGreaterThan(0);
    });
  });

  describe("sessionStorage error handling", () => {
    it("should handle sessionStorage quota exceeded error gracefully", () => {
      const originalSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = vi.fn(() => {
        throw new DOMException("QuotaExceededError");
      });

      const { result } = renderWithProviders(() =>
        useSimulationChat(defaultOptions)
      );

      expect(() => {
        act(() => {
          result.current.setChatMessages([
            { role: "user" as const, content: "Test" },
          ]);
        });
      }).not.toThrow();

      Storage.prototype.setItem = originalSetItem;
    });
  });

  describe("edge cases", () => {
    it("should handle null simId without errors", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, simId: null })
      );

      expect(result.current.chatMessages).toBeDefined();
      expect(result.current.isChatLoading).toBe(false);
    });

    it("should handle empty files object", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, files: {} })
      );

      expect(result.current.chatMessages).toBeDefined();
    });

    it("should handle empty activeFile", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({ ...defaultOptions, activeFile: "" })
      );

      expect(result.current.chatMessages).toBeDefined();
    });

    it("should handle missing examples gracefully", () => {
      const { result } = renderWithProviders(() =>
        useSimulationChat({
          ...defaultOptions,
          examples: { arm: "", elevator: "" },
        })
      );

      expect(result.current.chatMessages).toBeDefined();
    });
  });
});
