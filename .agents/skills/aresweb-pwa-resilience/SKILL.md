---
name: aresweb-pwa-resilience
description: Enforces self-healing PWA deployment patterns for ARESWEB, ensuring that stale service worker caches never permanently break the user experience after a new Cloudflare Pages deployment.
---

# ARES 23247 PWA Cache Resilience Protocol

ARESWEB uses Vite's PWA plugin (`vite-plugin-pwa` in `generateSW` mode) to precache all static assets for offline capability. This creates a critical deployment hazard: when new builds produce different chunk hashes, users with stale service workers will attempt to load old chunk filenames that no longer exist on the CDN, causing `TypeError: Failed to fetch dynamically imported module` crashes.

## 1. The Stale Chunk Problem

### Root Cause
Vite produces content-hashed chunks (e.g., `DocsEditor-C_2sAjjQ.js`). Each build generates new hashes. The PWA service worker caches the HTML entry point which contains `<script>` tags referencing specific chunk hashes. After a new deployment:

1. The CDN serves new chunks with new hashes.
2. The old service worker serves cached HTML referencing old hashes.
3. The browser tries to load `DocsEditor-C_2sAjjQ.js` (old) from the CDN which only has `DocsEditor-DUchFPcu.js` (new).
4. The dynamic `import()` fails with a `TypeError`.
5. React's ErrorBoundary catches it and shows the "Telemetry Fault Detected" screen.

### Symptoms
- `TypeError: Failed to fetch dynamically imported module: https://aresfirst.org/assets/ComponentName-XXXXXXXX.js`
- `Importing a module script failed`
- Only occurs on **lazy-loaded routes** (code-split via `React.lazy()`)
- Only affects users who have visited the site before (have a cached service worker)
- New/incognito users are never affected

## 2. The Self-Healing Solution

The `ErrorBoundary` component (`src/components/ErrorBoundary.tsx`) implements automatic recovery in `getDerivedStateFromError`:

### Detection
```typescript
const isStaleChunk =
  errorStr.includes("Failed to fetch dynamically imported module") ||
  errorStr.includes("Importing a module script failed") ||
  errorStr.includes("error loading dynamically imported module");
```

### Recovery
1. **Throttle check**: Uses `sessionStorage` with key `ares-stale-chunk-reload` and a 60-second cooldown to prevent infinite reload loops if the real issue is a broken build (not a stale cache).
2. **Service worker cleanup**: Unregisters all service worker registrations so the next page load fetches fresh HTML from the network.
3. **Force reload**: Calls `window.location.reload()` to load the new HTML with correct chunk references.

### Why sessionStorage (not localStorage)
- `sessionStorage` is scoped to the tab and cleared when the tab closes.
- This means if the auto-reload fails (e.g., the build itself is broken), the user only sees one reload loop per tab, then gets the error screen with the "Reboot Interface" button.
- `localStorage` would persist the cooldown across tabs and sessions, potentially masking legitimate errors.

## 3. Deployment Best Practices

### Always Direct-Deploy After Backend Changes
When changing `src/schemas/contracts/*.ts` files (shared between frontend and backend):
- GitHub Actions deploys frontend assets via `npm run build` + `wrangler pages deploy dist`
- Cloudflare compiles the `functions/` directory separately on their edge
- **Edge caching can delay function updates** even after a successful deploy

If a contract change isn't reflecting in production after a GitHub Actions deploy:
```bash
npm run build
npx wrangler pages deploy dist --project-name aresweb --commit-dirty=true --branch master
```

This bypasses any edge compilation cache by deploying the full bundle directly.

### Route Shadowing Prevention
- **Hono Routing Order**: Ensure dynamic wildcard routes (`/:slug`) are registered correctly relative to static routes in the Hono router to prevent unexpected 404s for offline-first endpoints.

## 4. Caching Strategy (v7.0 Performance Optimization)

### Service Worker Configuration
The PWA service worker (`vite.config.ts` VitePWA) uses the following caching strategy:

| Cache Type | Strategy | Entries | Duration | Purpose |
|------------|----------|----------|----------|---------|
| API Routes | NetworkFirst | 500 | 7 days | Backend data with stale fallback |
| Static Assets | CacheFirst | 200 | 30 days | Images, fonts, icons |
| JavaScript/CSS | StaleWhileRevalidate | 100 | 7 days | Code chunks |
| Fonts | CacheFirst | 20 | 1 year | Google Fonts, self-hosted |

### Edge Caching (Cloudflare Workers)
API routes use `edgeCacheMiddleware()` with stale-while-revalidate:
- **Posts**: 300s edge, 60s browser, 600s SWR
- **Events**: 180s edge, 60s browser, 300s SWR
- **Profiles/Seasons/Locations**: 180s edge, 60s browser, 300s SWR

### Prefetch Strategy
Dashboard navigation uses React Router v7's `prefetch="intent"`:
- Chunks preload on hover/focus before navigation
- Zero overhead for non-hovered routes
- Works with existing lazy-loaded code-splitting

### Bundle Splitting
Route-based chunks are isolated in `vite.config.ts`:
- `simulation`: R3F, Matter.js, physics code
- `dashboard-features`: Charts, tables, admin components
- `content-editors`: BlogEditor, EventEditor, DocsEditor
- `forms`: ProfileEditor, SeasonEditor, FinanceManager
- `analytics`: Tremor charts and analytics
- `layout`: Navbar, Footer, ErrorBoundary (always loaded)

## 5. Rules

- ❌ **BANNED**: Removing or weakening the stale chunk detection in `ErrorBoundary.tsx`.
- ❌ **BANNED**: Using `localStorage` for the reload throttle key — it must remain `sessionStorage`.
- ❌ **BANNED**: Deploying frontend-only changes without verifying that lazy-loaded routes still resolve correctly.
- ✅ **REQUIRED**: After any deployment that changes chunk hashes, verify at least one lazy-loaded route (e.g., `/dashboard/manage_docs`) loads without errors.
- ✅ **REQUIRED**: If adding new `React.lazy()` code-split points, ensure the ErrorBoundary wraps the `<Suspense>` boundary.
- ✅ **REQUIRED**: For dashboard navigation links, include `prefetch="intent"` to enable chunk preloading on hover.
- ✅ **REQUIRED**: Bundle size changes >10% from baseline will trigger CI/CD failure — run `npm run build` locally to check before pushing.
