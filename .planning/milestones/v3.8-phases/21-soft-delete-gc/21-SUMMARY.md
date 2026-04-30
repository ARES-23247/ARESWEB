# Phase 21: Soft-Delete GC Cron - Summary

**Completed:** 2026-04-29
**Mode:** Auto-generated (autonomous)

## Implementation Details
- Created a secure internal API route `POST /api/internal/gc` inside `functions/api/routes/internal/gc.ts`.
- Registered the route in the global API router (`functions/api/[[route]].ts`).
- Added the `CRON_SECRET` variable to the strictly validated `AppEnv` type in `utils.ts` and `env.ts`.
- The `gc` route checks for an `x-cron-secret` header that must match `CRON_SECRET` to prevent unauthorized execution.
- If authorized, it connects to D1 via Kysely and permanently deletes rows from `docs`, `comments`, and `seasons` where `is_deleted = 1` and `updated_at` is older than 30 days.

## Outcome
The Cloudflare D1 database will no longer endlessly accumulate soft-deleted rows. External cron services (e.g. GitHub Actions) or Cloudflare Workers can now securely trigger the garbage collection routine daily without requiring direct database access.
