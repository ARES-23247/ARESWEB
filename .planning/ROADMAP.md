# Milestone Roadmap

## Milestones

- v6.6 TypeScript Strictness - Phases 21-26 (shipped 2026-05-05)
- v6.7 TypeScript Any Elimination - Phases 27-33 (shipped 2026-05-06)
- **v6.8 Hono Zod OpenAPI Migration** - Phases 34-37 (active)

## Phases

<details>
<summary>v6.6 TypeScript Strictness (Phases 21-26) - SHIPPED 2026-05-05</summary>

- [x] Phase 21: Core Domain and Data Layer Strictness
- [x] Phase 22: ARES Physics and Math Engine Validation
- [x] Phase 23: R3F and Sim Component Typings
- [x] Phase 24: ESLint Lockdown and CI Validation
- [x] Phase 25: Comprehensive Security Audit
- [x] Phase 26: Calendar and Event Editor Enhancements

</details>

<details>
<summary>v6.7 TypeScript Any Elimination (Phases 27-33) - SHIPPED 2026-05-06</summary>

- [x] Phase 27: Type Foundation
- [x] Phase 28: High-Impact Handlers
- [x] Phase 28.1: AI Simulation and Analytics Stabilization
- [x] Phase 29: Contract Inference
- [x] Phase 29.1: Remaining Route Contract Inference
- [x] Phase 30: Test Types
- [x] Phase 31: Frontend Components
- [x] Phase 32: Final Validation
- [x] Phase 33: Simulation Playground AI Diff View

</details>

### v6.8 Hono Zod OpenAPI Migration (Phases 34-37)

**Goal**: Replace ts-rest with @hono/zod-openapi to achieve full compile-time type safety and auto-generated OpenAPI docs.

- [x] **Phase 34: Infrastructure and Proof of Concept** - Install deps, validate middleware compat, migrate tba.ts as reference
- [x] **Phase 35: Simple Route Migration** - Migrate 12 routes with 5 or fewer endpoints
- [x] **Phase 36: Complex Route Migration** - Migrate 14 routes with auth guards, uploads, many endpoints
- [/] **Phase 37: Cleanup and OpenAPI Spec** - Remove ts-rest deps, serve OpenAPI docs, migrate frontend hooks

## Phase Details

### Phase 34: Infrastructure and Proof of Concept

**Goal**: Install @hono/zod-openapi, validate middleware compatibility, and migrate tba.ts as the reference implementation proving the pattern works end-to-end.

**Depends on**: Nothing (foundation phase)

**Requirements**: INFRA-01, INFRA-02, INFRA-03, ROUTE-01, VAL-01, VAL-02

**Success Criteria**:
1. @hono/zod-openapi installed and compiling with existing Zod v4 schemas
2. ensureAuth/ensureAdmin/rateLimitMiddleware verified working with OpenAPIHono
3. tba.ts fully migrated: 3 endpoints using createRoute() + app.openapi()
4. tba.test.ts passes without changes (or minimal mock adjustments)
5. tsc --noEmit passes
6. Migration pattern documented for Phase 35-36 execution

**Plans**: 0 (run /gsd-plan-phase 34 to create)

---

### Phase 35: Simple Route Migration

**Goal**: Migrate 12 route files with 5 or fewer endpoints each, using the pattern established in Phase 34.

**Depends on**: Phase 34 (reference implementation and validated pattern)

**Requirements**: ROUTE-02, ROUTE-04, VAL-01, VAL-02

**Target files** (12):
- awards.ts, badges.ts, comments.ts, entities.ts, locations.ts
- logistics.ts, notifications.ts, points.ts, seasons.ts
- settings.ts, socialQueue.ts, store.ts

**Success Criteria**:
1. All 12 files use createRoute() + app.openapi() pattern
2. Zero createHonoEndpoints() or s.router() calls in migrated files
3. All existing tests pass for migrated routes
4. URL paths and response shapes unchanged
5. tsc --noEmit passes after each wave

**Plans**: 0 (run /gsd-plan-phase 35 to create)

---

### Phase 36: Complex Route Migration

**Goal**: Migrate 14 route files with auth guards, file uploads, or many endpoints.

**Depends on**: Phase 35 (simple routes validated, pattern battle-tested)

**Requirements**: ROUTE-03, ROUTE-04, VAL-01, VAL-02

**Target files** (14):
- analytics.ts, communications.ts, docs.ts, finance.ts, github.ts
- judges.ts, posts.ts, profiles.ts, sponsors.ts, tasks.ts
- users.ts, zulip.ts
- events/ (handlers.ts + index.ts)
- inquiries/ (handlers.ts + index.ts)
- media/ (handlers.ts + index.ts)
- outreach/ (handlers.ts + index.ts)

**Success Criteria**:
1. All 14 route modules use createRoute() + app.openapi()
2. File upload routes (media/) work with OpenAPIHono multipart handling
3. Auth middleware chains (ensureAuth, ensureAdmin) properly applied
4. Handler module pattern (separate handlers.ts + index.ts) migrated cleanly
5. All existing tests pass

**Plans**: 0 (run /gsd-plan-phase 36 to create)

---

### Phase 37: Cleanup and OpenAPI Spec

**Goal**: Remove all ts-rest dependencies, serve auto-generated OpenAPI spec, and validate the final build.

**Depends on**: Phase 36 (all routes migrated)

**Requirements**: CLEAN-01 through CLEAN-04, DOCS-01, DOCS-02, VAL-01 through VAL-05

**Success Criteria**:
1. @ts-rest/core, @ts-rest/open-api, ts-rest-hono removed from package.json
2. All 27 contract files in shared/schemas/contracts/ removed or converted
3. shared/types/contracts.ts updated (remove ts-rest re-exports)
4. /api/docs endpoint serves valid OpenAPI 3.1 JSON spec
5. All 926+ tests pass
6. tsc --noEmit and eslint pass clean
7. Zero as-any casts from router mounting
8. Bundle size equal or smaller

**Plans**: 0 (run /gsd-plan-phase 37 to create)