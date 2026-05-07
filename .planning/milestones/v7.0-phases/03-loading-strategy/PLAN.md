---
gsd_plan_version: 1.0
phase: 03
phase_name: Loading Strategy
milestone: v7.0
status: planned
parent_plan: null
depends_on: [1]
---

# Phase 03: Loading Strategy

## Goal

Optimize how resources load and when to prioritize critical path rendering.

## Context

After Phase 01 reduces bundle size, we need to ensure resources load in the optimal order:
- Critical CSS/JS should load first
- Route-specific chunks should load independently
- Non-critical resources should be deferred

## Requirements

### LOAD-01: Route-Based Chunk Splitting
- Dashboard, Simulation, and Editor chunks are isolated
- Chunks only load when their route is accessed
- No shared code duplication between chunks

### LOAD-02: Preload Critical Resources
- Above-the-fold CSS preloaded
- Critical JavaScript preloaded
- Non-critical resources deferred

## Tasks

### Plan 03-01: Route-Based Chunk Splitting

**Files to modify**:
- `vite.config.ts` - update manualChunks strategy
- Build output verification

**Implementation**:
```typescript
// vite.config.ts - enhanced manualChunks
manualChunks(id) {
  const normalizedId = id.replace(/\\/g, '/');

  // ── Existing vendor chunks (from Phase 01) ───────────────────────────
  if (normalizedId.includes("node_modules/@tiptap/") || /* ... */) {
    return "editor";
  }
  // ... (keep existing vendor splitting)

  // ── New: Application-specific chunks ─────────────────────────────────

  // Simulation-heavy code (R3F, Matter.js, physics)
  if (normalizedId.includes("src/sims/") ||
      normalizedId.includes("src/components/SimulationPlayground") ||
      normalizedId.includes("src/components/SimManager") ||
      normalizedId.includes("src/components/editor/Sim")) {
    return "simulation";
  }

  // Dashboard-specific components (charts, tables, admin)
  if (normalizedId.includes("src/components/dashboard/") &&
      !normalizedId.includes("src/components/dashboard/DashboardSidebar") &&
      !normalizedId.includes("src/components/dashboard/DashboardRoutes")) {
    return "dashboard-features";
  }

  // Editor components (BlogEditor, EventEditor, DocsEditor)
  if (normalizedId.includes("src/components/BlogEditor") ||
      normalizedId.includes("src/components/EventEditor") ||
      normalizedId.includes("src/components/DocsEditor") ||
      normalizedId.includes("src/components/ContentManager")) {
    return "content-editors";
  }

  // Forms and input-heavy components
  if (normalizedId.includes("src/components/ProfileEditor") ||
      normalizedId.includes("src/components/SeasonEditor") ||
      normalizedId.includes("src/components/SponsorEditor") ||
      normalizedId.includes("src/components/FinanceManager")) {
    return "forms";
  }

  // Analytics and charts (Tremor)
  if (normalizedId.includes("src/components/AnalyticsDashboard") ||
      normalizedId.includes("src/components/DietarySummary") ||
      normalizedId.includes("src/components/MemberImpactOverview") ||
      normalizedId.includes("node_modules/@tremor/")) {
    return "analytics";
  }

  // Keep shared components in main chunk
  if (normalizedId.includes("src/components/Navbar") ||
      normalizedId.includes("src/components/Footer") ||
      normalizedId.includes("src/components/ErrorBoundary")) {
    return "layout";
  }
}
```

**Verification**:
```bash
# Run build and check chunk sizes
npm run build

# Analyze output
npx vite-bundle-visualizer
```

---

### Plan 03-02: Preload Critical Resources

**Files to modify**:
- `index.html` - add preload hints
- `vite.config.ts` - build.rollupOptions.output

**Implementation**:

**1. Preload critical CSS in index.html**
```html
<head>
  <!-- Preload critical fonts -->
  <link rel="preload" href="/fonts/league-spartan.woff2" as="font" type="font/woff2" crossorigin />

  <!-- Preload critical chunks (determined by analysis) -->
  <link rel="modulepreload" href="/assets/layout-<hash>.js" />
  <link rel="modulepreload" href="/assets/react-vendor-<hash>.js" />

  <!-- Defer non-critical chunks -->
  <link rel="preload" href="/assets/monaco-<hash>.js" as="script" importance="low" />
</head>
```

**2. Optimize chunk loading order in vite.config.ts**
```typescript
build: {
  rollupOptions: {
    output: {
      // Control chunk loading order
      manualChunks(id) { /* ... */ },
      // Ensure chunks load in correct order
      chunkFileNames: 'assets/[name]-[hash].js',
      entryFileNames: 'assets/[name]-[hash].js',
      assetFileNames: 'assets/[name]-[hash].[ext]'
    }
  }
}
```

**3. Add prefetch hints for likely next navigation**
```typescript
// src/components/DashboardSidebar.tsx
// Prefetch dashboard tabs when hovering over sidebar items
<div onMouseEnter={() => import('@/components/BlogEditor')}>
  Blog
</div>
```

---

## Success Criteria

1. Chunk analysis shows clean separation of concerns
2. Homepage loads < 5 chunks (not 20+)
3. Lighthouse "Reduce initial JavaScript" improved
4. No duplicate code between chunks

## Definition of Done

- [ ] Vite config updated with route-based chunking
- [ ] Build output analyzed - chunks verified
- [ ] Critical resources preloaded in index.html
- [ ] Non-critical resources deferred
- [ ] Prefetch hints added where appropriate
- [ ] Lighthouse score recorded (before/after)

## Estimated Effort

- Plan 03-01: 3 hours
- Plan 03-02: 2 hours
- Testing and validation: 2 hours
- **Total: 7 hours**

## Dependencies

- **Requires Phase 01** complete (chunking strategy builds on Monaco/Babel changes)
