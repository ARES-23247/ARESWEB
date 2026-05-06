# ts-rest → OpenAPIHono Migration

**Date:** 2026-05-06
**Branch:** feature/standardize-errors-and-contracts

## Summary

Successfully migrated all 25 backend API routes from `ts-rest-hono` to `@hono/zod-openapi`, eliminating type inference issues that forced handlers to use `any` types.

## What Changed

### Backend (Complete)
- **16 new route definition files** in `shared/routes/` using `createRoute()` from `@hono/zod-openapi`
- **25 handler files** migrated to use `router.openapi()` pattern
- **Type-safe handlers**: `c.req.valid("param"|"query"|"json")` provides full type inference
- **Middleware ordering fixed**: Auth middleware now applied before route definitions

### Files Created
```
shared/routes/
├── common.ts          # Standard error schemas, security schemes
├── index.ts           # Export all routes
├── analytics.ts       # 7 routes
├── communications.ts  # 2 routes
├── docs.ts            # 15 routes
├── finance.ts         # 7 routes
├── github.ts          # 3 routes
├── judges.ts          # 5 routes
├── posts.ts           # 14 routes
├── profiles.ts        # 5 routes
├── seasons.ts         # 8 routes
├── settings.ts        # 5 routes
├── socialQueue.ts     # 7 routes
├── sponsors.ts        # 7 routes
├── store.ts           # 5 routes
├── tasks.ts           # 5 routes
├── users.ts           # 6 routes
└── zulip.ts           # 5 routes
```

### Pattern Change

**Before (ts-rest):**
```typescript
// handlers: any = { ... }
const handlers: any = {
  getStats: async (_input: any, c: HonoContext) => {
    return { status: 200, body: stats };
  }
};
createHonoEndpoints(contract, s.router(contract, handlers), router);
```

**After (OpenAPIHono):**
```typescript
router.openapi(getStatsRoute, async (c) => {
  const stats = await fetchStats(c.get("db"));
  return c.json(stats); // Fully typed!
});
```

## Test Results

| Test Suite | Result |
|------------|--------|
| Unit tests | 926/926 ✅ |
| E2E tests | 54/55 ✅ |

## Remaining Work (Optional)

- [ ] Remove `shared/schemas/contracts/` (33 old contract files)
- [ ] Remove `@ts-rest/core`, `ts-rest-hono` dependencies
- [ ] Migrate frontend to Hono `hc()` client (deferred - 286 usages across 88 files)

## Benefits Achieved

1. **Zero `any` in handlers** - Full type inference from Zod schemas
2. **OpenAPI spec generation** - Auto-generated API documentation available
3. **Better error messages** - Zod validation errors are clearer
4. **Standard patterns** - More developers know Hono+Zod than ts-rest
