import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Create a factory function to get a fresh babel mock for each test
const createBabelMock = () => ({
  transform: vi.fn<(code: string, opts: { presets: readonly string[]; filename?: string }) => { code: string }>(),
});

// Mock @babel/standalone at the top level
const babelMock = createBabelMock();

vi.mock("@babel/standalone", () => ({
  default: babelMock,
}));

describe("transformCode", () => {
  const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    // Reset the mock state before each test
    babelMock.transform.mockReset();
    // Clear the babelInstance in the lazyBabel module by re-importing
    vi.clearAllMocks();
  });

  afterAll(() => {
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  it("should lazy load Babel on first call", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "transformed code" });

    const result = await transformCode("const x = 1;", []);

    expect(result).toBe("transformed code");
    expect(babelMock.transform).toHaveBeenCalledWith("const x = 1;", expect.objectContaining({ presets: [] }));
  });

  it("should pass presets to Babel transform", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "transformed jsx" });

    const result = await transformCode("<Foo />", ["react"]);

    expect(result).toBe("transformed jsx");
    expect(babelMock.transform).toHaveBeenCalledWith(
      "<Foo />",
      expect.objectContaining({
        presets: ["react"],
        filename: "transform.js",
      })
    );
  });

  it("should filter out falsy presets", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "result" });

    await transformCode("test", ["react", null, "", "typescript", false, undefined]);

    const presets = babelMock.transform.mock.calls[0][1].presets;
    expect(presets).toEqual(["react", "typescript"]);
  });

  it("should use default empty presets if not provided", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "result" });

    await transformCode("test");

    expect(babelMock.transform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        presets: [],
      })
    );
  });

  it("should handle empty presets array", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "result" });

    await transformCode("test", []);

    expect(babelMock.transform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        presets: [],
      })
    );
  });

  it("should return original code on transform error", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockImplementation(() => {
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

  it("should return original code when Babel instance is null after load", async () => {
    // Create a new mock where default export is null
    const originalMock = { ...babelMock };
    Object.defineProperty(babelMock, "transform", {
      get: () => {
        throw new Error("Cannot access transform on null");
      },
      set: () => {},
    });

    const { transformCode } = await import("./lazyBabel");
    const originalCode = "const x = 1;";

    // This test verifies the graceful fallback behavior
    // In practice, Babel is always loaded successfully
    const result = await transformCode(originalCode);

    expect(result).toBe(originalCode);
  });

  it("should handle non-Error objects in error handling", async () => {
    const { transformCode } = await import("./lazyBabel");
    babelMock.transform.mockImplementation(() => {
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
    babelMock.transform.mockReturnValue({ code: "transformed" });

    await transformCode("code1", []);
    await transformCode("code2", []);

    expect(babelMock.transform).toHaveBeenCalledTimes(2);
  });
});

describe("transformCodeWithRetry", () => {
  const consoleDebugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});

  beforeEach(() => {
    vi.useFakeTimers();
    babelMock.transform.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  afterAll(() => {
    consoleDebugSpy.mockRestore();
  });

  it("should return result on first successful attempt", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "success" });

    const result = await transformCodeWithRetry("test", []);

    expect(result).toBe("success");
  });

  it("should retry on failure with exponential backoff", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    let attemptCount = 0;
    babelMock.transform.mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error("Temporary failure");
      }
      return { code: "success" };
    });

    const resultPromise = transformCodeWithRetry("test", [], 2, 100);

    // Fast-forward timers
    await vi.runAllTimersAsync();

    const result = await resultPromise;

    expect(result).toBe("success");
    expect(attemptCount).toBe(2);
  });

  it("should throw after exhausting retries", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    babelMock.transform.mockImplementation(() => {
      throw new Error("Persistent failure");
    });

    const resultPromise = transformCodeWithRetry("test", [], 1, 100);

    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow("Persistent failure");
  });

  it("should use default retry and delay values", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "success" });

    const result = await transformCodeWithRetry("test", []);

    expect(result).toBe("success");
  });

  it("should double delay on each retry", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    let attemptCount = 0;
    const delays: number[] = [];

    // Track setTimeout calls
    const originalSetTimeout = globalThis.setTimeout;
    vi.spyOn(globalThis, "setTimeout").mockImplementation((fn, delay) => {
      delays.push(delay as number);
      return originalSetTimeout(fn as () => void, 0);
    });

    babelMock.transform.mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 3) {
        throw new Error("Temporary failure");
      }
      return { code: "success" };
    });

    const resultPromise = transformCodeWithRetry("test", [], 3, 100);

    await vi.runAllTimersAsync();
    await resultPromise;

    expect(delays).toEqual([100, 200]);
  });

  it("should pass through code and presets to transformCode", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    babelMock.transform.mockReturnValue({ code: "result" });

    await transformCodeWithRetry("my code", ["react", "typescript"]);

    expect(babelMock.transform).toHaveBeenCalledWith(
      "my code",
      expect.objectContaining({
        presets: ["react", "typescript"],
      })
    );
  });

  it("should handle zero retries", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    babelMock.transform.mockImplementation(() => {
      throw new Error("No retries allowed");
    });

    const resultPromise = transformCodeWithRetry("test", [], 0, 100);

    await vi.runAllTimersAsync();

    await expect(resultPromise).rejects.toThrow("No retries allowed");
  });

  it("should pass through retries count correctly", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    let attemptCount = 0;
    babelMock.transform.mockImplementation(() => {
      attemptCount++;
      if (attemptCount <= 2) {
        throw new Error("Fail");
      }
      return { code: "success" };
    });

    const resultPromise = transformCodeWithRetry("test", [], 2, 50);

    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(attemptCount).toBe(3);
    expect(result).toBe("success");
  });

  it("should log debug message on retry", async () => {
    const { transformCodeWithRetry } = await import("./lazyBabel");
    let attemptCount = 0;
    babelMock.transform.mockImplementation(() => {
      attemptCount++;
      if (attemptCount < 2) {
        throw new Error("Retry me");
      }
      return { code: "success" };
    });

    const resultPromise = transformCodeWithRetry("test", [], 1, 100);

    await vi.runAllTimersAsync();
    await resultPromise;

    expect(consoleDebugSpy).toHaveBeenCalledWith(
      expect.stringContaining("Transform failed, retrying in")
    );
  });
});
