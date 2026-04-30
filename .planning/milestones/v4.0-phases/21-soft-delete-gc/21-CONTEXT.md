# Phase 21: Soft-Delete GC Cron - Context

**Gathered:** 2026-04-29
**Status:** Ready for planning
**Mode:** Auto-generated (autonomous)

<domain>
## Phase Boundary

Implement a Cloudflare scheduled worker to permanently delete rows soft-deleted > 30 days ago.
</domain>

<decisions>
## Implementation Decisions

### Cron Trigger Architecture
Cloudflare Pages does not natively support cron triggers (`scheduled` events) through the `functions/` directory routing alone. However, we can create a dedicated route (e.g. `POST /api/internal/gc`) protected by a secure cron secret header (`x-cron-secret`). A separate Cloudflare Worker or GitHub Actions cron job can then call this endpoint daily.

Alternatively, since Cloudflare now allows setting up Cron Triggers for Pages projects via `wrangler.toml` and a top-level `_worker.js`/`scheduled` export, but we are using `functions/`, the easiest path for full stack is exposing an internal secure endpoint and triggering it externally, OR using an internal endpoint protected by an Admin Cron Secret.

Let's use an internal secure API route:
`POST /api/internal/gc`
Protected by an `x-cron-secret` header.
</decisions>

<code_context>
## Existing Code Insights

We will add a new route `functions/api/routes/internal/gc.ts`.
It will instantiate Kysely and run `DELETE FROM table WHERE is_deleted = 1 AND updated_at < date('now', '-30 days')` for all relevant tables (`posts`, `events`, `seasons`, `awards`, etc).
</code_context>

<specifics>
## Specific Ideas

- Ensure `updated_at` exists and is reliable. If not, maybe use `published_at` or we'll just skip tables without `updated_at`. Let's check schemas for `updated_at`.
</specifics>
