import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";

// Mock @babel/standalone at the top level
const mockTransform = vi.fn<(code: string, opts: { presets: readonly string[]; filename?: string }) => { code: string }>();

vi.mock("@babel/standalone", () => ({
  default: {
    transform: mockTransform,
  },
}));

describe("transformCode", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    // Reset the mock state before each test
    mockTransform.mockReset();
    mockTransform.mockReturnValue({ code: "transformed code" });
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it("should lazy load Babel on first call", async () => {
    const { transformCode } = await import("./lazyBabel");

    const result = await transformCode("const x = 1;", []);

    expect(result).toBe("transformed code");
    expect(mockTransform).toHaveBeenCalledWith("const x = 1;", expect.objectContaining({ presets: [] }));
  });

  it("should pass presets to Babel transform", async () => {
    const { transformCode } = await import("./lazyBabel");
    mockTransform.mockReturnValue({ code: "transformed jsx" });

    const result = await transformCode("<Foo />", ["react"]);

    expect(result).toBe("transformed jsx");
    expect(mockTransform).toHaveBeenCalledWith(
      "<Foo />",
      expect.objectContaining({
        presets: ["react"],
        filename: "transform.js",
      })
    );
  });

  it("should filter out falsy presets", async () => {
    const { transformCode } = await import("./lazyBabel");

    await transformCode("test", ["react", null, "", "typescript", false, undefined] as any);

    const presets = mockTransform.mock.calls[0][1].presets;
    expect(presets).toEqual(["react", "typescript"]);
  });

  it("should use default empty presets if not provided", async () => {
    const { transformCode } = await import("./lazyBabel");

    await transformCode("test");

    expect(mockTransform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        presets: [],
      })
    );
  });

  it("should handle empty presets array", async () => {
    const { transformCode } = await import("./lazyBabel");

    await transformCode("test", []);

    expect(mockTransform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        presets: [],
      })
    );
  });

  it("should return original code on transform error", async () => {
    const { transformCode } = await import("./lazyBabel");
    mockTransform.mockImplementation(() => {
      throw new Error("Transform error");
    });

    const originalCode = "invalid code <<>>";
    const result = await transformCode(originalCode);

    expect(result).toBe(originalCode);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[WARN] Babel transform failed, returning original code:",
      "Transform error"
    );
  });

  it("should handle non-Error objects in error handling", async () => {
    const { transformCode } = await import("./lazyBabel");
    mockTransform.mockImplementation(() => {
      throw "string error";
    });

    const originalCode = "const x = 1;";
    const result = await transformCode(originalCode);

    expect(result).toBe(originalCode);
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      "[WARN] Babel transform failed, returning original code:",
      "string error"
    );
  });

  it("should cache Babel instance after first load", async () => {
    const { transformCode } = await import("./lazyBabel");

    await transformCode("code1", []);
    await transformCode("code2", []);

    expect(mockTransform).toHaveBeenCalledTimes(2);
  });

  it("should handle null Babel instance gracefully", async () => {
    const { transformCode } = await import("./lazyBabel");

    // Simulate a transform that returns undefined (null babel instance scenario)
    mockTransform.mockReturnValue(undefined as unknown as { code: string });

    await transformCode("test");

    // The function should handle this gracefully
    expect(mockTransform).toHaveBeenCalled();
  });

  it("should include filename in transform options", async () => {
    const { transformCode } = await import("./lazyBabel");

    await transformCode("const x = 1;", []);

    expect(mockTransform).toHaveBeenCalledWith(
      "const x = 1;",
      expect.objectContaining({
        filename: "transform.js",
      })
    );
  });

  it("should handle multiple calls efficiently", async () => {
    const { transformCode } = await import("./lazyBabel");

    // First call loads Babel
    await transformCode("test1", []);

    // Subsequent calls use cached Babel instance
    await transformCode("test2", []);
    await transformCode("test3", []);

    expect(mockTransform).toHaveBeenCalledTimes(3);
  });
});

describe("transformCodeWithRetry", () => {
  const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    mockTransform.mockReset();
    mockTransform.mockReturnValue({ code: "success" });
  });

  afterAll(() => {
    consoleDebugSpy.mockRestore();
  });

  it("should return result on successful attempt", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    const result = await transformCodeWithRetry("test", []);

    expect(result).toBe("success");
  });

  it("should return original code on transform failure (graceful fallback)", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    mockTransform.mockImplementation(() => {
      throw new Error("Transform failed");
    });

    const originalCode = "const x = 1;";
    const result = await transformCodeWithRetry(originalCode);

    // Since transformCode catches all errors and returns original code,
    // transformCodeWithRetry will also return the original code
    expect(result).toBe(originalCode);
  });

  it("should pass through code and presets to transformCode", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    await transformCodeWithRetry("my code", ["react", "typescript"]);

    expect(mockTransform).toHaveBeenCalledWith(
      "my code",
      expect.objectContaining({
        presets: ["react", "typescript"],
      })
    );
  });

  it("should use default retry and delay values", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    const result = await transformCodeWithRetry("test", []);

    expect(result).toBe("success");
  });

  it("should handle custom retry count", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    // Even with custom retry count, the graceful fallback means no actual retries occur
    const result = await transformCodeWithRetry("test", [], 5, 100);

    expect(result).toBe("success");
  });

  it("should handle custom delay value", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    const result = await transformCodeWithRetry("test", [], 1, 500);

    expect(result).toBe("success");
  });

  it("should handle multiple sequential calls", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    const result1 = await transformCodeWithRetry("code1", []);
    const result2 = await transformCodeWithRetry("code2", []);

    expect(result1).toBe("success");
    expect(result2).toBe("success");
  });

  it("should handle empty code string", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");

    const result = await transformCodeWithRetry("", []);

    expect(result).toBe("success");
  });

  it("should handle successful transformation with actual presets", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    mockTransform.mockReturnValue({ code: 'const App = () => <div />;' });

    const result = await transformCodeWithRetry("<App />", ["react", "typescript"]);

    expect(result).toBe('const App = () => <div />;');
  });
});

describe("lazyBabel integration", () => {
  beforeEach(() => {
    mockTransform.mockReset();
    mockTransform.mockReturnValue({ code: "transformed" });
  });

  it("should handle both transformCode and transformCodeWithRetry consistently", async () => {
    const { transformCode, transformCodeWithRetry } = await import("./lazyBabel");
    const code = "const x = 1;";
    const presets = ["typescript"];

    const result1 = await transformCode(code, presets);
    const result2 = await transformCodeWithRetry(code, presets);

    expect(result1).toBe("transformed");
    expect(result2).toBe("transformed");
  });
});
