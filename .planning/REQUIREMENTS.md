# Milestone v7.1 Requirements

**Goal**: Complete the migration of ARESWEB backend persistence from legacy Kysely syntax to Drizzle ORM to achieve full type safety and architectural stability.

### Drizzle Core Migration
- [ ] **MIGRATE-01**: Refactor `tasks`, `store`, `sponsors`, `socialQueue`, `sitemap`, and `simulations` routes to Drizzle ORM (Batch 2).
- [ ] **MIGRATE-02**: Refactor `zulip`, `zulipWebhook`, `users`, `seasons`, `settings`, and any remaining backend routes to Drizzle ORM (Batch 3).
- [ ] **MIGRATE-03**: Remove all legacy Kysely querying logic (`db.selectFrom`, `execute`, `executeTakeFirst`) from `functions/api/routes`.

### Type Safety & Testing
- [ ] **MIGRATE-04**: Update all backend unit test suites (`*.test.ts`) to mock the Drizzle ORM API (`all`, `run`, `get`) instead of Kysely.
- [ ] **MIGRATE-05**: Replace the globally cast `c.get("db") as any` bypass with the strongly-typed Drizzle Cloudflare D1 Context once Kysely queries are eliminated.
- [ ] **MIGRATE-06**: Ensure codebase integrity by passing `npx tsc --noEmit` and `npm run test`.

### Traceability
- Phase 52: Batch 1 (Completed)
- Phase 53: MIGRATE-01
- Phase 54: MIGRATE-02, MIGRATE-03
- Phase 55: MIGRATE-04, MIGRATE-05, MIGRATE-06
