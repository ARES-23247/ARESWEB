import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";

/**
 * Trigger an incremental re-index in the background after a content mutation.
 * Uses waitUntil so it doesn't block the response.
 *
 * This is the safe alternative to catch-all middleware — called explicitly
 * from individual route handlers, same pattern as audit logging.
 *
 * IMPORTANT: Uses dynamic import() for the indexer module to avoid pulling
 * heavy AI/Vectorize code into the module graph at worker startup.
 * (The aiRouter's /reindex endpoint does the same thing — line 283 of ai/index.ts.)
 *
 * Cost: ~50 neurons per call (incremental, only changed docs).
 */
export function triggerBackgroundReindex(
  executionCtx: ExecutionContext,
  db: Kysely<DB>,
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined
): void {
  if (!ai || !vectorize) return;

  executionCtx.waitUntil(
    import("./indexer")
      .then(({ indexSiteContent }) => indexSiteContent(db, ai, vectorize))
      .then((r) => {
        if (r.indexed > 0 || r.errors.length > 0) {
          console.log(`[Auto-Reindex] Indexed: ${r.indexed}, Errors: ${r.errors.length}`);
        }
      })
      .catch((e) => {
        console.error("[Auto-Reindex] Failed:", e);
      })
  );
}

export function triggerExternalReindex(
  executionCtx: ExecutionContext,
  db: Kysely<DB>,
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined,
  zaiApiKey?: string,
  githubPat?: string
): void {
  if (!vectorize) return; // Vectorize is strictly required, AI might be optional if zaiApiKey is provided

  executionCtx.waitUntil(
    import("./indexer")
      .then(({ indexExternalResources }) => indexExternalResources(db, ai, vectorize, zaiApiKey, githubPat))
      .then((r) => {
        if (r.indexed > 0 || r.errors.length > 0) {
          console.log(`[External-Reindex] Indexed: ${r.indexed}, Errors: ${r.errors.length}`);
        }
      })
      .catch((e) => {
        console.error("[External-Reindex] Failed:", e);
      })
  );
}

