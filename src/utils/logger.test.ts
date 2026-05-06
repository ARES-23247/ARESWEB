import { describe, it, expect, vi, afterEach } from "vitest";
import { logger } from "./logger";

describe("logger", () => {
  const _consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const _consoleInfoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
  const _consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should have all logging methods", () => {
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
  });

  it("should call error method without throwing", () => {
    logger.error("error message");
    // Error should always be logged regardless of environment
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should handle error with extra arguments", () => {
    logger.error("error message", { context: "data" }, "additional");
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should handle all log methods without throwing", () => {
    expect(() => {
      logger.debug("debug");
      logger.info("info");
      logger.warn("warn");
      logger.error("error");
    }).not.toThrow();
  });

  it("should prefix messages correctly", () => {
    logger.error("test error");
    if (import.meta.env.DEV) {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] test error");
    } else {
      expect(consoleErrorSpy).toHaveBeenCalledWith("[ERROR] test error");
    }
  });
});
