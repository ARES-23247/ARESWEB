# Build Stabilization: TypeScript Compilation Cleanup

**Date**: 2026-05-13
**Duration**: ~1.5 hours
**Milestone**: N/A (cross-cutting infrastructure stabilization)
**Commits**: 2 (`cd8f6ebc`, `a4bada91`)

---

## Context

After completing Milestone v8.1 (Google Workspace Integrations — Phases 73-78), the codebase had accumulated 113 TypeScript compilation errors across 24 files. These errors fell into three categories:

1. **TS2590 "Union type too complex"** — The Hono OpenAPI router chain (`group1`→`group4` + 2 `.openapi()` handlers) exceeded TypeScript's type inference ceiling
2. **Type mismatches** — Import typos (`KvNamespace` vs `KVNamespace`), schema field misalignment (`lastSyncedAt` vs `lastIndexedAt`), implicit `any` parameters
3. **Lint violations** — Missing query key dependencies, unsuppressed `any` casts

A previous session (Gemini) attempted to resolve these by restructuring the router into flat `apiRouter.route()` calls with `any` casting, but this caused the frontend `hc<AppType>` client to become `unknown`, cascading into 150+ downstream errors across all `src/api/*.ts` files.

---

## Issues Resolved

### 1. TS2590: Union Type Too Complex (3 Sites)

**Root Cause**: TypeScript cannot compute the cumulative intersection type when 4 route groups + 2 `.openapi()` handlers are chained in a single expression. This is a [known Hono framework limitation](https://github.com/honojs/hono/issues/1375) for projects with 40+ routes.

**Fix**: Applied `@ts-expect-error` directives at the 3 specific sites where TS2590 fires:
- `group1` declaration (line 213)
- `const routes` chain (line 276)
- `apiRouter.route("/", routes)` registration (line 343)

This suppresses the type computation error while **preserving full `AppType` inference** for the frontend `hc()` client. Runtime behavior is completely unaffected — only the type-level computation is skipped.

**Why not flatten?** The previous session's flat `r.route()` approach cast `apiRouter` to `any`, which caused `typeof apiRouter` (and therefore `AppType`) to lose all route schema information. The `hc<AppType>()` client then became `unknown`, breaking every API call in `src/api/*.ts`. Keeping the original group chain + `@ts-expect-error` preserves type safety end-to-end.

---

### 2. KvNamespace → KVNamespace (middleware/utils.ts)

**Root Cause**: `import type { KvNamespace }` — Cloudflare Workers types export `KVNamespace` (capital V). Three sites affected: import, `ONSHAPE_OAUTH_STATE` binding, `ONSHAPE_EXPORTS` binding.

**Fix**: Corrected to `KVNamespace` at import and both usage sites.

---

### 3. Schema Field Misalignment (ai/index.ts)

**Root Cause**: Code referenced `schema.settings.lastSyncedAt` but the schema declares `lastIndexedAt`.

**Fix**: Changed to `lastIndexedAt` to match the schema definition.

---

### 4. Implicit `any` on Catch Parameter (VideoPickerModal.tsx)

**Root Cause**: `.catch(err => {` — `err` has implicit `any` type under `noImplicitAny`.

**Fix**: `.catch((err: unknown) => {`

---

### 5. Exhaustive Deps in Query Key (src/api/files.ts)

**Root Cause**: `queryKey: ["files", params.search]` only included one field from `params`, but `params` was used in the query function. TanStack Query ESLint plugin flagged this.

**Fix**: `queryKey: ["files", params]` to include the full object.

---

### 6. Explicit `any` Lint Violation (src/api/google-photos.ts)

**Root Cause**: `(client["google-photos"] as any).upload.$post(...)` — necessary cast for FormData upload typing workaround.

**Fix**: Added `eslint-disable-next-line @typescript-eslint/no-explicit-any` with rationale comment.

---

## Strategy: Why @ts-expect-error Over Restructuring

| Approach | Type Safety | Build Stability | Complexity |
|----------|-------------|-----------------|------------|
| **Flat `r.route()` + `any` cast** | ❌ Loses AppType → client unknown | ✅ Builds | Low |
| **`MergedSchema` intersection** | ❌ Still too complex for TS | ❌ Same TS2590 | High |
| **`@ts-expect-error` on chain** | ✅ Full AppType preserved | ✅ Builds | Low |

The `@ts-expect-error` approach is the industry-standard solution for large Hono projects. It preserves the type inference chain for the frontend client while acknowledging TypeScript's known computational limits.

---

## Files Changed

| File | Change |
|------|--------|
| `functions/api/[[route]].ts` | 3× `@ts-expect-error` suppressions + `filesRouter` import/mount |
| `functions/api/middleware/utils.ts` | `KvNamespace` → `KVNamespace` (import + 2 usages) |
| `functions/api/routes/ai/index.ts` | `lastSyncedAt` → `lastIndexedAt` |
| `src/components/VideoPickerModal.tsx` | `(err)` → `(err: unknown)` |
| `src/api/files.ts` | queryKey exhaustive-deps fix |
| `src/api/google-photos.ts` | eslint-disable for necessary `any` cast |
| `functions/api/routes/docs/*` | Preserved handler type fixes from v8.1 |
| `functions/api/routes/files/*` | Preserved handler type fixes from v8.1 |
| `functions/api/routes/google-drive/*` | Preserved handler type fixes from v8.1 |
| `functions/api/routes/google-photos/*` | Preserved handler type fixes from v8.1 |
| `functions/api/routes/onshape/*` | Preserved handler type fixes from v8.1 |
| `functions/api/routes/videos/*` | Preserved handler type fixes from v8.1 |
| `functions/utils/*` | Preserved utility type fixes from v8.1 |

---

## Verification

| Check | Result |
|-------|--------|
| `tsc --noEmit` | ✅ Exit code 0 (0 errors) |
| `eslint` | ✅ 0 errors, 13 warnings |
| `NODE_OPTIONS` | `--max-old-space-size=8192` required for both tsc and eslint |

---

## Key Learnings

1. **Never cast the main router to `any` in Hono** — it destroys `AppType` and cascades `unknown` to every frontend API call. Use `@ts-expect-error` on the chain instead.

2. **TS2590 is a TypeScript limitation, not a code bug** — the route chain is structurally correct; TypeScript simply can't compute the cumulative union/intersection type for 40+ routes. `@ts-expect-error` is the sanctioned workaround.

3. **Always restore from commit before incremental fixes** — after multiple failed edit rounds corrupted `[[route]].ts`, a `git checkout HEAD -- <file>` + 3 targeted edits resolved everything cleanly.

4. **8GB heap is now a hard requirement** — both `tsc` and `eslint` exceed the default 4GB heap for this project's type complexity. This should be documented in the project's dev environment setup.

---

## Technical Debt

- The `NODE_OPTIONS="--max-old-space-size=8192"` requirement should be formalized in `package.json` scripts or `.env` to prevent CI/CD failures.
- Consider splitting `[[route]].ts` into separate files (one per domain group) to reduce single-file type complexity long-term.
- The `@ts-expect-error` suppressions should be reviewed if Hono or TypeScript releases a fix for TS2590 with large route chains.
