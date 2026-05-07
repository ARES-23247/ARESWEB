# Phase 45: Bundle Size Optimization - Plan

**Status**: Ready
**Mode**: standard

## Goal
Reduce initial JavaScript bundle by 5-6MB by lazy-loading Monaco Editor (2.5MB) and Babel Standalone (3MB).

## Pre-existing Work
- Monaco Editor wrapper `@monaco-editor/react` uses CDN lazy-loading by default. `LazyMonacoEditor.tsx` further wraps it in a React `lazy()` suspense boundary.
- Babel Standalone is dynamically imported in `lazyBabel.ts`.

## Execution Steps

### 1. Verification of Lazy Loading
- Run `npm run build` to inspect the bundle sizes. Ensure that the initial chunk is less than 3MB.
- Validate that Monaco and Babel chunks are separate and only fetched on demand.

### 2. ARES-branded Loader
- Ensure the `SimLoader` is used correctly in the UI when Monaco is suspended.

## Validation
- `npm run build` passes and outputs acceptable chunk sizes.
- Route testing confirms the chunk lazy loads appropriately without breaking existing functionality.

