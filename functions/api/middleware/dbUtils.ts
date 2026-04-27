import { Kysely, Transaction } from "kysely";
import { DB } from "../../../shared/schemas/database";

/**
 * Executes a database transaction with a retry mechanism for SQLITE_BUSY errors.
 * Critical for Cloudflare D1 high-concurrency environments.
 */
export async function retryTransaction<T>(
  db: Kysely<DB>,
  fn: (trx: Transaction<DB>) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await db.transaction().execute(fn);
    } catch (err: unknown) {
      lastError = err;
      // SQLITE_BUSY or "database is locked"
      if (err instanceof Error && (err.message?.includes("locked") || err.message?.includes("BUSY"))) {
        // Exponential backoff: 50ms, 100ms, 200ms
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, i) * 50));
        continue;
      }
      throw err; // Not a locking issue, rethrow immediately
    }
  }
  throw lastError;
}
