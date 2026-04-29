# Phase 21: Soft-Delete GC Cron - Plan

## Goal
Implement a Cloudflare scheduled worker to permanently delete rows soft-deleted > 30 days ago.

## Strategy
1. Create a secure internal route `POST /api/internal/gc` in the ARESWEB backend.
2. Protect the route using an `x-cron-secret` header that must match the `CRON_SECRET` environment variable.
3. The handler will query the D1 database and permanently delete (`DELETE FROM`) rows where `is_deleted = 1` and `updated_at < datetime('now', '-30 days')`.
4. The target tables will be `docs`, `comments`, and `seasons` (which all possess `is_deleted` and `updated_at` fields).
5. For `posts` and `events` that lack `updated_at`, we will skip automated garbage collection for safety to prevent purging recently soft-deleted items, or we can check if they have a mechanism. (We will stick to tables with `updated_at` to be safe).

## Execution Steps
1. Create `functions/api/routes/internal/gc.ts`.
2. Register it in `functions/api/[[route]].ts`.
3. Test compilation using `tsc --noEmit`.
