# Milestone Roadmap

## Milestones

- v6.6 TypeScript Strictness - Phases 21-26 (shipped 2026-05-05)
- v6.7 TypeScript Any Elimination - Phases 27-33 (shipped 2026-05-06)
- v6.8 Hono Zod OpenAPI Migration - Phases 34-37 (shipped 2026-05-06)
- v6.9 Type Safety Debt Elimination - Phases 38-42 (shipped 2026-05-06)
- v6.10 Infrastructure & Polish - Phases 43-44 (shipped 2026-05-07)
- **v7.0 Performance Optimization** - Phases 45-50 (planned)

## Phases

<details>
<summary>v6.6 TypeScript Strictness (Phases 21-26) - SHIPPED 2026-05-05</summary>

- [x] Phase 21: Core Domain and Data Layer Strictness
- [x] Phase 22: ARES Physics and Math Engine Validation
- [x] Phase 23: R3F and Sim Component Typings
- [x] Phase 24: ESLint Lockdown and CI Validation
- [x] Phase 25: Comprehensive Security Audit
- [x] Phase 26: Calendar and Event Editor Enhancements

</details>

<details>
<summary>v6.7 TypeScript Any Elimination (Phases 27-33) - SHIPPED 2026-05-06</summary>

- [x] Phase 27: Type Foundation
- [x] Phase 28: High-Impact Handlers
- [x] Phase 28.1: AI Simulation and Analytics Stabilization
- [x] Phase 29: Contract Inference
- [x] Phase 29.1: Remaining Route Contract Inference
- [x] Phase 30: Test Types
- [x] Phase 31: Frontend Components
- [x] Phase 32: Final Validation
- [x] Phase 33: Simulation Playground AI Diff View

</details>

<details>
<summary>v6.8 Hono Zod OpenAPI Migration (Phases 34-37) - SHIPPED 2026-05-06</summary>

- [x] Phase 34: Infrastructure and Proof of Concept
- [x] Phase 35: Simple Route Migration
- [x] Phase 36: Complex Route Migration
- [x] Phase 37: Cleanup and OpenAPI Spec

</details>

<details>
<summary>v6.9 Type Safety Debt Elimination (Phases 38-42) - SHIPPED 2026-05-06</summary>

- [x] Phase 38: Typed Hono Handler Wrapper
- [x] Phase 39: Frontend API Type Unification
- [x] Phase 40: D1 Kysely Type Wrappers
- [x] Phase 41: React Hooks Dependency Audit
- [x] Phase 42: Final Sweep and CI Hardening

</details>

### v6.10 Infrastructure & Polish (Phases 43-44)

**Goal**: Optimize edge-native performance and improve user engagement through automated communication workflows.

- [x] **Phase 43: Edge-Native Caching Optimization** - Implement context-aware `edgeCacheMiddleware` for high-traffic routes.
- [x] **Phase 44: Automated Inquiry Communication** - Deliver automated branded email receipts for all contact form submissions.

## Phase Details

### Phase 38: Typed Hono Handler Wrapper

**Goal**: Create a generic `typedHandler<R>()` utility that extracts request parameter types from `createRoute()` definitions, eliminating the need for `as any` casts across all 50+ backend route files.

**Depends on**: Nothing (foundation phase)

**Requirements**: WRAP-01, WRAP-02, WRAP-03, VAL-01, VAL-02

**Success Criteria**:
1. `typedHandler<typeof myRoute>()` correctly infers `json`, `params`, `query` from route schema
2. At least 25 route files converted — `as any` count drops by 50%+
3. File-level `eslint-disable @typescript-eslint/no-explicit-any` removed from converted files
4. All existing tests pass without changes
5. `tsc --noEmit` and `eslint --max-warnings 0` pass

**Plans**: 0 (run /gsd-plan-phase 38 to create)

---

### Phase 39: Frontend API Type Unification

**Goal**: Re-export `z.infer<>` types from backend route schemas into frontend hooks and components, eliminating inline `any` casts for API response data.

**Depends on**: Phase 38 (typed handler pattern established)

**Requirements**: FRONT-01, FRONT-02, FRONT-03, VAL-01, VAL-02

**Target files**:
- JudgesHub.tsx (6 inline disables), Events.tsx, About.tsx, Leaderboard.tsx
- Academy.tsx, PrintPortfolio.tsx, MemberImpactOverview.tsx
- ProfileEditor.tsx, TaskBoardPage.tsx, RevisionManager.tsx
- useDashboardSession.ts, SEO.tsx, TiptapRenderer.tsx

**Success Criteria**:
1. All frontend `no-explicit-any` disables removed from listed components
2. Shared type definitions exported from `shared/routes/` or `shared/types/`
3. JudgesHub.tsx has zero inline `eslint-disable` comments
4. All existing tests pass
5. `tsc --noEmit` passes

**Plans**: 0 (run /gsd-plan-phase 39 to create)

---

### Phase 40: D1 Kysely Type Wrappers

**Goal**: Replace all 17 `@ts-expect-error` directives with typed Kysely query helper functions that properly handle D1's untyped responses.

**Depends on**: Nothing (independent workstream)

**Requirements**: DB-01, DB-02, VAL-01, VAL-02

**Success Criteria**:
1. Zero `@ts-expect-error` directives in production code
2. Typed helper functions (e.g., `typedQuery<T>()`) encapsulate D1 edge cases
3. All database queries return properly typed results
4. All existing tests pass
5. `tsc --noEmit` passes

**Plans**: 0 (run /gsd-plan-phase 40 to create)

---

### Phase 41: React Hooks Dependency Audit

**Goal**: Refactor components with suppressed `react-hooks/exhaustive-deps` warnings to use stable dependency patterns (refs, extracted callbacks, or `useCallback`).

**Depends on**: Nothing (independent workstream)

**Requirements**: HOOKS-01, HOOKS-02, VAL-01, VAL-03

**Target files**:
- SimulationPlayground.tsx (3 suppressions — animation frame lifecycle)
- ProfileEditor.tsx (1 suppression)
- SeasonEditor.tsx (file-level `set-state-in-effect` disable)
- TeamAvailability.tsx, EventSelector.tsx, ScoutingTool.tsx

**Success Criteria**:
1. All `react-hooks/exhaustive-deps` suppressions removed or justified with comment
2. All `react-hooks/set-state-in-effect` suppressions refactored
3. No new rendering bugs introduced (manual + automated verification)
4. `eslint --max-warnings 0` passes

**Plans**: 0 (run /gsd-plan-phase 41 to create)

---

### Phase 42: Final Sweep and CI Hardening

**Goal**: Remove every remaining `eslint-disable` directive from production code and lock down CI to prevent regressions.

**Depends on**: Phase 38, 39, 40, 41

**Requirements**: SWEEP-01, SWEEP-02, SWEEP-03, VAL-01, VAL-02, VAL-03

**Success Criteria**:
1. `as any` casts in non-test code: **0**
2. File-level `eslint-disable` in non-test code: **0**
3. `@ts-expect-error` in production code: **0**
4. All CI gates pass: `tsc`, `eslint --max-warnings 0`, `npm run build`
5. CI config updated with explicit `no-explicit-any: error` (no longer just `warn`)
6. All 926+ tests pass

**Plans**: 0 (run /gsd-plan-phase 42 to create)

---

### Phase 43: Edge-Native Caching Optimization

**Goal**: Implement a robust edge-native caching strategy using `edgeCacheMiddleware` while ensuring global middleware doesn't overwrite specific cache headers.

**Requirements**: CACHE-01, CACHE-02, CACHE-03, VAL-01

**Success Criteria**:
1. `edgeCacheMiddleware` active on `/api/docs` (list, search, slug).
2. Global `Cache-Control` middleware in `[[route]].ts` is context-aware.
3. Admin routes (`/admin/*`) remain uncached.
4. `tsc --noEmit` passes.

---

### Phase 44: Automated Inquiry Communication

**Goal**: Establish automated branded email receipts for all contact form submissions to improve user engagement.

**Requirements**: COMM-01, COMM-02, COMM-03

**Success Criteria**:
1. `Join Team` inquiries trigger automated receipt via `dispatchReceipt`.
2. `Support` inquiries trigger automated receipt via `dispatchReceipt`.
3. Email templates use ARES championship-tier branding.

---

## v7.0 Performance Optimization (Phases 45-49)

**Goal**: Reduce initial bundle size by 60-70% and achieve 90+ Lighthouse score

**Baseline metrics** (2026-05-06):
- Initial bundle: ~8MB
- Largest chunks: Monaco (2.5MB), Babel (3MB), Editor (1.5MB)
- Lighthouse Performance: TBD

**Target metrics**:
- Initial bundle: <3MB
- Lighthouse Performance: 90+
- First Contentful Paint: <1s
- Time to Interactive: <2s

### Phase 45: Bundle Size Optimization

**Goal**: Reduce initial JavaScript bundle by 5-6MB by lazy-loading Monaco Editor (2.5MB) and Babel Standalone (3MB).

**Requirements**: MON-01, MON-02, MON-03

**Success Criteria**:
1. Initial bundle (index.html + main.js + react-vendor) < 3MB
2. Monaco chunk only loads on /sim-runner or /dashboard/simulation-playground routes
3. Babel chunk only loads when simulation/doc preview is triggered
4. Loading state shows ARES-red spinner matching SimLoader pattern
5. Error states show friendly messages with retry option
6. All existing editor functionality preserved (no regression)

**Plans**: 1 plan
- [x] 01-01-PLAN.md — Monaco and Babel lazy loading with ARES-branded loading UX

---

### Phase 46: Media Optimization

**Goal**: Convert images to WebP, implement responsive images, and add font-display swap.

**Plans**: 
- [x] WebP Conversion Pipeline
- [x] Responsive Images Implementation
- [x] Font Loading Strategy

**Success Criteria**:
1. All images in public/ have WebP counterparts (build-generated)
2. Responsive variants (640w, 1024w, 1920w) exist for hero images
3. LazyImage supports srcset/sizes props (backward compatible)
4. Fonts use font-display: swap (no FOIT, text visible immediately)
5. League Spartan preloaded via <link> tag
6. Lighthouse "Efficiently encode images" score: 90+
7. Image payload reduced by 30%+ (compare before/after build output)

**Plans**: 1 plan
- [ ] 02-01-PLAN.md — WebP conversion pipeline, responsive image variants, extended LazyImage with srcset, font preloading

---

### Phase 47: Loading Strategy

**Goal**: Route-based chunk splitting and critical resource preloading.

**Plans**:
- [x] Route-Based Chunk Splitting
- [x] Preload Critical Resources

---

### Phase 48: Caching Improvements

**Goal**: Service worker optimization (500 entries) and HTTP caching (5-15min SWR).

**Plans**: See `.planning/milestones/v7.0-phases/04-caching-improvements/PLAN.md`

---

### Phase 49: Monitoring

**Goal**: Web Vitals tracking, bundle size CI/CD checks, and performance dashboard.

**Plans**: See `.planning/milestones/v7.0-phases/05-monitoring/PLAN.md`

### Phase 51: UI fixes: Header ARES Academy and Social Media manager nesting

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 50
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 51 to break down)

---

### Phase 50: Dashboard UX Flattening

**Goal**: Integrate Social Media Manager directly into dashboard layout by removing redundant nesting and matching standard page patterns.

**Depends on**: Nothing

**Requirements**: UX-01, UX-02

**Success Criteria**:
1. `SocialHub` no longer has redundant borders/backgrounds.
2. Dashboard header pattern applied to Social Media Manager.
3. Tab navigation matches dashboard standard.

**Plans**: 0 (run /gsd-plan-phase 50 to create)
