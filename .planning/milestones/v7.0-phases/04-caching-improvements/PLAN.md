---
gsd_plan_version: 1.0
phase: 04
phase_name: Caching Improvements
milestone: v7.0
status: planned
parent_plan: null
depends_on: [1]
---

# Phase 04: Caching Improvements

## Goal

Maximize cache hit rate for static and API resources through improved service worker and HTTP caching strategies.

## Context

Current caching strategy:
- PWA caches API responses: 100 entries, 1 day
- Stale-while-revalidate: 60 seconds (very short)
- No ETag support for conditional requests
- Static assets cached but could be more aggressive

## Requirements

### CACHE-01: Service Worker Optimization
- Increase API cache entries from 100 to 500
- Increase cache duration to 7 days
- Add runtime caching for more asset types

### CACHE-02: HTTP Caching Strategy
- Increase stale-while-revalidate to 5-15 minutes
- Add ETag support for conditional requests
- Ensure Brotli compression is enabled

## Tasks

### Plan 04-01: Service Worker Optimization

**Files to modify**:
- `vite.config.ts` - update workbox config
- Verify service worker behavior

**Implementation**:
```typescript
// vite.config.ts - enhanced workbox config
VitePWA({
  registerType: 'autoUpdate',
  injectRegister: 'auto',
  workbox: {
    skipWaiting: true,
    clientsClaim: true,
    maximumFileSizeToCacheInBytes: 15000000,
    globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff2}'],

    runtimeCaching: [
      // ── API Caching ────────────────────────────────────────────────────────
      {
        urlPattern: /^https:\/\/aresfirst\.org\/api\/.*/i,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'ares-api-cache-v3',
          networkTimeoutSeconds: 10, // Fall back to cache after 10s
          expiration: {
            maxEntries: 500, // Increase from 100
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days (up from 1)
          },
          cacheableResponse: {
            statuses: [0, 200, 304] // Add 304 for Not Modified
          }
        }
      },

      // ── Static Assets ───────────────────────────────────────────────────────
      {
        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|avif|ico)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'ares-images-cache',
          expiration: {
            maxEntries: 200,
            maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
          }
        }
      },

      // ── JavaScript/CSS ─────────────────────────────────────────────────────
      {
        urlPattern: /\.(?:js|css)$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'ares-static-resources',
          expiration: {
            maxEntries: 100,
            maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
          }
        }
      },

      // ── Fonts ───────────────────────────────────────────────────────────────
      {
        urlPattern: /\.(?:woff|woff2|ttf|otf|eot)$/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'ares-fonts-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          }
        }
      },

      // ── Google Fonts ────────────────────────────────────────────────────────
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          },
          cacheableResponse: {
            statuses: [0, 200]
          }
        }
      },

      // ── Google Fonts Static ────────────────────────────────────────────────
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'gstatic-fonts-cache',
          expiration: {
            maxEntries: 20,
            maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
          }
        }
      }
    ]
  }
})
```

---

### Plan 04-02: HTTP Caching Strategy

**Files to modify**:
- `functions/api/middleware/cache.ts` - edge cache middleware
- `functions/api/routes/*.ts` - per-route cache configuration
- Cloudflare Pages settings (if applicable)

**Implementation**:

**1. Update edge cache middleware**
```typescript
// functions/api/middleware/cache.ts
export const edgeCacheMiddleware = (
  sMaxAge = 300,     // Edge cache: 5 minutes (default)
  maxAge = 60,        // Browser cache: 1 minute (default)
  staleWhileRevalidate = 300 // 5 minutes (NEW)
) => {
  return cache({
    cacheName: 'aresweb-global-cache',
    cacheControl: `public, max-age=${maxAge}, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`,
  });
};
```

**2. Apply appropriate caching per route type**
```typescript
// functions/api/routes/posts.ts
// Public blog posts - can cache longer
postsRouter.use("/*", edgeCacheMiddleware(300, 60, 600)); // 5min edge, 1min browser, 10min SWR

// functions/api/routes/events.ts
// Events - moderate caching
eventsRouter.use("/*", edgeCacheMiddleware(180, 60, 300)); // 3min edge, 1min browser, 5min SWR

// functions/api/routes/tasks.ts
// Tasks - short cache (real-time data)
tasksRouter.use("/*", edgeCacheMiddleware(60, 30, 60)); // 1min edge, 30s browser, 1min SWR
```

**3. Add ETag support**
```typescript
// functions/api/utils/etag.ts (new)
import { createHash } from 'crypto';

export function generateETag(data: unknown): string {
  const str = JSON.stringify(data);
  return createHash('md5').update(str).digest('base64');
}

// Usage in handlers
export function withETag<T>(data: T, c: Context) {
  const etag = generateETag(data);
  const ifNoneMatch = c.req.header('If-None-Match');

  if (ifNoneMatch === etag) {
    return c.text('', 304); // Not Modified
  }

  return c.json(data, 200, {
    'ETag': etag,
    'Cache-Control': 'public, max-age=60, must-revalidate'
  });
}
```

**4. Verify Brotli compression**
Cloudflare automatically Brotli-comresses responses. Verify in wrangler.toml:
```toml
# wrangler.toml
[compatibility_date]
date = "2024-01-01"

# Brotli should be enabled by default on Cloudflare
# Can verify with: curl -H "Accept-Encoding: br" https://aresfirst.org/api/posts
```

---

## Success Criteria

1. Service worker caches 500+ API entries (up from 100)
2. Cache hit rate measured at 60%+ (use Chrome DevTools Application tab)
3. Stale-while-revalidate working (updates in background)
4. ETag responses return 304 for unchanged resources
5. Lighthouse "Uses efficient cache policy" score: 100

## Definition of Done

- [ ] VitePWA config updated with enhanced caching
- [ ] API cache entries increased to 500
- [ ] Cache duration increased to 7 days
- [ ] Runtime caching added for images, fonts, static assets
- [ ] Edge cache middleware updated with stale-while-revalidate
- [ ] Per-route cache configurations reviewed and updated
- [ ] ETag utility created and applied to GET endpoints
- [ ] Cache hit rate measured and documented
- [ ] Lighthouse score recorded (before/after)

## Estimated Effort

- Plan 04-01: 3 hours
- Plan 04-02: 4 hours
- Testing and validation: 2 hours
- **Total: 9 hours**

## Dependencies

- **Requires Phase 01** complete (optimizing chunks before caching strategy)
