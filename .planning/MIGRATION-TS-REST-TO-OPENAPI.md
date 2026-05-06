# Migration Plan: ts-rest → Hono + Zod + OpenAPI

**Goal:** Eliminate type inference issues by migrating from ts-rest-hono to native Hono with Zod validation and OpenAPI schema generation.

**Current State:**
- ✅ 9 routes migrated (awards, badges, comments, entities, locations, logistics, notifications, points, tba)
- ⏳ 16 routes remaining (analytics, communications, docs, finance, github, judges, posts, profiles, seasons, settings, socialQueue, sponsors, store, tasks, users, zulip)
- 33 contract files to replace
- 51 route files total

---

## Why This Migration

**Problem:** ts-rest-hono's `initServer<AppEnv>` pattern doesn't properly infer handler input types, forcing `any` on all handlers:

```typescript
// ❌ Current ts-rest pattern
const handlers: any = {
  getRankings: async (input: any, c: HonoContext) => { ... }
};
```

**Solution:** Hono's native `.openapi()` with Zod provides full type safety:

```typescript
// ✅ New Hono+Zod pattern
router.openapi(getRankingsRoute, async (c) => {
  const { eventKey } = c.req.valid("param"); // Fully typed!
  return c.json({ rankings: data });
});
```

---

## New Pattern

### 1. Route Definition (replaces `*Contract.ts`)

```typescript
// shared/routes/analytics.ts (NEW LOCATION)
import { createRoute, z } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  security: [{ BearerAuth: [] }],
  responses: {
    ...standardErrors,
    200: {
      content: { "application/json": { schema: z.object({
        posts: z.number(),
        events: z.number(),
        docs: z.number(),
        securityBlocks: z.number(),
      })}},
      description: "Platform statistics"
    },
  },
});
```

### 2. Handler Implementation

```typescript
// functions/api/routes/analytics.ts
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin } from "../middleware";
import { getStatsRoute } from "../../../shared/routes/analytics";

const router = new OpenAPIHono<AppEnv>();

router.openapi(getStatsRoute, ensureAdmin, async (c) => {
  const db = c.get("db");
  const stats = await fetchStats(db);
  return c.json(stats);
});

export default router;
```

### 3. Client-side Usage

```typescript
// src/api/analytics.ts (replaces ts-rest client)
import { hc } from "hono/client";
import type { AppType } from "../../../functions/api/[[route]]";

const client = hc<AppType>("/api");

// Fully typed fetch
const { data } = await client.analytics.stats.$get();
//    ^? { posts: number; events: number; ... }
```

---

## Migration Checklist

### Phase 1: Infrastructure (1 file)
- [ ] Create `shared/routes/` directory structure
- [ ] Create `shared/routes/common.ts` with standard errors, security schemes
- [ ] Create `shared/routes/index.ts` for route aggregation

### Phase 2: Route Migration (16 files)

| Route | Contract | Handler | Tests |
|-------|----------|---------|-------|
| analytics.ts | analyticsContract.ts | ✓ | analytics.test.ts |
| communications.ts | communicationsContract.ts | ✓ | communications.test.ts |
| docs.ts | docContract.ts | ✓ | docs.test.ts |
| finance.ts | financeContract.ts | ✓ | finance.test.ts |
| github.ts | githubContract.ts | ✓ | github.test.ts |
| judges.ts | judgeContract.ts | ✓ | judges.test.ts |
| posts.ts | postContract.ts | ✓ | posts.test.ts |
| profiles.ts | profileContract.ts | ✓ | profiles.test.ts |
| seasons.ts | seasonContract.ts | ✓ | seasons.test.ts |
| settings.ts | settingsContract.ts | ✓ | settings.test.ts |
| socialQueue.ts | socialQueueContract.ts | ✓ | - |
| sponsors.ts | sponsorContract.ts | ✓ | sponsors.test.ts |
| store.ts | storeContract.ts | ✓ | - |
| tasks.ts | taskContract.ts | ✓ | tasks.test.ts |
| users.ts | userContract.ts | ✓ | users.test.ts |
| zulip.ts | zulipContract.ts | ✓ | zulip.test.ts |

### Phase 3: Client Migration (1 file)
- [ ] Update `src/api/client.ts` to use `hc()` from Hono
- [ ] Update all `api.xxx.yyy.useQuery()` calls

### Phase 4: Cleanup
- [ ] Delete `shared/schemas/contracts/` (33 files)
- [ ] Remove `@ts-rest/core`, `ts-rest-hono` dependencies
- [ ] Remove eslint-disable comments for ts-rest handlers
- [ ] Verify all 926 unit tests pass
- [ ] Verify all 55 e2e tests pass

---

## Benefits

1. **Zero `any` in handlers** - Full type inference from Zod schemas
2. **OpenAPI spec generation** - Auto-generated API documentation
3. **Smaller bundle** - No ts-rest runtime overhead
4. **Better error messages** - Zod validation errors are clearer
5. **Standard patterns** - More developers know Hono+Zod than ts-rest

---

## Risks

| Risk | Mitigation |
|------|------------|
| Breaking frontend during migration | Use feature flag or parallel deployment |
| Test failures | Update tests incrementally with each route |
| OpenAPI schema conflicts | Use `tags` to group routes by domain |

---

## Example: Before & After

### Before (ts-rest)

```typescript
// shared/schemas/contracts/analyticsContract.ts
export const analyticsContract = c.router({
  getStats: {
    method: "GET",
    path: "/admin/stats",
    responses: { ...standardErrors, 200: z.object({ posts: z.number() }) }
  }
});

// functions/api/routes/analytics.ts
const handlers = {
  getStats: async (_input: any, c: HonoContext) => {
    const stats = await fetchStats(c.get("db"));
    return { status: 200, body: stats }; // ❌ manual typing
  }
};
createHonoEndpoints(analyticsContract, s.router(analyticsContract, handlers), router);
```

### After (Hono+Zod+OpenAPI)

```typescript
// shared/routes/analytics.ts
export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    ...standardErrors,
    200: { content: { "application/json": { schema: StatsSchema } } }
  }
});

// functions/api/routes/analytics.ts
router.openapi(getStatsRoute, ensureAdmin, async (c) => {
  const stats = await fetchStats(c.get("db"));
  return c.json(stats); // ✅ auto-inferred return type
});
```
