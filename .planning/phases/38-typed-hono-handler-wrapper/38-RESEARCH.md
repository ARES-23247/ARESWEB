# Phase 38: Typed Hono Handler Wrapper - Research

## Goal
Create a generic `typedHandler<R>()` utility to extract request parameter types from `createRoute()` definitions, eliminating the need for `as any` casts (and `c: any` typings) across all 50+ backend route files.

## Current State
Presently, backend route handlers use `@hono/zod-openapi`'s `OpenAPIHono.openapi` method. The route schema is defined using `createRoute` in `shared/routes/`.
In the route implementations (e.g. `functions/api/routes/users.ts` or `docs.ts`), the handler function is either casted directly:
```typescript
usersRouter.openapi(getUsersRoute, (async (c) => {
  // ...
}) as AppRouteHandler<typeof getUsersRoute>);
```
Or the context is explicitly cast to `any`:
```typescript
docsRouter.openapi(docsRoutes.getDocsRoute, async (c: any) => {
  // ...
});
```

This bypasses type safety for the `c` (Context) object, meaning `c.req.valid('param')`, `c.req.valid('json')`, and environment bindings are either untyped or require manual casting.

## Proposed Solution
We need a higher-order utility function that enforces the `RouteHandler` type based on the provided OpenAPI route configuration.

### Approach 1: Generic Handler Wrapper
We can define a generic utility `typedHandler<R>` in a shared backend utility file (e.g., `functions/api/utils/handler.ts` or inside `functions/api/middleware.ts`):

```typescript
import { RouteConfig, RouteHandler } from "@hono/zod-openapi";
import { AppEnv } from "../middleware"; // Assuming it's defined here or in a types file

export const typedHandler = <R extends RouteConfig>(
  handler: RouteHandler<R, AppEnv>
) => handler;
```

**Usage:**
```typescript
import { typedHandler } from "../utils/handler";

usersRouter.openapi(
  getUsersRoute,
  typedHandler<typeof getUsersRoute>(async (c) => {
    const { id } = c.req.valid("param"); // Fully typed!
    return c.json({ ... }, 200);
  })
);
```

### Approach 2: Curry/Factory Pattern (Optional but cleaner)
We can also bind the route directly so we don't have to specify `<typeof route>` if we pass the route as the first argument:
```typescript
export const createTypedHandler = <R extends RouteConfig>(
  route: R,
  handler: RouteHandler<R, AppEnv>
) => handler;
```
**Usage:**
```typescript
usersRouter.openapi(
  getUsersRoute,
  createTypedHandler(getUsersRoute, async (c) => {
    // ...
  })
);
```

Since the goal specifically names `typedHandler<R>()` and says "extracts request parameter types from `createRoute()` definitions", **Approach 1** matches the naming convention and explicit generic signature perfectly.

## Execution Plan for Implementation
1. Create `functions/api/utils/handler.ts`.
2. Define the `typedHandler<R>` generic type.
3. (This phase only covers creating the utility. The rollout across the 50+ files will likely be a separate phase, or we can begin applying it if requested, but the goal explicitly says "Create a generic typedHandler<R>() utility... eliminating the need").
4. Actually, if the goal is "Create a generic typedHandler<R>() utility... eliminating the need for as any casts across all 50+ backend route files", we may need to apply it across all files. This is a massive codemod.
5. In this phase we will:
   - Implement the `typedHandler<R>()` utility.
   - Refactor at least one or two routes to prove it works and sets the pattern.
   - Or apply it everywhere if feasible (50+ files might be too much for a single PR, but an AST/Regex codemod could do it).

## Validation Architecture
- **Compile Time:** The codebase must build without errors using `npx tsc --noEmit`.
- **Runtime:** The routes must still execute perfectly (Hono types are erased at runtime, so this is purely a TypeScript change).

## RESEARCH COMPLETE
