---
phase: 01
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/components/SimulationPlayground.tsx
  - src/components/editor/LazyMonacoEditor.tsx
  - src/utils/lazyBabel.ts
  - src/components/editor/EditorSkeleton.tsx
  - vite.config.ts
  - index.html
autonomous: true
requirements: []
must_haves:
  truths:
    - "Users visiting Home, About, Blog, etc. do not download Monaco (2.5MB) or Babel (3MB) chunks"
    - "Users navigating to /sim-runner or /dashboard/simulation-playground see SimLoader-style spinner while Monaco loads"
    - "Monaco editor functions correctly after lazy loading (no feature regression)"
    - "Babel transform only loads when simulation/doc preview is needed"
    - "Initial bundle (index.html + main.js) < 3MB"
  artifacts:
    - path: "src/components/editor/LazyMonacoEditor.tsx"
      provides: "Lazy-loaded Monaco wrapper with error handling"
      min_lines: 40
    - path: "src/utils/lazyBabel.ts"
      provides: "Lazy-loaded Babel transform utility"
      min_lines: 25
    - path: "src/components/editor/EditorSkeleton.tsx"
      provides: "Editor placeholder skeleton during load"
      min_lines: 20
    - path: "vite.config.ts"
      provides: "Manual chunk configuration for Monaco/Babel isolation"
      contains: "manualChunks"
    - path: "index.html"
      provides: "DNS prefetch for jsDelivr CDN, react-vendor preload"
      contains: "dns-prefetch"
  key_links:
    - from: "src/components/SimulationPlayground.tsx"
      to: "src/components/editor/LazyMonacoEditor.tsx"
      via: "lazy import + Suspense wrapper"
      pattern: "lazy\\(.*import.*monaco"
    - from: "src/components/editor/LazyMonacoEditor.tsx"
      to: "src/components/editor/EditorSkeleton.tsx"
      via: "Suspense fallback prop"
      pattern: "Suspense fallback=\\{EditorSkeleton\\}"
    - from: "src/components/docs/DocsMarkdownRenderer.tsx"
      to: "src/utils/lazyBabel.ts"
      via: "dynamic import on transform"
      pattern: "await import.*babel"

---

# Phase 01-01: Bundle Size Optimization

<objective>
Reduce initial JavaScript bundle by 5-6MB by lazy-loading Monaco Editor (2.5MB) and Babel Standalone (3MB). These heavy dependencies should only load when users navigate to routes that need them, while maintaining championship-grade loading UX with ARES-branded spinners and graceful error handling.

Purpose: Improve page load times for the majority of users who never use the editor or simulation preview features.
Output: Lazy-loaded Monaco/Babel components, updated Vite chunk configuration, DNS prefetch hints, <3MB initial bundle
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@.planning/ROADMAP.md
@.planning/milestones/v7.0-phases/01-bundle-size-optimization/01-CONTEXT.md

# Existing assets to reuse
From src/components/docs/DocsMarkdownRenderer.tsx (SimLoader pattern):
```tsx
function SimLoader() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="w-8 h-8 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin" />
    </div>
  );
}
```

From src/components/dashboard/DashboardRoutes.tsx (TabLoader pattern):
```tsx
function TabLoader() {
  return (
    <div className="flex justify-center flex-col gap-4 items-center py-32">
      <motion.div /* animation props */ className="w-12 h-12 border-4 border-ares-red/30 border-t-ares-red rounded-full animate-spin" />
    </div>
  );
}
```

# ARES brand colors (src/index.css)
--ares-red: #c00000;
--ares-gold: #FFB81C;
--ares-bronze: #cd7f32;

# Current Monaco usage (src/components/SimulationPlayground.tsx)
Lines 5, 38-39: Already using `lazy(() => import("@monaco-editor/react"))`
Line 131-133: Editor refs typed with Monaco types
Line 1234+: MonacoEditor component with theme="vs-dark"

# Current chunk isolation (vite.config.ts)
Lines 154-165: Monaco and Babel already split into separate chunks ("monaco", "babel")
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create LazyMonacoEditor wrapper with loading UX and error handling</name>
  <files>
    src/components/editor/LazyMonacoEditor.tsx
    src/components/editor/EditorSkeleton.tsx
  </files>
  <read_first>
    1. Read src/components/docs/DocsMarkdownRenderer.tsx lines 16-22 (SimLoader pattern)
    2. Read src/components/SimulationPlayground.tsx lines 1-50 (Monaco import pattern, loader config)
    3. Read src/components/dashboard/DashboardRoutes.tsx lines 40-50 (TabLoader motion pattern)
  </read_first>
  <action>
    Create two new files:

    **src/components/editor/EditorSkeleton.tsx**:
    - Skeleton layout matching Monaco editor dimensions (toolbar + code area placeholders)
    - Use ARES brand colors: border-ares-red/30 for placeholder borders
    - Shimmer animation using CSS keyframes or framer-motion
    - Maintains layout stability (prevents CLS)

    **src/components/editor/LazyMonacoEditor.tsx**:
    - Lazy import MonacoEditor from @monaco-editor/react
    - Wrap in Suspense with SimLoader-style spinner (w-8 h-8, border-ares-red/30, border-t-ares-red)
    - Implement 3-second timeout: after 3s, show "Taking longer than expected..." message
    - Error boundary with retry logic (single retry with exponential backoff: 1s delay)
    - On Monaco worker initialization failure: show friendly error with "Try refreshing" button
    - Use loader.config from SimulationPlayground.tsx (CDN config, MONACO_VERSION)
    - Export as default component accepting all MonacoEditor props

    Per CONTEXT.md decision D-01: Use SimLoader-style compact ARES-red spinner
    Per CONTEXT.md decision D-02: Show "Taking longer than expected..." after 3 seconds
    Per CONTEXT.md decision D-03: Implement editor skeleton layout for layout stability
    Per CONTEXT.md decision D-04: Lazy load failures retry once with exponential backoff
    Per CONTEXT.md decision D-05: Monaco worker failure shows friendly error with refresh button
  </action>
  <verify>
    <automated>npm run build && grep -c "LazyMonacoEditor" dist/assets/*.js | head -1 > /dev/null 2>&1</automated>
  </verify>
  <done>
    LazyMonacoEditor.tsx exists with lazy import, Suspense wrapper, 3s timeout message, error boundary with retry
    EditorSkeleton.tsx exists with placeholder layout and ARES-branded shimmer
    Both files export components for use in SimulationPlayground
  </done>
</task>

<task type="auto">
  <name>Task 2: Create lazyBabel utility with graceful fallback</name>
  <files>
    src/utils/lazyBabel.ts
  </files>
  <read_first>
    1. Read src/components/docs/DocsMarkdownRenderer.tsx (current Babel usage)
    2. Search for any existing Babel imports: grep -r "@babel/standalone" src/
  </read_first>
  <action>
    Create src/utils/lazyBabel.ts:

    - Export async function `transformCode(code: string, presets: string[]): Promise<string>`
    - Dynamic import: `await import('@babel/standalone')` (NOT at module level)
    - Cache the imported module in closure for subsequent calls
    - Implement error handling: if transform fails, return original code (graceful fallback per D-06)
    - Log transform errors to logger for debugging (don't throw)
    - Export TypeScript types for the transform function

    Per CONTEXT.md decision D-06: Babel transform failure shows raw code (preview is nice-to-have)
    Per CONTEXT.md decision D-04: Lazy load failures retry once with exponential backoff (1s delay)
  </action>
  <verify>
    <automated>npx tsc --noEmit src/utils/lazyBabel.ts 2>&1 | grep -v "Found 0 errors"</automated>
  </verify>
  <done>
    lazyBabel.ts exists with lazy import, caching, graceful fallback on error
    transformCode function exported with proper TypeScript types
  </done>
</task>

<task type="auto">
  <name>Task 3: Wire lazy loading into consumers and add prefetch hints</name>
  <files>
    src/components/SimulationPlayground.tsx
    src/components/docs/DocsMarkdownRenderer.tsx
    index.html
  </files>
  <read_first>
    1. Read src/components/SimulationPlayground.tsx lines 38-39, 1234-1250 (MonacoEditor usage)
    2. Read src/components/docs/DocsMarkdownRenderer.tsx (Babel usage location)
    3. Read index.html lines 1-22 (current preload hints, CSP)
  </read_first>
  <action>
    **src/components/SimulationPlayground.tsx**:
    - Replace `const MonacoEditor = lazy(() => import("@monaco-editor/react"))` with import of LazyMonacoEditor
    - Remove lines 38-39 (old lazy import)
    - Update MonacoEditor usage at line 1234+ to use LazyMonacoEditor component
    - Ensure all Monaco props (theme, language, value, onChange, etc.) pass through

    **src/components/docs/DocsMarkdownRenderer.tsx**:
    - Find where Babel transform is used (likely in code fence rendering)
    - Replace direct import with `import { transformCode } from '@/utils/lazyBabel'`
    - Update transform calls to use await (if needed) or keep existing pattern

    **index.html**:
    - Add DNS prefetch for jsDelivr CDN (Monaco source): `<link rel="dns-prefetch" href="https://cdn.jsdelivr.net">`
    - Add preload for react-vendor chunk: `<link rel="modulepreload" href="/assets/react-vendor-[hash].js">` (use wildcard or leave placeholder for build script to inject)
    - DO NOT add hover prefetch for Monaco (per D-07: measure actual impact first)

    Per CONTEXT.md decision D-07: No hover prefetching for Monaco — measure actual impact before adding bandwidth cost
    Per CONTEXT.md decision D-08: Preload react-vendor chunk only in index.html (high ROI, small size)
    Per CONTEXT.md decision D-09: Add DNS prefetch for jsDelivr CDN — zero-cost performance win
  </action>
  <verify>
    <automated>grep -c "LazyMonacoEditor" src/components/SimulationPlayground.tsx && grep -c "lazyBabel" src/components/docs/DocsMarkdownRenderer.tsx && grep -c "dns-prefetch.*cdn.jsdelivr.net" index.html</automated>
  </verify>
  <done>
    SimulationPlayground.tsx imports and uses LazyMonacoEditor
    DocsMarkdownRenderer.tsx uses lazyBabel transformCode
    index.html has DNS prefetch for jsDelivr CDN
    No hover prefetch for Monaco added
  </done>
</task>

<task type="auto">
  <name>Task 4: Verify Vite chunk isolation and measure bundle size impact</name>
  <files>
    vite.config.ts
  </files>
  <read_first>
    1. Read vite.config.ts lines 126-217 (current manualChunks configuration)
  </read_first>
  <action>
    Verify current Vite config already isolates Monaco and Babel into separate chunks:

    - Lines 154-157: Monaco chunk isolation exists (returns "monaco")
    - Lines 162-165: Babel chunk isolation exists (returns "babel")

    No changes needed to vite.config.ts — current configuration is correct.

    Run build and verify:
    - `npm run build`
    - Check dist/assets/ directory for chunk files
    - Verify monaco-[hash].js and babel-[hash].js exist as separate files
    - Verify initial bundle (index.html + main.js + react-vendor) < 3MB
    - Use rollup-plugin-visualizer output (stats.html) to confirm chunk isolation
  </action>
  <verify>
    <automated>npm run build 2>&1 | tail -20 && ls -lh dist/assets/monaco-*.js dist/assets/babel-*.js 2>/dev/null | head -5</automated>
  </verify>
  <done>
    Build completes without errors
    monaco-[hash].js and babel-[hash].js files exist in dist/assets/
    Initial bundle size < 3MB (verified via dist file sizes)
    Chunk isolation confirmed in stats.html
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→CDN | Monaco Editor loads from jsDelivr CDN |
| client→lazy code | Dynamic imports of Monaco/Babel chunks |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-01-01 | Spoofing | jsDelivr CDN | accept | Existing CSP restricts script-src to 'self' and cdn.jsdelivr.net. Version pinning (MONACO_VERSION = "0.52.2") in SimulationPlayground.tsx prevents supply chain attacks. |
| T-01-02 | Tampering | Dynamic imports | mitigate | Verify chunk integrity via Subresource Integrity (SRI) headers. Current limitation: Monaco worker files don't support SRI — documented in code comments. |
| T-01-03 | Denial of Service | Lazy load timeout | mitigate | 3-second timeout with exponential backoff retry prevents indefinite loading states. Error boundary catches worker failures. |
| T-01-04 | Information Disclosure | Error messages | mitigate | User-facing error messages are friendly ("Try refreshing") not technical. Actual errors logged to logger, not exposed to users. |
</threat_model>

<verification>
## Overall Phase Checks

1. **Bundle size verification**: Run `npm run build` and confirm initial bundle < 3MB
2. **Chunk isolation**: Verify Monaco and Babel are separate chunks in dist/assets/
3. **Network verification**: Load homepage, check Network tab — Monaco/Babel chunks should NOT load
4. **Editor functionality**: Navigate to /sim-runner, verify Monaco loads and functions correctly
5. **Loading UX**: Verify SimLoader-style spinner appears during Monaco load
6. **Error handling**: Test with network throttling — verify timeout message and retry logic work
7. **All tests pass**: `npm test` must pass without regressions
8. **TypeScript compiles**: `npx tsc --noEmit` must pass
</verification>

<success_criteria>
1. Initial bundle (index.html + main.js + react-vendor) < 3MB
2. Monaco chunk (monaco-[hash].js) only loads on /sim-runner or /dashboard/simulation-playground routes
3. Babel chunk (babel-[hash].js) only loads when simulation/doc preview is triggered
4. Loading state shows ARES-red spinner matching SimLoader pattern
5. Error states show friendly messages with retry option
6. All existing editor functionality preserved (no regression)
7. Build output shows proper chunk isolation in stats.html
</success_criteria>

<output>
After completion, create `.planning/phases/01-bundle-size-optimization/01-01-SUMMARY.md`
</output>
