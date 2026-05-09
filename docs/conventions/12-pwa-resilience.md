# PWA Cache Resilience

> PWA cache resilience and stale chunk recovery. Read when deploying or debugging service worker issues.

## The Stale Chunk Problem

After deployment, stale service workers serve HTML with old chunk hashes. Browser tries to load non-existent chunks → TypeError crashes.

**Symptoms:** `Failed to fetch dynamically imported module` on lazy-loaded routes.

## Self-Healing Solution

`ErrorBoundary.tsx` detects stale chunk errors:
1. Checks `sessionStorage` for 60s cooldown (prevents infinite loops)
2. Unregisters service workers
3. Forces `window.location.reload()`

**Why sessionStorage:** Per-tab scope. Broken builds only loop once per tab.

## Deployment Best Practices

**After backend changes (contract files):**
```bash
npm run build
npx wrangler pages deploy dist --project-name aresweb --commit-dirty=true
```

Direct deploy bypasses edge compilation cache.

## Caching Strategy

| Type | Strategy | Duration |
|---|---|---|
| API Routes | NetworkFirst | 7 days |
| Static Assets | CacheFirst | 30 days |
| JS/CSS | StaleWhileRevalidate | 7 days |
| Fonts | CacheFirst | 1 year |

## Bundle Splitting

Route-based chunks: `simulation`, `dashboard-features`, `content-editors`, `forms`, `analytics`, `layout`.

## Rules

- ❌ BANNED: Removing stale chunk detection
- ❌ BANNED: localStorage for reload throttle (must be sessionStorage)
- ✅ REQUIRED: Verify lazy-loaded routes after deployment
- ✅ REQUIRED: ErrorBoundary wraps Suspense boundaries
- ✅ REQUIRED: `prefetch="intent"` on dashboard nav links
