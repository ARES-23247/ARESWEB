import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";
import type { DrizzleDB } from "../../middleware/utils";

interface IndexResult {
  indexed: number;
  skipped: number;
  errors: string[];
}

/**
 * Trigger an incremental re-index in the background after a content mutation.
 */
export function triggerBackgroundReindex(
  executionCtx: ExecutionContext,
  db: DrizzleDB,
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined
): void {
  if (!ai || !vectorize) return;

  executionCtx.waitUntil(
    import("./indexer")
      .then(({ indexSiteContent }) => indexSiteContent(db, ai, vectorize))
      .then((r: IndexResult) => {
        if (r.indexed > 0 || r.errors.length > 0) {
          console.log(`[Auto-Reindex] Indexed: ${r.indexed}, Errors: ${r.errors.length}`);
        }
      })
      .catch((e: unknown) => {
        console.error("[Auto-Reindex] Failed:", e);
      })
  );
}

/**
 * Trigger an external re-index in the background.
 */
export function triggerExternalReindex(
  executionCtx: ExecutionContext,
  db: DrizzleDB,
  ai: Ai | undefined,
  vectorize: VectorizeIndex | undefined,
  zaiApiKey?: string,
  githubPat?: string
): void {
  if (!vectorize) return;

  executionCtx.waitUntil(
    import("./indexer")
      .then(({ indexExternalResources }) => indexExternalResources(db, ai, vectorize, zaiApiKey, githubPat))
      .then((r: IndexResult) => {
        if (r.indexed > 0 || r.errors.length > 0) {
          console.log(`[External-Reindex] Indexed: ${r.indexed}, Errors: ${r.errors.length}`);
        }
      })
      .catch((e: unknown) => {
        console.error("[External-Reindex] Failed:", e);
      })
  );
}
