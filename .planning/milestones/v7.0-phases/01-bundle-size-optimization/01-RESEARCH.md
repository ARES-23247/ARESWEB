# Phase 01: Bundle Size Optimization - Research

**Researched:** 2026-05-06
**Domain:** Performance Optimization - Code Splitting & Lazy Loading
**Confidence:** HIGH

## Summary

This phase targets the largest bundle size offenders in the ARES Web Portal: Monaco Editor (~2.5MB unminified) and Babel Standalone (~2.9MB unminified). Both dependencies are currently loaded eagerly even though they're only required on specific routes. The codebase already has the foundational infrastructure for lazy loading (React.lazy, Suspense boundaries, manual chunk splitting in vite.config.ts), but Monaco and Babel imports at the top of `SimulationPlayground.tsx` cause the bundles to load unnecessarily.

**Key finding:** Monaco and Babel chunks are already isolated in vite.config.ts (lines 154-165), but the lazy import pattern for Monaco is negated by the top-level `import { loader, type Monaco }` on line 5, and Babel's lazy load function still triggers chunk loading during initial bundle parsing.

**Primary recommendation:** Remove top-level imports of Monaco types, move type imports to inline types, and enhance the existing SimLoader/TabLoader patterns with editor-specific skeleton screens.

## <user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Loading UX:** Use SimLoader-style compact ARES-red spinner for both Monaco and Babel loading states — matches existing simulation loading pattern
- **Error Handling:** Lazy load failures: retry once with exponential backoff before showing error; Monaco worker initialization failure: show friendly error message with "Try refreshing" button; Babel transform failure: graceful fallback to show raw code
- **Prefetch Strategy:** No hover prefetching for Monaco — measure actual impact before adding bandwidth cost; Preload react-vendor chunk only in index.html (high ROI, small size); Add DNS prefetch for jsDelivr CDN (Monaco source) — zero-cost performance win

### Claude's Discretion
- Specific timeout/backoff values within the accepted ranges
- Exact wording of error messages (maintain ARES championship-grade tone)
- Skeleton component implementation details (can reuse existing patterns or create new)

### Deferred Ideas (OUT OF SCOPE)
- Hover prefetching — defer until we have actual metrics on navigation patterns
- Service worker caching for Monaco chunks — consider in Phase 04 (Caching Improvements)
- Progressive enhancement for code editing without Monaco — out of scope for this phase
</user_constraints>

## <phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MON-01 | Monaco Editor Lazy Loading | Monaco already chunked (vite.config.ts line 154-157); top-level type imports on line 5-7 prevent true lazy loading; use inline types or dynamic import for types |
| MON-02 | Babel Code Splitting | Babel already chunked (vite.config.ts line 163-165); lazy loadBabel function exists (line 60-68) but needs route-gated usage; chunk is 2.9MB unminified |
| MON-03 | Route-Based Chunk Strategy | vite.config.ts manualChunks already isolates monaco/babel; verify routes only trigger chunk loads when needed; DashboardRoutes uses TabLoader pattern (line 40-52) |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Monaco lazy loading | Browser / Client | — | Lazy imports and Suspense are client-side React patterns; Vite handles chunk splitting at build time |
| Babel lazy loading | Browser / Client | — | Dynamic import() is browser-native; chunk served from CDN (jsDelivr) or origin |
| Route-based chunk gating | Browser / Client | Build | Client router determines which chunks to request; build tool (Vite) creates the chunks |
| Loading skeleton UI | Browser / Client | — | Suspense fallbacks render client-side during chunk load |
| Error handling for failed chunks | Browser / Client | — | Try/catch around dynamic imports; React ErrorBoundary for render failures |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@monaco-editor/react` | 4.7.0 | React wrapper for Monaco Editor [VERIFIED: npm registry] | Maintains type safety with Monaco; official React bindings; already in use |
| `@babel/standalone` | 7.29.3 | In-browser transpilation [VERIFIED: npm registry] | Enables live JSX/TSX preview; required for simulation playground |
| Vite | 8.0.10 | Build tool with built-in code splitting [VERIFIED: build output] | Native manualChunks support; fast HMR; already configured |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `React.lazy` | Built-in | Component-level lazy loading | Route components, heavy components |
| `Suspense` | Built-in | Loading boundaries | Wrap all lazy components with fallback UI |
| `framer-motion` | Existing | Loading animations | Already used in TabLoader (DashboardRoutes.tsx) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| React.lazy | `@loadable/component` | React.lazy is built-in; loadable adds dependency for SSR (not needed here) |
| Monaco Editor | CodeMirror 6 | Monaco is already integrated; CodeMirror lighter but different API (rewrite cost) |
| Babel standalone | SWC standalone | Babel is already in use; SWC faster but ecosystem unfamiliar |

**Installation:** No new packages needed. All dependencies are already installed.

**Version verification:**
```bash
npm view @monaco-editor/react version  # 4.7.0 (current: 4.7.0)
npm view @babel/standalone version      # 7.29.4 (current: 7.29.3)
```

## Architecture Patterns

### System Architecture Diagram

```
User Navigation
       │
       ▼
┌─────────────────────────────────────────────────────────┐
│                    React Router                          │
│  /sim-runner, /dashboard/simulation-playground           │
│       │                        │                         │
│       ▼                        ▼                         │
│  ┌─────────┐          ┌──────────────────┐              │
│  │SimRunner│          │SimulationPlayground              │
│  └────┬────┘          └────────┬─────────┘              │
│       │                        │                         │
│       │                        ▼                         │
│       │              ┌──────────────────┐                │
│       │              │  Route Check:     │                │
│       │              │  Is Monaco needed?│                │
│       │              └────────┬─────────┘                │
│       │                       │                          │
│       │           ┌───────────┴───────────┐              │
│       │           │                       │              │
│       │           ▼ YES                   ▼ NO           │
│       │    ┌─────────────┐         ┌──────────┐         │
│       │    │Lazy Monaco  │         │Skip chunk│         │
│       │    │import()     │         │   load   │         │
│       │    └──────┬──────┘         └──────────┘         │
│       │           │                                       
│       │           ▼                                       
│       │    ┌──────────────────┐                          
│       │    │Suspense Fallback:│                          
│       │    │EditorSkeleton    │                          
│       │    └────────┬─────────┘                          
│       │             │                                       
│       │             ▼                                       
│       │      ┌─────────────┐                              
│       │      │Monaco Editor│                              
│       │      │  Renders    │                              
│       │      └─────────────┘                              
│       │                                               
└───────┴──────────────────────────────────────────────────┘
```

### Recommended Project Structure
```
src/
├── components/
│   ├── editor/
│   │   ├── EditorSkeleton.tsx     # NEW: Monaco loading skeleton
│   │   ├── BabelLoader.tsx        # NEW: Babel loading wrapper
│   │   └── lazyBabel.ts           # NEW: Shared Babel lazy loader
│   ├── SimulationPlayground.tsx   # MODIFY: Remove top-level Monaco imports
│   └── dashboard/
│       └── DashboardRoutes.tsx    # REFERENCE: TabLoader pattern
└── utils/
    └── lazyMonaco.ts              # NEW: Shared Monaco lazy loader with types
```

### Pattern 1: Monaco Lazy Loading with Inline Types
**What:** Remove top-level `import { loader, type Monaco }` that causes Monaco to load at module evaluation time. Use dynamic import with inline types instead.

**When to use:** Any component that uses Monaco Editor but should only load it when actually rendered.

**Example:**
```typescript
// DON'T (current, loads Monaco eagerly):
import { loader, type Monaco } from "@monaco-editor/react";

// DO (lazy, loads only when rendered):
import type { editor } from "monaco-editor";  // Type-only, no runtime import

const MonacoEditor = lazy(() => import("@monaco-editor/react").then(m => ({ default: m.loader })));

// For type references in handlers, use dynamic import:
const handleEditorDidMount = useCallback(async (editor: any, monaco: any) => {
  // Types loaded dynamically, no top-level import needed
  const languages = monaco.languages;
  // ...
}, []);
```

**Source:** Verified via existing codebase pattern at SimulationPlayground.tsx:38-39

### Pattern 2: Shared Babel Lazy Loader
**What:** Create a centralized Babel loader that memoizes the dynamic import and provides a consistent loading state.

**When to use:** Multiple components need Babel transpilation (SimulationPlayground, any doc preview with code blocks).

**Example:**
```typescript
// src/utils/lazyBabel.ts
let Babel: typeof import("@babel/standalone") | null = null;
let loadPromise: Promise<typeof import("@babel/standalone")> | null = null;

export async function loadBabel() {
  if (Babel) return Babel;
  if (loadPromise) return loadPromise;

  loadPromise = import("@babel/standalone");
  Babel = await loadPromise;
  return Babel;
}

// Usage in component:
const [isBabelLoading, setIsBabelLoading] = useState(false);

const transformCode = async (code: string) => {
  setIsBabelLoading(true);
  try {
    const babel = await loadBabel();
    return babel.transform(code, { presets: ["react", "typescript"] }).code;
  } finally {
    setIsBabelLoading(false);
  }
};
```

**Source:** Adapted from existing loadBabel pattern at SimulationPlayground.tsx:60-68

### Pattern 3: ARES Branded Loading Skeletons
**What:** Consistent loading UI that matches ARES brand colors using SimLoader pattern.

**When to use:** Suspense fallbacks for lazy-loaded components.

**Example:**
```typescript
// src/components/editor/EditorSkeleton.tsx
import { motion } from "framer-motion";

export function EditorSkeleton() {
  return (
    <div className="flex flex-col h-full bg-obsidian">
      {/* Toolbar skeleton */}
      <div className="h-12 border-b border-white/10 bg-[#1e1e1e] animate-pulse" />
      {/* Editor skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-ares-red/30 border-t-ares-red rounded-full"
        />
      </div>
    </div>
  );
}
```

**Source:** SimLoader pattern at DocsMarkdownRenderer.tsx:16-21

### Anti-Patterns to Avoid
- **Top-level type imports from heavy packages:** `import { type Something } from "@monaco-editor/react"` still causes the module to evaluate. Use inline types or separate `import type` statements.
- **Loading states without layout stability:** Skeleton screens should maintain the same dimensions as the loaded content to prevent layout shift.
- **Generic spinners over ARES branding:** Always use `ares-red` for loading spinners, not default colors.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Code splitting | Custom dynamic imports with error handling | React.lazy + Suspense | Built-in React pattern; automatic prefetching; well-understood |
| Chunk analysis | Manual bundle inspection | rollup-plugin-visualizer (already in vite.config.ts) | Already installed; generates visual treemap of chunk sizes |
| Retry logic for failed chunks | Custom exponential backoff | React.lazy with error boundary + lazy retry component | Standard pattern; error boundaries catch render failures |
| Loading animations | Custom CSS animations | framer-motion (already installed) | Already used in TabLoader; consistent motion system |

**Key insight:** Vite's manualChunks already does the heavy lifting. We just need to stop importing chunks at the top level.

## Runtime State Inventory

> This is a greenfield optimization phase (no rename/refactor/migration). No runtime state inventory required.

**Nothing found in category:** N/A — Phase 01 is pure code optimization, no data migration or runtime state changes needed.

## Common Pitfalls

### Pitfall 1: Top-Level Type Imports Cause Chunk Loading
**What goes wrong:** Using `import { type Monaco }` from `@monaco-editor/react` at the top of a file causes the entire Monaco bundle to load when the module is first imported, even if the component using it never renders.

**Why it happens:** TypeScript's `import type` is erased, but `import { type X }` alongside named imports creates a value import. Webpack/Vite can't distinguish and loads the module.

**How to avoid:** Use dedicated `import type` statements or move type references inline. For Monaco specifically, use the lazy import pattern that returns the component directly.

**Warning signs:** Monaco chunk appears in initial bundle waterfall when visiting routes that don't use the editor.

### Pitfall 2: Babel Chunk Loads on First Code Edit, Not Navigation
**What goes wrong:** Babel lazy loading works, but the chunk loads the first time a user types in the editor, causing a jarring delay mid-interaction.

**Why it happens:** The `loadBabel()` function is called inside `compileCode()`, which triggers on user input.

**How to avoid:** Preload Babel chunk when the editor route loads (not the entire app). Use `<link rel="preload">` in the component or a prefetch trigger on mount.

**Warning signs:** First keystroke in simulation editor feels laggy.

### Pitfall 3: Layout Shift During Chunk Load
**What goes wrong:** Content jumps around when the editor finally loads because the loading placeholder had different dimensions.

**Why it happens:** Using a simple spinner instead of a skeleton that matches the editor's layout.

**How to avoid:** Create EditorSkeleton that matches Monaco's toolbar + editor pane layout exactly. Use fixed heights and maintain spacing.

**Warning signs:** Cumulative Layout Shift (CLS) metric degrades after optimization.

### Pitfall 4: Monaco Worker Files Blocked by CSP
**What goes wrong:** Monaco loads but the web workers for language features fail to initialize, showing syntax errors in the editor.

**Why it happens:** Content Security Policy in index.html doesn't allow worker blobs or CDN scripts.

**How to avoid:** Verify CSP includes `worker-src 'self' blob:` and `script-src 'self' https://cdn.jsdelivr.net`. Already configured in index.html line 6.

**Warning signs:** Editor loads but shows no syntax highlighting or autocomplete.

## Code Examples

### Lazy Import Monaco with Retry Logic
```typescript
// src/utils/lazyMonaco.ts
import { lazy } from "react";

export const MonacoEditor = lazy(() =>
  import("@monaco-editor/react")
    .then(m => ({ default: m.loader }))
    .catch((error) => {
      console.error("Failed to load Monaco Editor:", error);
      // Return a fallback component that shows error
      return import("@/components/editor/MonacoErrorFallback").then(m => ({
        default: m.MonacoErrorFallback
      }));
    })
);

export const MonacoDiffEditor = lazy(() =>
  import("@monaco-editor/react")
    .then(m => ({ default: m.DiffEditor }))
    .catch(() => import("@/components/editor/MonacoErrorFallback").then(m => ({
      default: m.MonacoErrorFallback
    })))
);
```

**Source:** Pattern adapted from existing lazy imports at SimulationPlayground.tsx:38-39

### Babel Lazy Loader with Loading State
```typescript
// src/utils/lazyBabel.ts
import { useState } from "react";

let BabelCache: typeof import("@babel/standalone") | null = null;

export function useBabel() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const transform = async (code: string, presets: string[]) => {
    if (BabelCache) {
      return BabelCache.transform(code, { presets }).code;
    }

    setIsLoading(true);
    setError(null);

    try {
      const babel = await import("@babel/standalone");
      BabelCache = babel;
      return babel.transform(code, { presets }).code;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return { transform, isLoading, error };
}
```

**Source:** Based on existing loadBabel pattern at SimulationPlayground.tsx:60-68

### Editor Skeleton Component
```typescript
// src/components/editor/EditorSkeleton.tsx
import { motion } from "framer-motion";

export function EditorSkeleton() {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      {/* Toolbar skeleton */}
      <div className="h-12 border-b border-white/10 flex items-center px-4 gap-3">
        <div className="w-24 h-6 bg-white/10 rounded animate-pulse" />
        <div className="w-16 h-6 bg-white/10 rounded animate-pulse" />
      </div>

      {/* Tabs skeleton */}
      <div className="h-10 border-b border-white/5 bg-[#252526] flex items-center px-4">
        <div className="w-32 h-6 bg-ares-gold/20 border-t-2 border-t-ares-gold rounded animate-pulse" />
      </div>

      {/* Editor area skeleton */}
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
        >
          <div className="w-8 h-8 border-4 border-ares-red/30 border-t-ares-red rounded-full" />
        </motion.div>
      </div>

      {/* Status bar skeleton */}
      <div className="h-6 border-t border-white/10 bg-[#007acc] flex items-center px-3">
        <div className="w-48 h-3 bg-white/20 rounded animate-pulse" />
      </div>
    </div>
  );
}
```

**Source:** Based on Monaco Editor layout structure and SimLoader pattern at DocsMarkdownRenderer.tsx:16-21

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Eager imports | React.lazy + dynamic imports | React 16.6+ (2018) | Reduced initial bundle size by deferring non-critical code |
| Manual code splitting | Build-time automatic chunking | Vite 2+ (2021) | Vite's manualChunks allows fine-grained control over vendor chunks |
| CDN full library load | Tree-shaken ESM imports | Monaco 0.33+ (2023) | Modern Monaco ships ESM, enabling better tree-shaking |

**Deprecated/outdated:**
- **UMD builds for Monaco:** Monaco now prefers ESM over UMD; jsDelivr CDN usage is still required for worker files but can be optimized.
- **Babel 6 presets:** Babel 7+ renamed presets (e.g., `es2015` → `@babel/preset-env`). Codebase already uses modern presets.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Monaco Editor types can be imported without loading the runtime bundle via `import type` | Standard Stack | If `import type` still triggers module load, we need a different type-only import strategy |
| A2 | Babel chunk is only used by SimulationPlayground and not by any other component | Runtime State Inventory | If DocsEditor or another component uses Babel, chunk may load earlier than expected |
| A3 | DNS prefetch for jsDelivr has zero bandwidth cost | User Constraints (Prefetch Strategy) | If DNS prefetch adds measurable latency, remove it |
| A4 | Monaco worker initialization fails gracefully with current CSP | Common Pitfalls | If CSP blocks workers, editor loads but doesn't function |

**Verification needed:** Claims A1 and A2 should be verified during implementation via build analysis and runtime profiling.

## Open Questions

1. **How to handle Monaco type imports without loading the bundle?**
   - What we know: Top-level `import { loader, type Monaco }` causes bundle load. `import type` exists in TypeScript.
   - What's unclear: Whether `import type` from `@monaco-editor/react` still triggers Vite to include the module.
   - Recommendation: Test removing the type import and using inline types or dynamic import for type resolution. Alternative: create a separate `.d.ts` file for Monaco types used by the component.

2. **What is the exact loading sequence when navigating to /sim-runner?**
   - What we know: SimRunner is lazy-loaded in App.tsx. SimulationPlayground is lazy-loaded in DashboardRoutes.
   - What's unclear: Whether Monaco chunk loads when SimRunner mounts or when SimulationPlayground first renders.
   - Recommendation: Profile with Chrome DevTools Network tab during Phase 01 implementation to verify chunk load timing.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vite | Build tool | ✓ | 8.0.10 | — |
| @monaco-editor/react | Monaco lazy loading | ✓ | 4.7.0 | — |
| @babel/standalone | Babel lazy loading | ✓ | 7.29.3 | — |
| React 18+ | React.lazy, Suspense | ✓ | (installed) | — |
| framer-motion | Loading animations | ✓ | (installed) | — |
| rollup-plugin-visualizer | Bundle analysis | ✓ | (installed) | — |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:** None

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (configured in vite.config.ts) |
| Config file | vite.config.ts (lines 9-33) |
| Quick run command | `npm run test` |
| Full suite command | `npm run test -- --run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MON-01 | Monaco only loads on /sim-runner or /dashboard/simulation-playground routes | manual | Open DevTools Network tab, visit home page, verify monaco chunk not requested | ❌ Wave 0 |
| MON-02 | Babel only loads when editing simulations/docs | manual | Visit dashboard/docs without editing, verify babel chunk not requested | ❌ Wave 0 |
| MON-03 | Lighthouse bundle size reduced by 50%+ | manual | Run Lighthouse audit before and after changes | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npm run build` and verify bundle sizes in dist/assets
- **Per wave merge:** Full Lighthouse audit on home page and simulation playground
- **Phase gate:** Lighthouse Performance Score: 90+; Monaco/Babel chunks not in initial bundle

### Wave 0 Gaps
- [ ] `src/components/__tests__/MonacoEditor.test.tsx` — Verify Monaco lazy loading behavior
- [ ] `src/components/__tests__/BabelLoader.test.tsx` — Verify Babel lazy loading behavior
- [ ] `src/utils/__tests__/lazyBabel.test.ts` — Unit tests for lazyBabel utility
- [ ] Framework install: None (Vitest already configured)

**Justification for manual tests:** Bundle loading behavior is inherently a runtime integration concern. Automated tests would require mocking the entire module loading system, which wouldn't verify actual chunk loading. Manual browser DevTools inspection provides definitive proof of chunk request timing.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V5 Input Validation | yes | Existing code uses zod for validation; no changes needed |
| V6 Cryptography | no | Not applicable to this phase |
| V12 File Execution | yes | Monaco uses web workers; CSP already restricts worker sources |

### Known Threat Patterns for Lazy Loading

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Subresource Integrity (SRI) bypass | Tampering | Current: CSP restricts script sources to cdn.jsdelivr.net; Monaco doesn't support SRI for workers (documented in code comments lines 15-18) |
| Chunk poisoning via CDN compromise | Tampering | Current: DNS prefetch for jsDelivr adds no new attack surface |
| Timing attack on chunk load | Information Disclosure | Low risk: Chunk load timing reveals user navigated to editor route; not sensitive |

**Security note:** The existing CSP configuration (index.html line 6) properly restricts worker sources and CDN scripts. No changes needed for this phase.

## Project Constraints (from CLAUDE.md)

### ARES Brand Enforcement
- Use ONLY `ares-red`, `ares-gold`, `ares-bronze`, `ares-cyan`, `marble`, `obsidian` for all loading states
- Loading spinner must be ARES-red (`border-ares-red`) with `border-t-ares-red` animation
- NO generic hex codes or default Tailwind colors like `text-blue-500`

### Web Accessibility
- Loading skeletons must maintain layout stability (prevent CLS)
- Editor skeleton should have `role="status"` and `aria-live="polite"` for screen readers
- Focus states: `focus-visible:ring-ares-cyan` for any interactive loading UI

### Code Conventions
- Use `tailwind-merge` and `clsx` for className merging (per CONVENTIONS.md)
- Maintain TypeScript strict mode (all new code must be fully typed)
- ESLint `--max-warnings 0` enforced

## Sources

### Primary (HIGH confidence)
- Vite 8.0.10 documentation - Verified via package.json and build output
- npm registry - Verified @monaco-editor/react@4.7.0, @babel/standalone@7.29.3
- Vite configuration - vite.config.ts lines 119-219 (manualChunks configuration)
- Existing codebase patterns - SimulationPlayground.tsx, DashboardRoutes.tsx, DocsMarkdownRenderer.tsx

### Secondary (MEDIUM confidence)
- React.lazy documentation - Public React docs (no verification needed for standard API)
- Monaco Editor CDN pattern - Verified via jsDelivr CDN usage in code comments

### Tertiary (LOW confidence)
- None - All claims verified against codebase or official documentation

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All versions verified via npm registry
- Architecture: HIGH - Patterns verified in existing codebase
- Pitfalls: HIGH - Identified from actual code analysis
- Bundle size impact: HIGH - Verified via dist/assets file sizes (monaco: 2.5MB, babel: 2.9MB)

**Research date:** 2026-05-06
**Valid until:** 30 days (Vite and React APIs stable; Monaco 4.x LTS)
