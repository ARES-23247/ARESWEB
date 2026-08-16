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

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "actoruid", "authorization", "body", "cookie", "email", "encrypted",
  "firstname", "iv", "lastname", "name", "password", "phone", "requestbody",
  "secret", "tag", "targetuid", "token", "uid", "userid",
]);

function redactText(value: string): string {
  return value
    .replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, `Bearer ${REDACTED}`)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, REDACTED)
    .replace(/github_pat_[A-Za-z0-9_]+/g, REDACTED)
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, REDACTED)
    // Phone-shaped digit runs (9+ digits, optionally formatted) — short digit
    // groups like dates and version numbers are preserved.
    .replace(/\+?[0-9][0-9()\s.-]{7,}[0-9]/g, (match) =>
      match.replace(/\D/g, "").length >= 9 ? REDACTED : match);
}

function safeLogValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (typeof value === "string") return redactText(value);
  if (value instanceof Error) return { type: value.name, message: redactText(value.message) };
  if (Array.isArray(value)) return value.map((item) => safeLogValue(item, seen));
  if (typeof value !== "object" || value === null) return value;
  if (seen.has(value)) return "[CIRCULAR]";
  seen.add(value);
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [
    key,
    SENSITIVE_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/g, ""))
      ? REDACTED
      : safeLogValue(item, seen),
  ]));
}

function formatMessage(level: LogLevel, tag: string, message: string, data?: unknown): string {
  const timestamp = new Date().toISOString();
  const base = `[${timestamp}] [${level}] [${tag}] ${redactText(message)}`;
  return data !== undefined ? `${base} ${JSON.stringify(safeLogValue(data))}` : base;
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
