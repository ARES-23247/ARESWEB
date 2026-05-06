# Milestone Context: Migrate ts-rest → @hono/zod-openapi

## Goal

Replace the ts-rest contract library with `@hono/zod-openapi` to achieve full compile-time type safety on API route handlers, eliminate all `s.router(contract, handlers as any)` casts, and gain automatic OpenAPI documentation — without changing any public API URL or behavior.

## Background

The current ts-rest + ts-rest-hono integration has a fundamental Zod v4 compatibility issue:
- ts-rest's internal `ServerInferRequest` type uses `ZodInferOrType<T>` which calls `z.ZodTypeAny` from Zod v3's type system
- When contracts use Zod v4's `ZodObject`, the extends check fails and everything resolves to `never`
- This forces `s.router(contract, handlers as any)` on all 27 route files
- Neither `satisfies`, explicit type annotations, nor custom wrappers can fix this — verified by prototype on `tba.ts`

Meanwhile, the frontend does NOT use ts-rest's client (`@ts-rest/react-query` or `initClient`) — it uses raw `fetch()`. So the contract-sharing benefit of ts-rest is entirely unused.

## Why @hono/zod-openapi

1. **Already on Hono** — The backend is 100% Hono on Cloudflare Workers. `@hono/zod-openapi` is Hono's native solution.
2. **Native Zod v4** — No compatibility layer needed. Zod schemas work directly.
3. **Full type inference** — Route handlers get inferred `input` types from the route definition. No `as any`.
4. **Free OpenAPI spec** — Auto-generated from route definitions, useful for team onboarding.
5. **Smaller bundle** — Removes `@ts-rest/core`, `@ts-rest/open-api`, `ts-rest-hono` dependencies.
6. **No URL changes** — Routes stay RESTful with the same paths.

## Scope

### In Scope
- Replace all 27 `initContract().router()` contract definitions with `createRoute()` format
- Replace all 27 `createHonoEndpoints()` + `s.router()` handler mounts with native Hono OpenAPI routing
- Migrate all Zod schemas (they stay identical, just repackaged)
- Remove `@ts-rest/core`, `@ts-rest/open-api`, `ts-rest-hono` dependencies
- Remove custom `ServerInferRequest` from `shared/types/api.ts`
- Update all 70 test files that reference contract types
- Generate OpenAPI spec endpoint (`/api/docs` or `/api/openapi.json`)
- Verify all 926+ tests pass

### Out of Scope
- Frontend API client changes (stays as raw `fetch()`)
- Database schema changes
- New features or endpoints
- oRPC migration (rejected — paradigm mismatch)

## Surface Area

| Category | Count | Notes |
|----------|-------|-------|
| Contract files (`shared/schemas/contracts/`) | 27 | Each has `initContract().router()` |
| Route handler files (`functions/api/routes/`) | 27 | Each has `createHonoEndpoints()` |
| Test files | 70 | May reference contract types |
| Shared type files | 3 | `api.ts`, `contracts.ts`, `database.ts` |
| Middleware | 1 | `functions/api/middleware.ts` (`initServer`, `s`) |

## Migration Pattern

### Before (ts-rest)
```typescript
// shared/schemas/contracts/tbaContract.ts
import { initContract } from "@ts-rest/core";
const c = initContract();
export const tbaContract = c.router({
  getRankings: { method: "GET", path: "/rankings/:eventKey", ... }
});

// functions/api/routes/tba.ts
const s = initServer<AppEnv>();
const handlers = { getRankings: async (input, c) => { ... } };
const router = s.router(tbaContract, handlers as any); // ← forced cast
createHonoEndpoints(tbaContract, router, tbaRouter);
```

### After (@hono/zod-openapi)
```typescript
// functions/api/routes/tba.ts
import { createRoute, OpenAPIHono } from "@hono/zod-openapi";

const getRankingsRoute = createRoute({
  method: "get",
  path: "/rankings/{eventKey}",
  request: { params: z.object({ eventKey: z.string() }) },
  responses: { 200: { content: { "application/json": { schema: z.object({ rankings: z.array(z.unknown()) }) } } } }
});

const tbaRouter = new OpenAPIHono<AppEnv>();
tbaRouter.openapi(getRankingsRoute, async (c) => {
  const { eventKey } = c.req.valid("param");  // ← fully typed, no cast
  return c.json({ rankings: [...] }, 200);
});
```

## Proposed Phases

### Phase 1: Infrastructure & Proof of Concept (1 file)
- Install `@hono/zod-openapi`
- Migrate `tba.ts` (simplest: 3 endpoints, no auth complexity) as reference
- Verify compile-time types, runtime validation, and test compatibility
- Document the migration pattern for remaining files

### Phase 2: Contract Schema Conversion (schema layer)
- Convert all 27 `initContract().router()` definitions to `createRoute()` format
- Zod schemas stay identical — only the wrapper changes
- Maintain backward compatibility by keeping old contracts temporarily

### Phase 3: Simple Route Migration (12 files)
- Migrate routes with ≤5 endpoints and no complex middleware chains
- Candidates: awards, badges, comments, entities, locations, logistics, points, seasons, settings, socialQueue, tba (done), notifications

### Phase 4: Complex Route Migration (15 files)
- Migrate routes with auth guards, file uploads, or >5 endpoints
- Candidates: docs, events, finance, github, inquiries, judges, media, outreach, posts, profiles, sponsors, store, tasks, users, zulip
- Handle `ensureAuth`, `ensureAdmin`, `rateLimitMiddleware` integration with OpenAPIHono

### Phase 5: Cleanup & OpenAPI Spec
- Remove `@ts-rest/core`, `@ts-rest/open-api`, `ts-rest-hono` from dependencies
- Remove `shared/types/api.ts` custom `ServerInferRequest`
- Remove `initServer` and `s` from middleware
- Add `/api/docs` endpoint serving generated OpenAPI spec
- Update all test imports
- Final `tsc --noEmit` + `vitest run` validation

## Risk Assessment

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Runtime behavior changes | Low | Zod schemas are identical; only the mount layer changes |
| Test breakage | Medium | Tests use Hono `app.request()` — routing behavior stays same |
| Bundle size increase | Low | Net decrease (removing 3 deps, adding 1 smaller one) |
| Migration fatigue (27 files) | Medium | Batch in waves with automated validation between each |
| OpenAPIHono middleware compat | Medium | Verify `ensureAuth` etc. work with `app.openapi()` before mass migration |

## Prerequisites
- v6.7 milestone completed (TypeScript Any Elimination)
- All 926+ tests passing
- Clean `tsc --noEmit` build

## Estimated Effort
- **Phase 1**: 1 session (proof of concept)
- **Phase 2**: 1 session (schema conversion, mostly mechanical)
- **Phase 3**: 1-2 sessions (12 simple routes)
- **Phase 4**: 2-3 sessions (15 complex routes)
- **Phase 5**: 1 session (cleanup)
- **Total**: ~6-8 sessions
