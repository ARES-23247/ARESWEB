# Hono/Zod/Drizzle Technical Debt Cleanup

**Date:** 2026-05-08
**Branch:** master (direct commits)

## Summary

Completed the final phase of the Hono/Zod/Drizzle migration, addressing remaining technical debt from before the transition. This included migrating legacy Cloudflare Pages Functions, replacing manual type assertions with Zod validation, and converting remaining raw D1 queries to Drizzle ORM.

## What Changed

### 1. Legacy Cloudflare Pages Functions Migrated
- **Deleted** `functions/dashboard/api/[[route]].ts` (trivial re-export)
- **Deleted** `functions/api/generate-sim-registry.ts` → Migrated to Hono
- **Deleted** `functions/api/list-sim-folders.ts` → Migrated to Hono
- **Added** OpenAPI routes to `shared/routes/simulations.ts` for admin endpoints

### 2. AI Routes Type Safety
- **Added** missing OpenAPI schemas to `shared/routes/ai.ts`:
  - `reindexRoute` - Admin reindex with force boolean
  - `reindexExternalRoute` - External source reindexing
  - `externalSourcesRoute` - External knowledge source management
- **Updated** `functions/api/routes/ai/index.ts` to use `c.req.valid("json")` instead of manual `as` assertions

### 3. Raw D1 Queries → Drizzle ORM
- **Updated** `functions/api/[[route]].ts`:
  - Usage metrics logging now uses `db.insert(schema.usageMetrics)`
  - Scheduled function (cron) now uses Drizzle for social queue, settings, and audit log queries
- **Updated** `functions/api/routes/auth.ts`:
  - Test login user query now uses `db.select().from(schema.user)`
  - Session insertion now uses `db.insert(schema.session)`

### 4. Profile Utilities Type Safety
- **Updated** `functions/api/routes/_profileUtils.ts` to use nullish coalescing (`??`) instead of `as string/as number` assertions

### 5. Frontend Component Update
- **Updated** `src/components/SimManager.tsx` to use new API path `/api/simulations/admin/generate-registry`

## Files Modified

```
functions/api/[[route]].ts                    # Usage metrics, scheduled function Drizzle migration
functions/api/routes/ai/index.ts               # Type assertions → Zod validation
functions/api/routes/auth.ts                   # Raw D1 → Drizzle
functions/api/routes/_profileUtils.ts          # Type assertions → nullish coalescing
functions/api/routes/simulations.ts            # Added admin endpoints
shared/routes/ai.ts                            # Added missing OpenAPI schemas
shared/routes/simulations.ts                   # Added admin route definitions
src/components/SimManager.tsx                  # Updated API path

functions/dashboard/api/[[route]].ts          # DELETED
functions/api/generate-sim-registry.ts         # DELETED
functions/api/list-sim-folders.ts              # DELETED
```

## Known Limitations

- **SEO Middleware** (`functions/_middleware.ts`): Kept unchanged as it requires Cloudflare-specific `HTMLRewriter` not available in standard Hono
- **Sim Admin Endpoints**: Filesystem scanning (`list-sim-folders`) and registry generation don't work in Cloudflare Workers environment - endpoints return appropriate errors

## Migration Complete

This completes the Hono/Zod/Drizzle transition that was started in previous milestones. The codebase now has:
- ✅ Consistent OpenAPI route definitions
- ✅ Type-safe request/response handling via Zod
- ✅ Drizzle ORM for all database operations
- ✅ No legacy Pages Functions (except SEO middleware)
- ✅ No manual type assertions in critical paths
