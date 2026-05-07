# Phase 01: Bundle Size Optimization - Context

**Gathered:** 2026-05-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Reduce initial JavaScript bundle by 5-6MB through lazy-loading Monaco Editor (2.5MB) and Babel Standalone (3MB). These heavy dependencies should only load when users navigate to routes that need them (`/sim-runner`, `/dashboard/simulation-playground` for Monaco; simulation/doc editing for Babel). The optimization must maintain existing editor functionality while improving page load times for the majority of users who never use these features.

</domain>

<decisions>
## Implementation Decisions

### Loading UX
- Use SimLoader-style compact ARES-red spinner for both Monaco and Babel loading states — matches existing simulation loading pattern
- Show "Taking longer than expected..." message after 3 seconds
- Implement editor skeleton layout (placeholder toolbar + code area) during load to maintain layout stability

### Error Handling
- Lazy load failures: retry once with exponential backoff before showing error
- Monaco worker initialization failure: show friendly error message with "Try refreshing" button
- Babel transform failure: graceful fallback to show raw code (preview is nice-to-have, not critical)

### Prefetch Strategy
- No hover prefetching for Monaco — measure actual impact before adding bandwidth cost
- Preload react-vendor chunk only in index.html (high ROI, small size)
- Add DNS prefetch for jsDelivr CDN (Monaco source) — zero-cost performance win

### Claude's Discretion
- Specific timeout/backoff values within the accepted ranges
- Exact wording of error messages (maintain ARES championship-grade tone)
- Skeleton component implementation details (can reuse existing patterns or create new)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `TabLoader` (DashboardRoutes.tsx) — full-height centered spinner with motion animation
- `SimLoader` (DocsMarkdownRenderer.tsx) — compact ARES-red spinner (`border-ares-red`)
- ARES brand colors: `ares-red`, `ares-gold`, `ares-bronze`

### Established Patterns
- Lazy loading: `const Component = lazy(() => import("path/to/Component"))`
- Suspense wrapping: `<Suspense fallback={<Loader />}>{children}</Suspense>`
- Monaco already lazy-imported: `const MonacoEditor = lazy(() => import("@monaco-editor/react"))`
- Babel already dynamic-imported: `await import("@babel/standalone")`

### Integration Points
- `src/components/SimulationPlayground.tsx` — primary Monaco consumer (line 38-39)
- `src/components/docs/DocsMarkdownRenderer.tsx` — Babel transform usage
- `vite.config.ts` manualChunks — Monaco and Babel already isolated to separate chunks
- `index.html` — entry point for preload hints

</code_context>

<specifics>
## Specific Ideas

- Follow existing SimLoader pattern for consistency
- Use ARES-red spinner to match brand (avoid generic blue spinners)
- Error messages should be helpful, not technical ("Something went wrong" not "Failed to fetch chunk")

</specifics>

<deferred>
## Deferred Ideas

- Hover prefetching — defer until we have actual metrics on navigation patterns
- Service worker caching for Monaco chunks — consider in Phase 04 (Caching Improvements)
- Progressive enhancement for code editing without Monaco — out of scope for this phase

</deferred>
