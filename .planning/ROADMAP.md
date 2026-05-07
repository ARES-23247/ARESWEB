## v7.1 Drizzle ORM Migration (Phases 52-57)

**Goal**: Complete the migration of ARESWEB backend persistence from Kysely to Drizzle ORM to achieve full type safety and architectural stability.

- [x] **Phase 52: Drizzle ORM Migration - Batch 1** - Refactored inquiries, awards, badges, locations, and analytics routes.
- [x] **Phase 53: Drizzle ORM Migration - Batch 2** - Migrate tasks, store, sponsors, socialQueue, sitemap, and simulations.
- [x] **Phase 54: Drizzle ORM Migration - Batch 3** - Migrate remaining backend routes (zulip, users, seasons, settings).
- [ ] **Phase 55: Drizzle ORM Migration - Batch 4** - Migrate docs, comments, posts, media, notifications, profiles.
- [ ] **Phase 56: Drizzle ORM Migration - Batch 5** - Migrate analytics, ai, events, finance, logistics, points, scouting.
- [ ] **Phase 57: Drizzle Test Migration & Context Type Safety** - Update unit tests and replace `c.get("db") as any` bypass.

### Phase Details

### Phase 53: Drizzle ORM Migration - Batch 2

**Goal**: Refactor `tasks.ts`, `store.ts`, `sponsors.ts`, `socialQueue.ts`, `sitemap.ts`, and `simulations.ts` to Drizzle ORM.
**Depends on**: Phase 52
**Requirements**: MIGRATE-01
**Success Criteria**:
1. All Kysely queries in these files replaced with Drizzle.
2. `tsc --noEmit` passes.

---

### Phase 54: Drizzle ORM Migration - Batch 3

**Goal**: Refactor `zulip.ts`, `zulipWebhook.ts`, `users.ts`, `seasons.ts`, `settings.ts`.
**Depends on**: Phase 53
**Requirements**: MIGRATE-02
**Success Criteria**:
1. All Kysely queries in these files replaced with Drizzle.
2. `tsc --noEmit` passes.

---

### Phase 55: Drizzle ORM Migration - Batch 4

**Goal**: Refactor `docs.ts`, `comments.ts`, `posts.ts`, `media/handlers.ts`, `notifications.ts`, `profiles.ts` to Drizzle ORM.
**Depends on**: Phase 54
**Requirements**: MIGRATE-03
**Success Criteria**:
1. All Kysely queries in these files replaced with Drizzle.
2. `tsc --noEmit` passes.

---

### Phase 56: Drizzle ORM Migration - Batch 5

**Goal**: Refactor `analytics/performance.ts`, `ai/index.ts`, `ai/indexer.ts`, `events/handlers.ts`, `events/index.ts`, `finance.ts`, `logistics.ts`, `points.ts`, `scouting/analyses.ts`, `scouting/analyze.ts`, `judges.ts`, `communications.ts`, `internal/gc.ts`, `outreach/handlers.ts`.
**Depends on**: Phase 55
**Requirements**: MIGRATE-04
**Success Criteria**:
1. Zero `.execute()` or `.executeTakeFirst()` calls remaining in `functions/api/routes`.
2. `tsc --noEmit` passes.

---

### Phase 57: Drizzle Test Migration & Context Type Safety

**Goal**: Update unit tests to mock Drizzle ORM and eliminate the `c.get("db") as any` bypass in the Hono context.
**Depends on**: Phase 56
**Requirements**: MIGRATE-05, MIGRATE-06, MIGRATE-07
**Success Criteria**:
1. All `*.test.ts` files use Drizzle mock chains (`run`, `all`, `get`).
2. Global `AppEnv` enforces `DrizzleD1Database` type on the `db` variable.
3. `c.get("db") as any` is fully eliminated.
4. `npm run test` and `tsc --noEmit` pass flawlessly.
