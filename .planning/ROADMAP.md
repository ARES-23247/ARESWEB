# Proposed Roadmap

**6 phases** | **6 requirements mapped**

| # | Phase | Goal | Requirements | Success Criteria |
|---|-------|------|--------------|------------------|
| 16 | Fix Liveblocks Migration Error | Resolve duplicate column `content_draft` error in migration 048. | REQ-1 | `npx wrangler d1 migrations apply ares-db --local` passes without errors. |
| 17 | Database Simplification & Audit | Simplify and audit the 49 migrations and existing schemas. | REQ-2 | An audit log is produced and any coalescing/dropping of obsolete database elements is successfully executed. |
| 18 | Refactor Raw SQL to Kysely | Replace `c.env.DB.prepare` calls with type-safe Kysely syntax in media and auth routes. | REQ-3 | No raw SQL preparation statements exist for queries that can be executed via Kysely; types generate cleanly. |
| 19 | Move Rate Limiting to KV | Refactor isolate-memory global rate limits to a KV-backed implementation. | REQ-4 | Global rate limiting correctly blocks requests across multiple isolates. |
| 20 | Edge Caching for Read Routes | Add cache headers or KV caching for heavy read routes (posts, events, seasons). | REQ-5 | Caching logic correctly prevents redundant D1 queries for public resources. |
| 21 | Soft-Delete GC Cron | Implement a Cloudflare scheduled worker to permanently delete rows soft-deleted > 30 days ago. | REQ-6 | Cron job successfully purges old `is_deleted = 1` rows. |
| 22 | CI Pipeline Optimization | Restructure `.github/workflows/ci.yml` to run checks and tests in parallel and isolate preview deployments. | REQ-7 | CI workflow execution time drops significantly and dual-deployment race conditions on `master` are resolved. |
| 23 | E2E Suite Sharding | Shard Playwright E2E tests into a parallel matrix and decouple Pa11y tests. | REQ-8 | Playwright tests are distributed across 3 shards and `ci.yml` leverages full concurrency. |


### Archived Milestones
- [v3.7 - UI Polish & CSS Linting](milestones/v3.7-ROADMAP.md)
- [v3.6 - Collaboration Polish & UI Fixes](milestones/v3.6-ROADMAP.md)
- [v3.5 - Version Control & Contributor Attribution](milestones/v3.5-ROADMAP.md)
