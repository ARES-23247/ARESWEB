import { Context, Next } from "hono";

/**
 * Edge Caching Middleware
 * Adds standard Cache-Control headers to public read-only responses.
 * This utilizes Cloudflare Pages / CDN Edge caching to prevent redundant D1 database queries.
 * @param sMaxAge Seconds to cache on the Cloudflare Edge (CDN).
 * @param maxAge Seconds to cache in the user's browser.
 */
export const edgeCacheMiddleware = (sMaxAge = 300, maxAge = 60) => {
  return async (c: Context, next: Next) => {
    await next();
    
    // Only cache successful GET requests
    if (c.req.method === "GET" && c.res.status === 200) {
      c.res.headers.set("Cache-Control", `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=60`);
    }
  };
};
