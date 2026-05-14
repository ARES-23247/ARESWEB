# Phase 40: TBA → ftc-events Migration - Context

## Problem Statement
The Blue Alliance (TBA) API was being used for FTC event data, but the ftc-events package provides a more maintained, schema-typed alternative.

## Technical Context
- **Old**: `functions/api/routes/tba.ts` (88 lines) + `shared/routes/tba.ts` (128 lines)
- **New**: `functions/api/routes/ftc.ts` (69 lines) + `shared/routes/ftc.ts` (52 lines)
- **Package**: `@ftc-events` npm package with TypeScript schemas

## Implementation Approach
1. Replace TBA API routes with ftc-events routes
2. Update event sync handlers to use new schema
3. Migrate all tests from TBA to ftc-events
4. Remove deprecated TBA dependencies

## Completion Status
**SHIPPED** - All commits completed 2026-05-10 through 2026-05-13

Key commits:
- `dd51d50f` chore: finalize backend architecture migration and API stabilization
- `7491a9d3` fix: resolve TS2339 in tba.ts by updating to ftc-events api schema
- `0395f9a8` test: resolve MSW warnings and fix tba api tests for ftc-events
