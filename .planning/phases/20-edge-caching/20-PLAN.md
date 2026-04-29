# Phase 20: Edge Caching for Read Routes - Plan

## Goal
Add edge cache headers to heavy public read routes (posts, events, seasons) to reduce D1 database hits and improve read performance.

## Strategy
Modify Hono routers to include `c.header("Cache-Control", "public, max-age=60, s-maxage=300")` for public GET endpoints. 

1. **posts.ts**: Add cache headers to the `GET /` (list published posts) and `GET /:slug` (read published post).
2. **events/index.ts**: Add cache headers to the `GET /` (list published events).
3. **seasons.ts**: Add cache headers to `GET /` (list public seasons).

## Execution Steps
1. Insert `cacheMiddleware` or direct `c.header` calls into `functions/api/routes/posts.ts`.
2. Insert headers into `functions/api/routes/events/index.ts`.
3. Insert headers into `functions/api/routes/seasons.ts`.
4. Create a shared `cacheMiddleware` utility in `functions/api/middleware/cache.ts` for clean reusability.
5. Verify using `tsc --noEmit`.
