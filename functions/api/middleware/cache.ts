import { cache } from "hono/cache";

/**
 * Edge Caching Middleware
 * Wraps hono/cache to explicitly use the Cloudflare Cache API instead of relying purely on CDN headers.
 * This ensures responses are actively cached by the Worker.
 * @param sMaxAge Seconds to cache on the Cloudflare Edge (CDN).
 * @param maxAge Seconds to cache in the user's browser.
 */
export const edgeCacheMiddleware = (sMaxAge = 300, maxAge = 60) => {
  return cache({
    cacheName: 'aresweb-global-cache',
    cacheControl: `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=60`,
  });
};
