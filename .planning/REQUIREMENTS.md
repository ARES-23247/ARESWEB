# Requirements - v6.9 Type Safety Debt Elimination

## Handler Type Safety

- [ ] **WRAP-01**: Create a `typedHandler<R>()` generic utility that infers request body, params, and query types from a `createRoute()` schema definition
- [ ] **WRAP-02**: Apply `typedHandler` across all 50+ backend route files, removing `as any` casts from handler signatures
- [ ] **WRAP-03**: Remove all file-level `/* eslint-disable @typescript-eslint/no-explicit-any */` from converted backend route files

## Frontend Type Unification

- [ ] **FRONT-01**: Export `z.infer<>` types from shared route schemas for all API response shapes used by frontend components
- [ ] **FRONT-02**: Replace all inline `any` casts in frontend pages (JudgesHub, Events, About, Leaderboard, Academy, PrintPortfolio) with imported types
- [ ] **FRONT-03**: Remove all `eslint-disable @typescript-eslint/no-explicit-any` from frontend component files

## Database Type Safety

- [ ] **DB-01**: Create typed Kysely query helper functions that properly handle D1's untyped result sets
- [ ] **DB-02**: Replace all 17 `@ts-expect-error` directives with calls to typed helpers

## React Hooks Compliance

- [ ] **HOOKS-01**: Refactor all `react-hooks/exhaustive-deps` suppressions to use stable dependency patterns (refs, useCallback, extracted functions)
- [ ] **HOOKS-02**: Refactor all `react-hooks/set-state-in-effect` suppressions to use proper effect patterns

## Final Validation

- [ ] **SWEEP-01**: Zero `as any` casts in non-test production code
- [ ] **SWEEP-02**: Zero file-level `eslint-disable` directives in non-test production code
- [ ] **SWEEP-03**: Promote `@typescript-eslint/no-explicit-any` from `warn` to `error` in ESLint config
- [ ] **VAL-01**: All 926+ existing tests pass
- [ ] **VAL-02**: `tsc --noEmit` passes with zero errors
- [ ] **VAL-03**: `eslint --max-warnings 0` passes with zero warnings

## Traceability

| Requirement | Phase |
|-------------|-------|
| WRAP-01 | 38 |
| WRAP-02 | 38 |
| WRAP-03 | 38 |
| FRONT-01 | 39 |
| FRONT-02 | 39 |
| FRONT-03 | 39 |
| DB-01 | 40 |
| DB-02 | 40 |
| HOOKS-01 | 41 |
| HOOKS-02 | 41 |
| SWEEP-01 | 42 |
| SWEEP-02 | 42 |
| SWEEP-03 | 42 |
| VAL-01 | 38-42 |
| VAL-02 | 38-42 |
| VAL-03 | 42 |

## Out of Scope

- Test files: `*.test.ts` / `*.test.tsx` may retain `any` casts for mock flexibility
- `node_modules/` and `tools/` directories
- New features or API changes
- Schema restructuring beyond type re-exports
