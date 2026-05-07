# Kysely→Drizzle Migration Cleanup

**Date:** 2026-05-07
**Branch:** master (multiple commits)

## Summary

Completed the final cleanup of the Kysely→Drizzle migration, removing all deprecated Kysely type utilities and updating test factories to use Drizzle's type inference system. Resolved all TypeScript and ESLint errors, bringing the codebase to 0 errors, 0 warnings.

## What Changed

### Removed Files (Deleted)
- `shared/schemas/database.ts` - Kysely DB schema (846 lines)
- `shared/types/database.ts` - Kysely type utilities (D1Row, SelectableRow, InsertableRow, UpdateableRow)
- `functions/api/middleware/dbUtils.ts` - Unused middleware

### Type System Migration

**Before (Kysely):**
```typescript
import type { D1Row, SelectableRow } from "~/types/database";
type EventRow = D1Row<events>;
type PartialEvent = SelectableRow<EventSchema>;
```

**After (Drizzle):**
```typescript
import { schema } from "drizzle-schema";
type EventRow = typeof schema.events.$inferSelect;
```

### Test Factories Updated

All factory functions in `src/test/factories/` were updated:
- `userFactory.ts` - Profile, Badge, Comment types (camelCase: userId, firstName, etc.)
- `eventFactory.ts` - Event, Location types (removed obsolete columns)
- `contentFactory.ts` - Post, Doc types (added authorAvatar)
- `logisticsFactory.ts` - Outreach, Sponsor, Award, Inquiry types
- `systemFactory.ts` - Notification types

### React 19 Fixes

Fixed `react-hooks/set-state-in-effect` errors by wrapping setState calls in `startTransition()`:
- `src/components/EventSignups.tsx`
- `src/components/TeamAvailability.tsx`

## Test Results

| Metric | Result |
|--------|--------|
| Unit tests | 904/904 ✅ |
| Skipped | 17 |
| Failed | 0 |
| ESLint errors | 0 |
| ESLint warnings | 0 |

## Commits

1. `691da5aa` - refactor: complete Kysely→Drizzle migration cleanup
2. `0984e805` - refactor: complete final migrations from legacy fetchJson to typed API hooks
3. `ceda3fdd` - test: fix analytics test for Headers object from honoClient
4. `228bd6a6` - fix(typescript): resolve remaining TS errors across API and admin components

## Benefits

1. **Type safety** - Drizzle's `typeof schema.table.$inferSelect` provides accurate column types
2. **Maintainability** - Single source of truth for types (Drizzle schema)
3. **Bundle size** - Removed ~900 lines of deprecated code
4. **React 19 compliance** - All setState-in-effect violations resolved
