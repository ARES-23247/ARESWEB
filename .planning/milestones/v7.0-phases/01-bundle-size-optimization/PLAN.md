---
gsd_plan_version: 1.0
phase: 01
phase_name: Bundle Size Optimization
milestone: v7.0
status: planned
parent_plan: null
---

# Phase 01: Bundle Size Optimization

## Goal

Reduce initial JavaScript bundle by 5-6MB by lazy-loading Monaco Editor and splitting Babel/Editor code.

## Context

Current bundle analysis shows:
- **Monaco Editor**: 2.5MB (only needed on 2 routes)
- **Babel Standalone**: 3MB (only needed for sim/doc editing)
- **Tiptap Editor**: 1.5MB (needed for blog/event/doc editing)

These are being loaded eagerly even though most users never need them.

## Requirements

### MON-01: Monaco Editor Lazy Loading
- Monaco should only load when navigating to `/sim-runner` or `/dashboard/simulation-playground`
- Users visiting Home, About, Blog, etc. should not download Monaco
- Editor experience should be unchanged (lazy load completes before interaction)

### MON-02: Babel Code Splitting
- Create shared lazy-loaded Babel wrapper
- Only load Babel when simulation preview or doc preview is needed
- Reduce initial bundle by 3MB for non-editing users

### MON-03: Route-Based Chunk Strategy
- Split dashboard components into separate chunks
- Split simulation code into dedicated chunk
- Verify chunk isolation in build output

## Tasks

### Plan 01-01: Monaco Editor Lazy Loading

**Files to modify**:
- `src/components/SimulationPlayground.tsx`
- `src/components/editor/SimCodeEditor.tsx` (if exists)
- `src/components/SimManager.tsx`

**Implementation**:
```typescript
// Create lazy Monaco loader component
// src/components/editor/LazyMonacoEditor.tsx
import { lazy, Suspense } from 'react';
import { loader } from '@monaco-editor/react';

const MonacoLoader = loader;

export function LazyMonacoEditor(props: any) {
  return (
    <Suspense fallback={<EditorSkeleton />}>
      <MonacoLoader {...props} />
    </Suspense>
  );
}
```

**Testing**:
1. Load homepage - verify Monaco not in network tab
2. Navigate to `/sim-runner` - verify Monaco loads
3. Verify editor still functions correctly

---

### Plan 01-02: Babel and Editor Code Splitting

**Files to modify**:
- `src/utils/lazyBabel.ts` (new file)
- `src/components/SimulationPlayground.tsx`
- `src/components/DocsEditor.tsx`
- `vite.config.ts`

**Implementation**:
```typescript
// src/utils/lazyBabel.ts
import { lazy } from 'react';

export const BabelTransform = lazy(() =>
  import('@babel/standalone').then(babel => ({
    default: (code: string, presets: string[]) => {
      return babel.default.transform(code, { presets }).code;
    }
  }))
);

// Usage in components
const { transformCode } = await BabelTransform;
```

**Update vite.config.ts**:
```typescript
manualChunks(id) {
  // Existing chunks...

  // Babel standalone (only for transpilation)
  if (normalizedId.includes("node_modules/@babel/")) {
    return "babel";
  }

  // Simulation-specific code
  if (normalizedId.includes("src/sims/")) {
    return "sims";
  }
}
```

---

## Success Criteria

1. Initial bundle (index.html + main.js) < 3MB
2. Monaco chunk only loads on editor routes
3. Lighthouse "Reduce JavaScript execution time" improved
4. All existing functionality preserved

## Definition of Done

- [ ] Monaco lazy loading implemented
- [ ] Babel lazy loading implemented
- [ ] Vite config updated with new chunk strategy
- [ ] Build output verified - chunks properly isolated
- [ ] All tests pass
- [ ] Manual testing of editor routes successful
- [ ] Lighthouse score recorded (baseline)

## Estimated Effort

- Plan 01-01: 2 hours
- Plan 01-02: 3 hours
- Testing and validation: 1 hour
- **Total: 6 hours**
