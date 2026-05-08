import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useCodeCompiler } from "./useCodeCompiler";
import { transformCode } from "../utils/lazyBabel";

// Mock the lazyBabel module
vi.mock("../utils/lazyBabel", () => ({
  transformCode: vi.fn(),
  logger: {
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

describe("useCodeCompiler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  describe("initialization and state management", () => {
    it("should initialize with default state", () => {
      const { result } = renderHook(() => useCodeCompiler());

      expect(result.current.compiledFiles).toEqual({});
      expect(result.current.compileError).toBeNull();
      expect(result.current.isCompiling).toBe(false);
    });

    it("should allow manual updates to compiledFiles via setCompiledFiles", () => {
      const { result } = renderHook(() => useCodeCompiler());

      act(() => {
        result.current.setCompiledFiles({ "manual.tsx": "manual code" });
      });

      expect(result.current.compiledFiles).toEqual({ "manual.tsx": "manual code" });
    });

    it("should allow manual updates to compileError via setCompileError", () => {
      const { result } = renderHook(() => useCodeCompiler());

      act(() => {
        result.current.setCompileError("Custom error");
      });

      expect(result.current.compileError).toBe("Custom error");
    });
  });

  describe("compileCode", () => {
    it("should compile TypeScript/JavaScript files successfully", async () => {
      const mockTransformedCode = "const x = 1;";
      vi.mocked(transformCode).mockResolvedValue(mockTransformedCode);

      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = {
        "App.tsx": "const App = () => <div>Hello</div>;",
        "utils.ts": "export const foo = 42;",
        "index.js": "console.log('test');",
      };

      let compileResult: string | null = null;
      await act(async () => {
        compileResult = await result.current.compileCode(sourceFiles);
      });

      expect(result.current.isCompiling).toBe(false);
      expect(result.current.compileError).toBeNull();
      expect(result.current.compiledFiles).toEqual({
        "App.tsx": mockTransformedCode,
        "utils.ts": mockTransformedCode,
        "index.js": mockTransformedCode,
      });
      expect(compileResult).toBeNull();
      expect(transformCode).toHaveBeenCalledTimes(3);
    });

    it("should handle non-code files without transformation", async () => {
      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = {
        "styles.css": ".foo { color: red; }",
        "config.json": '{ "key": "value" }',
      };

      await act(async () => {
        await result.current.compileCode(sourceFiles);
      });

      expect(result.current.compiledFiles).toEqual({
        "styles.css": ".foo { color: red; }",
        "config.json": '{ "key": "value" }',
      });
      expect(transformCode).not.toHaveBeenCalled();
    });

    it("should set compileError and return error message on transformation failure", async () => {
      const errorMessage = "SyntaxError: Unexpected token";
      vi.mocked(transformCode).mockRejectedValue(new Error(errorMessage));

      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = {
        "bad.tsx": "const x = =>",
      };

      let compileResult: string | null = null;
      await act(async () => {
        compileResult = await result.current.compileCode(sourceFiles);
      });

      expect(result.current.isCompiling).toBe(false);
      expect(result.current.compileError).toBe(errorMessage);
      expect(result.current.compiledFiles).toEqual({});
      expect(compileResult).toBe(errorMessage);
    });

    it("should handle empty source files object", async () => {
      const { result } = renderHook(() => useCodeCompiler());

      let compileResult: string | null = null;
      await act(async () => {
        compileResult = await result.current.compileCode({});
      });

      expect(result.current.compiledFiles).toEqual({});
      expect(result.current.compileError).toBeNull();
      expect(compileResult).toBeNull();
      expect(transformCode).not.toHaveBeenCalled();
    });

    it("should handle mixed file types (code and non-code)", async () => {
      const mockTransformedCode = "transformed";
      vi.mocked(transformCode).mockResolvedValue(mockTransformedCode);

      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = {
        "component.tsx": "const x = 1;",
        "styles.css": ".foo {}",
        "data.json": '{ "key": "value" }',
        "utils.ts": "export const foo = 42;",
      };

      await act(async () => {
        await result.current.compileCode(sourceFiles);
      });

      expect(result.current.compiledFiles).toEqual({
        "component.tsx": mockTransformedCode,
        "styles.css": ".foo {}",
        "data.json": '{ "key": "value" }',
        "utils.ts": mockTransformedCode,
      });
      expect(transformCode).toHaveBeenCalledTimes(2);
    });

    it("should clear compileError on successful compilation", async () => {
      vi.mocked(transformCode).mockResolvedValue("compiled");

      const { result } = renderHook(() => useCodeCompiler());

      act(() => {
        result.current.setCompileError("Previous error");
      });
      expect(result.current.compileError).toBe("Previous error");

      await act(async () => {
        await result.current.compileCode({ "test.tsx": "code" });
      });

      expect(result.current.compileError).toBeNull();
    });
  });

  describe("scheduleCompile", () => {
    it("should schedule compilation with delay using scheduleCompile", async () => {
      vi.mocked(transformCode).mockResolvedValue("compiled");

      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = { "test.tsx": "code" };

      act(() => {
        result.current.scheduleCompile(sourceFiles, 500);
      });

      // Should not compile immediately
      expect(transformCode).not.toHaveBeenCalled();

      // Fast-forward time
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(transformCode).toHaveBeenCalledOnce();
    });

    it("should use default delay of 800ms for scheduleCompile", async () => {
      vi.mocked(transformCode).mockResolvedValue("compiled");

      const { result } = renderHook(() => useCodeCompiler());
      const sourceFiles = { "test.tsx": "code" };

      act(() => {
        result.current.scheduleCompile(sourceFiles);
      });

      // Fast-forward by 800ms (default delay)
      await act(async () => {
        vi.advanceTimersByTime(800);
      });

      expect(transformCode).toHaveBeenCalledOnce();
    });

    it("should clear previous timeout when scheduling new compilation", async () => {
      vi.mocked(transformCode).mockResolvedValue("compiled");

      const { result } = renderHook(() => useCodeCompiler());

      act(() => {
        result.current.scheduleCompile({ "file1.tsx": "code1" }, 500);
      });

      act(() => {
        result.current.scheduleCompile({ "file2.tsx": "code2" }, 500);
      });

      // Only advance by 500ms (not 1000ms)
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(transformCode).toHaveBeenCalledTimes(1);
      // The first argument is the code
      expect(vi.mocked(transformCode).mock.calls[0][0]).toBe("code2");
    });

    it("should cleanup timeout on unmount", () => {
      const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");

      const { result, unmount } = renderHook(() => useCodeCompiler());

      // Schedule a compile to set the timeout ref
      act(() => {
        result.current.scheduleCompile({ "test.tsx": "code" }, 500);
      });

      unmount();

      // Verify clearTimeout was called when unmounting
      expect(clearTimeoutSpy).toHaveBeenCalled();
      clearTimeoutSpy.mockRestore();
    });
  });
});
