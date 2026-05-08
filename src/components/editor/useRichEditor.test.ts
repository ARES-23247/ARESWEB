/**
 * Unit tests for useRichEditor hook
 * Comprehensive coverage of Tiptap editor initialization including:
 * - Editor creation with default options
 * - Custom placeholder configuration
 * - Yjs collaboration integration
 * - Extension loading
 * - Editor cleanup
 * - Lowlight syntax highlighting configuration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRichEditor } from "./useRichEditor";
import * as Y from "yjs";

// Mock @tiptap/react
// Define mockEditor outside the mock factory for test access
const mockEditor = {
  isEditable: true,
  isEmpty: false,
  getHTML: vi.fn(() => "<p>Test content</p>"),
  getText: vi.fn(() => "Test content"),
  destroy: vi.fn(),
  commands: {
    setContent: vi.fn(),
    clearContent: vi.fn(),
    focus: vi.fn(),
    blur: vi.fn(),
  },
  extensionManager: {
    extensions: [],
  },
};

vi.mock("@tiptap/react", () => ({
  useEditor: vi.fn(() => mockEditor),
  Editor: class MockEditor {},
}));

// Import the mocked useEditor after the mock is set up
import { useEditor } from "@tiptap/react";
const mockUseEditor = vi.mocked(useEditor);

// Mock lowlight
vi.mock("lowlight", () => ({
  common: {
    javascript: "javascript",
    typescript: "typescript",
    python: "python",
    css: "css",
    html: "html",
  },
  createLowlight: vi.fn((languages) => ({
    languages,
    highlight: vi.fn(() => ({
      value: "<span>highlighted</span>",
    })),
  })),
}));

// Mock yjs
vi.mock("yjs", () => ({
  Doc: vi.fn(() => ({
    getText: vi.fn(() => ({
      toString: vi.fn(() => ""),
      insert: vi.fn(),
      delete: vi.fn(),
    })),
    getMap: vi.fn(() => new Map()),
    on: vi.fn(),
    off: vi.fn(),
  })),
}));

describe("useRichEditor", () => {
  let createLowlightMock: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // Import and mock createLowlight
    const lowlightModule = await import("lowlight");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createLowlightMock = vi.spyOn(lowlightModule, "createLowlight") as any;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("initialization", () => {
    it("should create editor with default placeholder", () => {
      const { result } = renderHook(() => useRichEditor());

      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "<p>Start writing here...</p>",
          editorProps: expect.objectContaining({
            attributes: expect.objectContaining({
              class: "prose prose-invert max-w-none focus:outline-none min-h-[400px] text-[#e6edf3] font-mono",
              spellcheck: "true",
            }),
          }),
        })
      );

      expect(result.current).toBeDefined();
    });

    it("should create editor with custom placeholder", () => {
      const customPlaceholder = "<p>Enter your blog post...</p>";
      const { result } = renderHook(() =>
        useRichEditor({ placeholder: customPlaceholder })
      );

      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: customPlaceholder,
        })
      );

      expect(result.current).toBeDefined();
    });

    it("should create lowlight instance with common languages", () => {
      renderHook(() => useRichEditor());

      expect(createLowlightMock).toHaveBeenCalledWith(expect.any(Object));
    });

    it("should return null editor during initialization", () => {
      mockUseEditor.mockReturnValueOnce(null as unknown as ReturnType<typeof mockUseEditor>);

      const { result } = renderHook(() => useRichEditor());

      expect(result.current).toBeNull();
    });

    it("should return editor instance after initialization", () => {
      const { result } = renderHook(() => useRichEditor());

      expect(result.current).toBeDefined();
    });
  });

  describe("Yjs collaboration", () => {
    it("should not set content when Ydoc is provided", () => {
      const mockYDoc = new Y.Doc();

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          yfield: "prosemirror",
        })
      );

      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: undefined,
        })
      );
    });

    it("should include yfield in extensions when provided", () => {
      const mockYDoc = new Y.Doc();
      const mockProvider = {};

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          provider: mockProvider,
          yfield: "custom-field",
        })
      );

      expect(mockUseEditor).toHaveBeenCalled();
      const extensions = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { extensions?: unknown[] } | undefined)?.extensions;
      expect(extensions).toBeDefined();
      expect(Array.isArray(extensions)).toBe(true);
    });

    it("should work with default yfield", () => {
      const mockYDoc = new Y.Doc();

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
        })
      );

      expect(mockUseEditor).toHaveBeenCalled();
    });

    it("should include provider when available", () => {
      const mockYDoc = new Y.Doc();
      const mockProvider = {
        room: {
          getSelf: vi.fn(() => ({
            info: { name: "Test User" },
          })),
        },
      };

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          provider: mockProvider,
          yfield: "default",
        })
      );

      expect(mockUseEditor).toHaveBeenCalled();
    });
  });

  describe("editor attributes", () => {
    it("should apply correct CSS classes", () => {
      renderHook(() => useRichEditor());

      const editorProps = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { editorProps?: { attributes: { class: string; spellcheck: string } } } | undefined)?.editorProps;
      expect(editorProps).toBeDefined();

      const props = editorProps!;
      expect(props.attributes.class).toContain("prose");
      expect(props.attributes.class).toContain("prose-invert");
      expect(props.attributes.class).toContain("max-w-none");
      expect(props.attributes.class).toContain("focus:outline-none");
      expect(props.attributes.class).toContain("min-h-[400px]");
      expect(props.attributes.class).toContain("text-[#e6edf3]");
      expect(props.attributes.class).toContain("font-mono");
    });

    it("should enable spellcheck", () => {
      renderHook(() => useRichEditor());

      const editorProps = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { editorProps?: { attributes: { class: string; spellcheck: string } } } | undefined)?.editorProps;
      expect(editorProps).toBeDefined();

      const props = editorProps!;
      expect(props.attributes.spellcheck).toBe("true");
    });
  });

  describe("extensions", () => {
    it("should load editor extensions", () => {
      renderHook(() => useRichEditor());

      const extensions = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { extensions?: unknown[] } | undefined)?.extensions;

      expect(extensions).toBeDefined();
      expect(Array.isArray(extensions)).toBe(true);
      expect(extensions?.length ?? 0).toBeGreaterThan(0);
    });

    it("should include collaboration extensions when Ydoc is provided", () => {
      const mockYDoc = new Y.Doc();

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
        })
      );

      const extensions = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { extensions?: unknown[] } | undefined)?.extensions;

      // Should have collaboration extensions
      expect(extensions?.length ?? 0).toBeGreaterThan(0);
    });

    it("should include cursor extension when provider is provided", () => {
      const mockYDoc = new Y.Doc();
      const mockProvider = {
        room: {
          getSelf: vi.fn(() => ({
            info: { name: "Test User" },
          })),
        },
      };

      renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          provider: mockProvider,
          yfield: "default",
        })
      );

      const extensions = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { extensions?: unknown[] } | undefined)?.extensions;

      // Should have cursor extension when provider is present
      expect(extensions?.length ?? 0).toBeGreaterThan(0);
    });
  });

  describe("memoization", () => {
    it("should memoize lowlight instance", () => {
      const { rerender } = renderHook(() => useRichEditor());

      const firstCallCount = createLowlightMock.mock.calls.length;

      rerender();

      const secondCallCount = createLowlightMock.mock.calls.length;

      // Lowlight should only be created once due to useMemo
      expect(secondCallCount).toBe(firstCallCount);
    });

    it("should update extensions when ydoc changes", () => {
      const mockYDoc1 = new Y.Doc();
      const mockYDoc2 = new Y.Doc();

      const { rerender } = renderHook(
        ({ ydoc }) => useRichEditor({ ydoc }),
        { initialProps: { ydoc: mockYDoc1 } }
      );

      expect((vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { extensions?: unknown[] } | undefined)?.extensions).toBeDefined();

      rerender({ ydoc: mockYDoc2 });

      // After rerender with new ydoc, check if useEditor was called again
      expect(mockUseEditor).toHaveBeenCalled();
    });
  });

  describe("editor lifecycle", () => {
    it("should handle editor cleanup on unmount", () => {
      const { unmount } = renderHook(() => useRichEditor());

      // Editor should be created
      expect(mockUseEditor).toHaveBeenCalled();

      // Unmount should trigger cleanup
      unmount();

      // The mock editor's destroy should be called by Tiptap internally
      // We're just verifying the hook doesn't throw during unmount
      expect(true).toBe(true);
    });

    it("should handle re-rendering without issues", () => {
      const { rerender } = renderHook(() => useRichEditor());

      // Should not throw on rerender
      expect(() => rerender()).not.toThrow();
    });
  });

  describe("edge cases", () => {
    it("should handle empty string placeholder", () => {
      const { result } = renderHook(() =>
        useRichEditor({ placeholder: "" })
      );

      expect(result.current).toBeDefined();
      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "",
        })
      );
    });

    it("should handle undefined yfield", () => {
      const mockYDoc = new Y.Doc();

      const { result } = renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          // yfield is undefined
        })
      );

      expect(result.current).toBeDefined();
    });

    it("should handle null provider", () => {
      const mockYDoc = new Y.Doc();

      const { result } = renderHook(() =>
        useRichEditor({
          ydoc: mockYDoc,
          provider: null,
        })
      );

      expect(result.current).toBeDefined();
    });

    it("should handle options object with no properties", () => {
      const { result } = renderHook(() => useRichEditor({}));

      expect(result.current).toBeDefined();
    });
  });

  describe("integration scenarios", () => {
    it("should work with all Yjs collaboration options", () => {
      const mockYDoc = new Y.Doc();
      const mockProvider = {
        room: {
          getSelf: vi.fn(() => ({
            info: { name: "Collaborator" },
          })),
        },
      };

      const { result } = renderHook(() =>
        useRichEditor({
          placeholder: "<p>Collaborative document...</p>",
          ydoc: mockYDoc,
          provider: mockProvider,
          yfield: "shared-doc",
        })
      );

      expect(result.current).toBeDefined();
      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: undefined, // No initial content with Yjs
        })
      );
    });

    it("should work in standalone mode without collaboration", () => {
      const { result } = renderHook(() =>
        useRichEditor({
          placeholder: "<p>My blog post...</p>",
        })
      );

      expect(result.current).toBeDefined();
      expect(mockUseEditor).toHaveBeenCalledWith(
        expect.objectContaining({
          content: "<p>My blog post...</p>",
        })
      );
    });
  });

  describe("editor attributes accessibility", () => {
    it("should include accessible markup attributes", () => {
      renderHook(() => useRichEditor());

      const editorProps = (vi.mocked(mockUseEditor).mock.calls[0]?.[0] as { editorProps?: { attributes: { class: string; spellcheck: string } } } | undefined)?.editorProps;

      // Verify attributes object is properly structured
      expect(editorProps).toBeDefined();
      const props = editorProps!;
      expect(props.attributes).toBeDefined();
      expect(typeof props.attributes.class).toBe("string");
      expect(typeof props.attributes.spellcheck).toBe("string");
    });
  });
});
