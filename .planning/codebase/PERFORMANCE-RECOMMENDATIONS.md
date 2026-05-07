# Performance Improvement Recommendations

**Last Updated**: 2026-05-06
**Status**: Ready for Implementation

---

## Executive Summary

Current bundle analysis shows several optimization opportunities:
- **Monaco Editor**: 2.5MB (loaded eagerly but only needed on 2 routes)
- **Babel Standalone**: 3MB (only needed for docs/simulation editing)
- **Tiptap Editor**: 1.5MB (only needed on blog/event/doc editing routes)
- **Tremor Charts**: 785KB (only needed on analytics/dashboard pages)

### Estimated Impact
Implementing all recommendations could reduce initial bundle by **60-70%** for most users.

---

## Priority 1: Monaco Editor Lazy Loading (~2.5MB savings)

### Current Issue
Monaco Editor is imported eagerly in `SimulationPlayground.tsx`:
```typescript
import { loader } from "@monaco-editor/react";
```

This means the 2.5MB Monaco bundle is loaded even when users visit the homepage.

### Solution
Monaco already has its own chunk (`monaco` in vite.config.ts), but we can prevent it from loading on routes that don't need it.

**Files to Modify**:
- `src/components/SimulationPlayground.tsx`
- `src/components/editor/SimCodeEditor.tsx` (if exists)

**Implementation**:
```typescript
// Inside SimulationPlayground component
const MonacoEditor = lazy(() => import("@monaco-editor/react").then(m => ({ default: m.loader })));

// Wrap in Suspense where needed
<Suspense fallback={<CodeEditorSkeleton />}>
  <MonacoEditor />
</Suspense>
```

### Expected Result
- Users not visiting `/sim-runner` or `/dashboard/simulation-playground` save 2.5MB
- Editor routes see no impact (lazy load happens synchronously when needed)

---

## Priority 2: Babel Standalone Lazy Loading (~3MB savings)

### Current Issue
Babel standalone is imported in multiple places for in-browser transpilation:
- `SimulationPlayground.tsx` - for simulation code
- `DocsEditor.tsx` - for doc preview

### Solution
Create a shared lazy-loaded babel wrapper:

```typescript
// src/utils/lazyBabel.ts
export const babelTransform = lazy(() =>
  import("@babel/standalone").then(babel => ({
    default: (code: string, presets: string[]) =>
      babel.default.transform(code, { presets }).code
  }))
);
```

### Expected Result
- 3MB not loaded for users not editing simulations/docs
- Preview functionality unchanged

---

## Priority 3: Tiptap Editor Lazy Loading (~1.5MB savings)

### Current Issue
Tiptap editor dependencies are included in the main `editor` chunk which loads eagerly.

### Solution
The editor chunk is already split, but we can ensure it's only loaded when navigating to edit routes:

```typescript
// vite.config.ts - already exists, verify:
if (normalizedId.includes("node_modules/@tiptap/") || ...) {
  return "editor";
}
```

The chunk exists, but we should verify routes using Tiptap are lazy-loaded (they are: BlogEditor, EventEditor, DocsEditor).

### Additional Optimization
Consider using Tiptap's `collaboration` extensions only when actually collaborating (currently loaded unconditionally in `TaskDetailsModal.tsx`).

---

## Priority 4: Route-Based Chunk Splitting

### Current Issue
Dashboard routes are lazy-loaded, but we could do better by splitting dashboard into sub-chunks.

### Solution
Update `vite.config.ts` manualChunks to split dashboard components:

```typescript
// Simulation-related chunks
if (normalizedId.includes("src/sims/")) {
  return "sims";
}

// Dashboard-specific chunks
if (normalizedId.includes("src/components/dashboard/")) {
  return "dashboard";
}

// Editor-related chunks
if (normalizedId.includes("src/components/editor/")) {
  return "editor-ui";
}

// Form-heavy components
if (normalizedId.includes("src/components/BlogEditor") ||
    normalizedId.includes("src/components/EventEditor") ||
    normalizedId.includes("src/components/DocsEditor")) {
  return "editors";
}
```

---

## Priority 5: Image Optimization

### Current State
- LazyImage component exists and uses `loading="lazy"`
- PWA caches images up to 15MB

### Improvements
1. **Add WebP support** - Convert PNG/JPG to WebP for smaller sizes
2. **Add responsive images** - Use `srcset` for different screen sizes
3. **Add image compression** - Use sharp or imagemin in build process

```typescript
// vite.config.ts - add imagemin plugin
import { imagetools } from 'vite-imagetools'; // or similar

plugins: [
  imagetools({
    include: ['**/*.{png,jpg,jpeg,webp,avif}'],
    presets: {
      default: {
        formats: ['webp', 'avif'],
        preload: false,
        enforce: 'pre'
      }
    }
  })
]
```

---

## Priority 6: Font Loading Strategy

### Current State
- Google Fonts loaded via standard link tag
- PWA caches fonts for 1 year (good!)

### Improvements
1. **Use `font-display: swap`** - Show text immediately, swap in font when loaded
2. **Self-host critical fonts** - Avoid flash of unstyled text
3. **Preload key fonts** - Add `<link rel="preload">` for fonts used above fold

```css
/* Add to global CSS */
@font-face {
  font-family: 'League Spartan';
  font-display: swap; /* Add this */
  src: url('/fonts/league-spartan.woff2') format('woff2');
}
```

---

## Priority 7: API Response Caching

### Current State
- PWA caches API responses for 1 day (NetworkFirst)
- Hono cache middleware on some routes

### Improvements
1. **Increase stale-while-revalidate** - From 60s to 5-15 minutes for GET endpoints
2. **AddETag support** - Browser can validate cached responses
3. **Compress responses** - Ensure Cloudflare Brotli is enabled

```typescript
// functions/api/routes/inquiries/index.ts
postsRouter.use("/", edgeCacheMiddleware(300, 60)); // Consider 300, 300
```

---

## Priority 8: React Component Optimizations

### useMemo/useCallback Audit

Run ESLint rule to find missing dependencies:

```bash
npx eslint . --rule 'react-hooks/exhaustive-deps: error'
```

Known issues from earlier analysis:
- `SimulationPlayground.tsx` - has 3 suppressions for animation frame lifecycle
- `ProfileEditor.tsx` - 1 suppression
- `TaskBoardPage.tsx` - potential for optimization

---

## Priority 9: Service Worker Optimization

### Current State
- Workbox caches up to 15MB files
- 100 max entries for API cache

### Improvements
1. **Increase API cache entries** - From 100 to 500 for more cache hits
2. **Add precache for critical routes** - Home, About, etc.
3. **Add runtime caching for static assets** - Better cache hit rate

```typescript
// vite.config.ts - workbox config
workbox: {
  runtimeCaching: [
    {
      urlPattern: /^https:\/\/aresfirst\.org\/api\/.*/i,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'ares-api-cache-v2',
        expiration: {
          maxEntries: 500, // Increase from 100
          maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
        }
      }
    }
  ]
}
```

---

## Priority 10: Monitoring & Measurement

### Add Performance Monitoring

1. **Web Vitals tracking** - LCP, FID, CLS
2. **Bundle size tracking** - CI/CD check for size regressions
3. **API response time tracking** - Already have Prometheus

```typescript
// src/utils/webVitals.ts
import { getCLS, getFID, getFCP, getLCP, getTTFB } from 'web-vitals';

export function reportWebVitals() {
  getCLS(console.log);
  getFID(console.log);
  getFCP(console.log);
  getLCP(console.log);
  getTTFB(console.log);
}
```

---

## Implementation Order

1. **Week 1**: Priority 1 (Monaco), Priority 2 (Babel) - Biggest bundle impact
2. **Week 2**: Priority 4 (Route chunking), Priority 5 (Images)
3. **Week 3**: Priority 6-9 (Fonts, caching, service worker)
4. **Week 4**: Priority 10 (Monitoring) - Set up for ongoing optimization

---

## Success Metrics

| Metric | Current | Target |
|--------|---------|--------|
| Initial JS Bundle | ~8MB | ~3MB |
| Time to Interactive | ~5s | ~2s |
| Lighthouse Score | ? | 90+ |
| First Contentful Paint | ~1.5s | <1s |

---

## Related Documentation

- [Vite Performance](https://vitejs.dev/guide/performance.html)
- [Web Vitals](https://web.dev/vitals/)
- [PWA Best Practices](https://web.dev/pwa/)
