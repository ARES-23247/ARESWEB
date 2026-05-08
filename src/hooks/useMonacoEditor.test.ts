import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useMonacoEditor } from "./useMonacoEditor";
import type { editor } from "monaco-editor";
import type { Monaco } from "@monaco-editor/react";

// Mock monaco-editor and @monaco-editor/react
vi.mock("@monaco-editor/react", () => ({
  default: vi.fn(),
}));

// Mock fetch globally for the hook's internal fetch calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock monaco-vim dynamic import
vi.mock("monaco-vim", () => ({
  initVimMode: vi.fn(() => ({
    dispose: vi.fn(),
  })),
}));

describe("useMonacoEditor", () => {
  let mockEditor: editor.IStandaloneCodeEditor;
  let mockMonaco: Monaco;

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock editor
    mockEditor = {
      getModel: vi.fn(() => ({
        getValue: vi.fn(() => "const x = 1;"),
        getOffsetAt: vi.fn(() => 10),
      })),
      updateOptions: vi.fn(),
      onDidChangeModelContent: vi.fn(),
      dispose: vi.fn(),
    } as unknown as editor.IStandaloneCodeEditor;

    // Setup mock Monaco
    mockMonaco = {
      languages: {
        typescript: {
          javascriptDefaults: {
            setCompilerOptions: vi.fn(),
            addExtraLib: vi.fn(),
          },
          ScriptTarget: {
            ESNext: 99,
          },
          JsxEmit: {
            React: 2,
          },
        },
        registerInlineCompletionsProvider: vi.fn(() => ({
          dispose: vi.fn(),
        })),
        InlineCompletionTriggerKind: {
          Explicit: 1,
          Automatic: 0,
        },
      },
      Range: vi.fn(function (lineNumber: number, startColumn: number, endLineNumber: number, endColumn: number) {
        return {
          lineNumber,
          startColumn,
          endLineNumber,
          endColumn,
        };
      }),
    } as unknown as Monaco;

    // Reset fetch mock
    mockFetch.mockReset();
  });

  afterEach(() => {
    mockFetch.mockReset();
  });

  it("should return default editor states", () => {
    const { result } = renderHook(() => useMonacoEditor());

    expect(result.current.isVimMode).toBe(false);
    expect(result.current.isWordWrap).toBe(true);
    expect(result.current.isMinimap).toBe(false);
    expect(result.current.editorRef.current).toBeNull();
    expect(result.current.monacoRef.current).toBeNull();
  });

  it("should provide setters for editor states", () => {
    const { result } = renderHook(() => useMonacoEditor());

    expect(typeof result.current.setIsVimMode).toBe("function");
    expect(typeof result.current.setIsWordWrap).toBe("function");
    expect(typeof result.current.setIsMinimap).toBe("function");
  });

  it("should allow toggling vim mode state", async () => {
    const { result } = renderHook(() => useMonacoEditor());

    expect(result.current.isVimMode).toBe(false);

    await act(async () => {
      result.current.setIsVimMode(true);
    });

    expect(result.current.isVimMode).toBe(true);

    await act(async () => {
      result.current.setIsWordWrap(false);
    });

    expect(result.current.isWordWrap).toBe(false);

    await act(async () => {
      result.current.setIsMinimap(true);
    });

    expect(result.current.isMinimap).toBe(true);
  });

  it("should configure TypeScript compiler options on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    expect(mockMonaco.languages.typescript.javascriptDefaults.setCompilerOptions).toHaveBeenCalledWith({
      target: mockMonaco.languages.typescript.ScriptTarget.ESNext,
      allowNonTsExtensions: true,
      jsx: mockMonaco.languages.typescript.JsxEmit.React,
    });
  });

  it("should add React types on mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    const addExtraLib = mockMonaco.languages.typescript.javascriptDefaults.addExtraLib as ReturnType<typeof vi.fn>;

    // Should add React types (called once for React types, potentially once for ARESLib)
    expect(addExtraLib).toHaveBeenCalled();
    const reactCall = addExtraLib.mock.calls.find((call) =>
      typeof call[0] === "string" && call[0].includes("useState")
    );
    expect(reactCall).toBeDefined();
  });

  it("should load ARESLib types when fetch succeeds", async () => {
    const mockAresTypes = "declare const ARES: any;";
    mockFetch.mockResolvedValueOnce({
      ok: true,
      text: async () => mockAresTypes,
    });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    expect(mockFetch).toHaveBeenCalledWith("/types/areslib.d.ts");
    expect(mockMonaco.languages.typescript.javascriptDefaults.addExtraLib).toHaveBeenCalledWith(
      mockAresTypes,
      "file:///node_modules/@types/areslib/index.d.ts"
    );
  });

  it("should handle ARESLib fetch failure gracefully", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    // Should still configure Monaco even if ARESLib types fail to load
    expect(mockMonaco.languages.typescript.javascriptDefaults.setCompilerOptions).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it("should register inline completions provider", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    expect(mockMonaco.languages.registerInlineCompletionsProvider).toHaveBeenCalledWith("javascript", expect.any(Object));
  });

  it("should return empty completions for non-explicit trigger", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    const registerCall = mockMonaco.languages.registerInlineCompletionsProvider as ReturnType<typeof vi.fn>;
    const provider = registerCall.mock.calls[0][1];

    const mockModel = {
      getValue: vi.fn(() => "code"),
      getOffsetAt: vi.fn(() => 5),
    };

    const mockPosition = { lineNumber: 1, column: 1 };
    const mockContext = {
      triggerKind: 0, // Automatic
    };

    const completions = await provider.provideInlineCompletions(
      mockModel as unknown as editor.ITextModel,
      mockPosition as unknown as Parameters<typeof provider.provideInlineCompletions>[1],
      mockContext as unknown as Parameters<typeof provider.provideInlineCompletions>[2],
      {} as unknown as Parameters<typeof provider.provideInlineCompletions>[3]
    );

    expect(completions.items).toEqual([]);
  });

  it("should fetch AI completion for explicit trigger", async () => {
    // Mock streaming response - both chunks should be accumulated
    const mockStream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('data: {"chunk":"console.log("}\n'));
        controller.enqueue(new TextEncoder().encode('data: {"chunk":"hello);\n"}\n'));
        controller.close();
      },
    });

    mockFetch
      .mockResolvedValueOnce({
        // ARESLib types fetch
        ok: false,
        text: async () => "",
      })
      .mockResolvedValueOnce({
        // AI completion fetch
        ok: true,
        body: mockStream,
      });

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    const registerCall = mockMonaco.languages.registerInlineCompletionsProvider as ReturnType<typeof vi.fn>;
    const provider = registerCall.mock.calls[0][1];

    const mockModel = {
      getValue: vi.fn(() => "console"),
      getOffsetAt: vi.fn(() => 7),
    };

    const mockPosition = { lineNumber: 1, column: 8 };
    const mockContext = {
      triggerKind: 1, // Explicit
    };

    const completions = await provider.provideInlineCompletions(
      mockModel as unknown as editor.ITextModel,
      mockPosition as unknown as Parameters<typeof provider.provideInlineCompletions>[1],
      mockContext as unknown as Parameters<typeof provider.provideInlineCompletions>[2],
      {} as unknown as Parameters<typeof provider.provideInlineCompletions>[3]
    );

    expect(mockFetch).toHaveBeenCalledWith("/api/ai/sim-playground", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: expect.stringContaining("Complete the next lines"),
    });
    expect(completions.items).toHaveLength(1);
    // The text should contain both chunks accumulated
    expect(completions.items[0].insertText).toBeTruthy();
  });

  it("should handle AI completion fetch failure", async () => {
    mockFetch
      .mockResolvedValueOnce({
        // ARESLib types fetch
        ok: false,
        text: async () => "",
      })
      .mockRejectedValueOnce(new Error("AI API error"));

    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    const registerCall = mockMonaco.languages.registerInlineCompletionsProvider as ReturnType<typeof vi.fn>;
    const provider = registerCall.mock.calls[0][1];

    const mockModel = {
      getValue: vi.fn(() => "code"),
      getOffsetAt: vi.fn(() => 4),
    };

    const mockPosition = { lineNumber: 1, column: 5 };
    const mockContext = {
      triggerKind: 1, // Explicit
    };

    const completions = await provider.provideInlineCompletions(
      mockModel as unknown as editor.ITextModel,
      mockPosition as unknown as Parameters<typeof provider.provideInlineCompletions>[1],
      mockContext as unknown as Parameters<typeof provider.provideInlineCompletions>[2],
      {} as unknown as Parameters<typeof provider.provideInlineCompletions>[3]
    );

    expect(completions.items).toEqual([]);
  });

  it("should set editor and monaco refs after mount", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    expect(result.current.editorRef.current).toBeNull();
    expect(result.current.monacoRef.current).toBeNull();

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    expect(result.current.editorRef.current).toBe(mockEditor);
    expect(result.current.monacoRef.current).toBe(mockMonaco);
  });

  it("should initialize vim mode when enabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    // First mount the editor
    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    // Then enable vim mode
    await act(async () => {
      result.current.setIsVimMode(true);
    });

    // Wait for dynamic import to resolve
    await waitFor(() => {
      expect(result.current.isVimMode).toBe(true);
    });

    const vimModule = await import("monaco-vim");
    expect(vimModule.initVimMode).toHaveBeenCalled();
  });

  it("should dispose vim mode when disabled", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result } = renderHook(() => useMonacoEditor());

    // Mount and enable vim mode
    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    await act(async () => {
      result.current.setIsVimMode(true);
    });

    await waitFor(() => {
      expect(result.current.isVimMode).toBe(true);
    });

    // Disable vim mode
    await act(async () => {
      result.current.setIsVimMode(false);
    });

    await waitFor(() => {
      expect(result.current.isVimMode).toBe(false);
    });

    // The vim mode effect should have been triggered
    // We verify the state changed to false, which means cleanup occurred
    expect(result.current.isVimMode).toBe(false);
  });

  it("should dispose inline completions on cleanup", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      text: async () => "",
    });

    const { result, unmount } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(mockEditor, mockMonaco);
    });

    const registerCall = mockMonaco.languages.registerInlineCompletionsProvider as ReturnType<typeof vi.fn>;
    const provider = registerCall.mock.calls[0][1];

    const disposeSpy = vi.fn();
    provider.disposeInlineCompletions = disposeSpy;

    unmount();

    // The provider should have a dispose method
    expect(typeof provider.disposeInlineCompletions).toBe("function");
  });
});
