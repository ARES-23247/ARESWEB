---
gsd_state_version: 1.0
milestone: v6.8
milestone_name: Hono Zod OpenAPI Migration
status: Defining requirements
last_updated: "2026-05-06T11:45:00.000Z"
last_activity: 2026-05-06
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# System State

**Current Milestone**: v6.8 — Hono Zod OpenAPI Migration
**Status**: Defining requirements
**Last activity**: 2026-05-06

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-05-06 — Milestone v6.8 started

## Project Reference

See: .planning/PROJECT.md (updated 2026-05-06)

**Core value:** Championship-grade FIRST Robotics team management platform
**Current focus:** Replace ts-rest with @hono/zod-openapi for native Zod v4 type inference

## Accumulated Context

### Key Decisions (v6.8)

1. **@hono/zod-openapi over oRPC**: Already 100% Hono backend; native integration eliminates impedance mismatch
2. **@hono/zod-openapi over ts-rest RC**: RC is a band-aid; migration eliminates the entire contract-layer abstraction
3. **Frontend untouched**: React frontend uses raw `fetch()`, not ts-rest client — no frontend migration needed
4. **Identical URLs**: All REST endpoints keep existing paths — zero breaking changes for consumers

### Anti-Patterns to Avoid

1. Migrating frontend to Hono RPC client (unnecessary complexity, raw fetch is fine)
2. Changing URL structures during migration (breaks existing integrations)
3. Migrating all routes simultaneously (risk too high — wave-based approach required)
4. Removing old contracts before new routes are validated (keep both temporarily)

### Research Insights

- `@hono/zod-openapi` is Hono-native, uses `createRoute()` + `app.openapi()` pattern
- Zod schemas transfer directly — only the wrapper/mount layer changes
- Middleware (`ensureAuth`, `ensureAdmin`, `rateLimitMiddleware`) works with OpenAPIHono
- Free OpenAPI spec generation at `/api/docs`
- Net dependency reduction: remove 3 packages (`@ts-rest/core`, `@ts-rest/open-api`, `ts-rest-hono`)

## Session Continuity

**Last session**: Started v6.8 milestone — Hono Zod OpenAPI Migration
**Next step**: Define requirements and create roadmap
