/**
 * Structured logging utility for ARESWEB Cloud Functions.
 *
 * Wraps console methods with consistent prefixed tags and ISO timestamps.
 * Usage: `logger.info("photos", "Import started", { albumId })` → `[2026-06-22T02:24:00Z] [INFO] [photos] Import started { albumId: "abc" }`
 *
 * In Cloud Functions, `console.log/warn/error` are automatically captured by
 * Cloud Logging with correct severity levels. This wrapper adds structure
 * without replacing the underlying transport.
 */

type LogLevel = "INFO" | "WARN" | "ERROR" | "DEBUG";

function formatMessage(level: LogLevel, tag: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${tag}] ${message}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
}

export const logger = {
  /** Informational message — normal operation. */
  info(tag: string, message: string, data?: unknown): void {
    console.log(formatMessage("INFO", tag, message, data));
  },

  /** Warning — something unexpected but recoverable. */
  warn(tag: string, message: string, data?: unknown): void {
    console.warn(formatMessage("WARN", tag, message, data));
  },

  /** Error — operation failed, needs attention. */
  error(tag: string, message: string, data?: unknown): void {
    console.error(formatMessage("ERROR", tag, message, data));
  },

  /** Debug — verbose output, typically stripped in production. */
  debug(tag: string, message: string, data?: unknown): void {
    if (process.env.LOG_LEVEL === "debug") {
      console.log(formatMessage("DEBUG", tag, message, data));
    }
  },
};
