/**
 * lazyBabel.ts
 *
 * Lazy-loaded Babel Standalone utility with graceful fallback.
 * Babel is only loaded when code transformation is needed (simulation/doc preview).
 * On transform failure, returns original code (preview is nice-to-have, not critical).
 *
 * SECURITY: Babel loads from @babel/standalone npm package.
 * MITIGATION: CSP restricts script sources to 'self' only.
 */

import { logger } from "./logger";

// Cached Babel instance (loaded once on first use)
let babelInstance: {
  transform: (code: string, opts: { presets: readonly string[]; filename?: string }) => { code: string };
} | null = null;

/**
 * Transform code using Babel Standalone (lazy-loaded).
 *
 * @param code - Source code to transform
 * @param presets - Babel presets to apply (e.g., ['react', 'typescript'])
 * @returns Transformed code, or original code on error (graceful fallback)
 *
 * @example
 * const transformed = await transformCode('<Foo />', ['react']);
 */
export async function transformCode(
  code: string,
  presets: string[] = []
): Promise<string> {
  try {
    // Lazy load Babel on first call
    if (!babelInstance) {
      logger.debug("Lazy-loading Babel Standalone...");

      // no types available for @babel/standalone in this build environment
      const mod = await import("@babel/standalone");

      // Babel exports as default or named depending on bundler
      babelInstance = mod.default || (mod as unknown as {
        transform: (code: string, opts: { presets: readonly string[]; filename?: string }) => { code: string };
      });

      logger.debug("Babel Standalone loaded successfully");
    }

    // Transform code with requested presets
    if (!babelInstance) {
      throw new Error("Babel instance failed to load");
    }

    const result = babelInstance.transform(code, {
      presets: presets.filter(Boolean) as never[], // Type-safe preset filtering
      filename: "transform.js", // Inline filename for better error messages
    });

    return result.code;
  } catch (error) {
    // Graceful fallback: return original code on transform error
    // Preview is nice-to-have, not critical — raw code is still useful
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.warn("Babel transform failed, returning original code:", errorMessage);

    return code;
  }
}

/**
 * Retry wrapper for transformCode with exponential backoff.
 * Used for transient network errors during initial Babel load.
 *
 * @param code - Source code to transform
 * @param presets - Babel presets
 * @param retries - Number of retry attempts (default: 1)
 * @param delay - Initial delay in ms (default: 1000)
 */
export async function transformCodeWithRetry(
  code: string,
  presets: string[] = [],
  retries = 1,
  delay = 1000
): Promise<string> {
  try {
    return await transformCode(code, presets);
  } catch (error) {
    if (retries > 0) {
      logger.debug(`Transform failed, retrying in ${delay}ms... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return transformCodeWithRetry(code, presets, retries - 1, delay * 2);
    }
    throw error;
  }
}
