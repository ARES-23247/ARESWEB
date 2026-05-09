/**
 * ─────────────────────────────────────────────────────────────────────────────
 * SAFE WAIT UNTIL HELPER
 * ─────────────────────────────────────────────────────────────────────────────
 * Provides safe error handling for Cloudflare Workers' waitUntil() background tasks.
 *
 * Background operations (logging, cache updates, notifications) should not block
 * the main response, but they MUST log errors when they fail. This helper wraps
 * waitUntil with error logging so failures are visible in logs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { ExecutionContext } from "hono";

/**
 * Safely executes a background task with error logging.
 *
 * @param ctx - Hono execution context (c.executionCtx)
 * @param promise - The promise to execute in the background
 * @param errorMessage - Contextual error message for logging
 *
 * @example
 * ```typescript
 * // Instead of silent failure:
 * c.executionCtx.waitUntil(sendNotification(data).catch(() => {}));
 *
 * // Use safeWaitUntil for error visibility:
 * safeWaitUntil(c.executionCtx, sendNotification(data), "Failed to send notification");
 * ```
 */
export function safeWaitUntil(
  ctx: ExecutionContext | undefined,
  promise: Promise<unknown>,
  errorMessage: string
): void {
  ctx?.waitUntil?.(
    promise.catch((error: unknown) => {
      console.error(`${errorMessage}:`, error);
    })
  );
}
