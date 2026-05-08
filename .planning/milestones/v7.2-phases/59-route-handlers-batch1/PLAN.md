# Phase 59: Route Handler Type Safety — Batch 1 (Core)

**Status**: ✅ COMPLETED

**Goal**: Eliminate `any` casts in core route handlers through systematic error handling refactoring.

## Plans

### 59-01: Remove handler-level try/catch
- [x] Remove try/catch from route handlers
- [x] Errors bubble to global onError
- [x] TSC errors: 241 → 170

### 59-02: Replace inline error returns with throw ApiError
- [x] Convert error returns to throw statements
- [x] Restore type inference through control flow
- [x] TSC errors: 170 → 121

### 59-03: Convert multi-line error returns
- [x] Replace complex error return patterns
- [x] Fix import paths for ApiError
- [x] TSC errors: 121 → 84

### 59-04: Fix outreach/store/settings/analyze handlers
- [x] Type safety improvements for outreach routes
- [x] Store route handler fixes
- [x] Settings and analyze route fixes
- [x] Add error-handling skill documentation
- [x] TSC errors: 84 → 78

### 59-05: Fix events/inquiries/outreach handlers
- [x] Events route type fixes
- [x] Inquiries route type fixes
- [x] Outreach route type fixes
- [x] TSC errors: 78 → 71

## Outcomes

- Error handling standardized to `throw ApiError`
- Type inference restored through throw-only pattern
- 71 TSC errors remaining (from 241)

## Commits

- `6b9319ef` refactor: remove handler-level try/catch, errors bubble to global onError - reduces TSC errors from 241 to 170
- `c251bb5f` refactor: replace inline error returns with throw ApiError for type-safe handlers - reduces TSC errors from 170 to 121
- `9c1198bd` refactor: convert remaining multi-line error returns to throw ApiError, fix import paths - reduces TSC errors from 121 to 84
- `d8e4ee35` refactor: fix outreach/store/settings/analyze handlers + add error-handling skill - TSC errors 84 to 78
- `758b86d0` refactor: fix events/inquiries/outreach handlers - TSC errors 78 to 71
