# Phase 64 Audit Report: ESLint Debt Baseline

## Summary
- **Total Problems**: 348
- **Major Rules**:
  - `@typescript-eslint/no-explicit-any`: 257 (74%)
  - `@typescript-eslint/no-unused-vars`: 84 (24%)
- **Distribution**:
  - `src/` (Frontend): 291
  - `functions/api/` (Backend): 18
  - `tests/` (E2E & Unit): 21

## Breakdown by Area

### Backend (`functions/api/`) - 18 problems
- Primarily `no-explicit-any` in legacy handlers (Posts, Media).
- A few `no-unused-vars` in test files.

### Frontend (`src/`) - 291 problems
- **Major Tech Debt**: Significant usage of `any` in component props and state management.
- **Unused Code**: 81+ instances of unused variables in components.
- **Specific Errors**: `react/require-render-return` (2 instances).

### Tests (`tests/`) - 21 problems
- Primarily `no-unused-vars` in Playwright E2E specs (MOCK_ADMIN_USER, etc).

## Action Plan Refinement
- **Phase 65 (Backend)**: Target the 18 problems. High priority as this is the core API.
- **Phase 66 (Frontend)**: Target the 291 problems. This will be the bulk of the work. We should split this into batches (Components, Hooks, Pages).
- **Phase 67 (Tests)**: Target the 21 problems. Mostly renaming to `_variable`.

## Completed in Phase 64
- [x] Generated detailed JSON audit.
- [x] Fixed syntax error in `tests/e2e/social-hub.spec.ts`.
- [x] Applied `eslint --fix` (resolved 15 low-hanging problems).
