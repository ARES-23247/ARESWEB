# Phase 48: Caching Improvements Context

**Goal**: Service worker optimization (500 entries) and HTTP caching (5-15min SWR).

## Current State
- Vite PWA plugin manages caching of static assets and some API routes.
- Cloudflare pages hosts the site, Edge caching logic sits in `functions/api/middleware/cache.ts`.
- `hono/etag` handles ETags for caching validations.

## Requirements
- Increase API cache entries from 100 to 500, with an increased duration to 7 days.
- Enhance Edge cache middleware to add stale-while-revalidate headers.
- Provide automatic ETags for all GET API responses for 304 Not Modified validation.
