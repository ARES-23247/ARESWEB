# Phase 38: Typed Hono Handler Wrapper - Plan

## 1. Create `typedHandler` Utility
- **File:** `functions/api/utils/handler.ts` (new)
- **Action:** Create a utility that wraps route handlers to provide type safety based on Zod OpenAPI schemas without `as any` casts.
- **Implementation:**
  ```typescript
  import type { RouteConfig, RouteHandler } from "@hono/zod-openapi";
  import type { AppEnv } from "../middleware";

  /**
   * Type-safe wrapper for Hono OpenAPI handlers.
   * Extracts parameter/query/body types from the RouteConfig and eliminates the need for `as any` or manual casting.
   */
  export const typedHandler = <R extends RouteConfig>(
    handler: RouteHandler<R, AppEnv>
  ) => handler;
  ```

## 2. Refactor Existing Backend Routes
- **Files:** All `functions/api/routes/*.ts`
- **Action:** Replace existing manual casting patterns with `typedHandler`.
- **Changes:**
  - Remove imports like `type AppRouteHandler` where unused.
  - Update handlers from:
    ```typescript
    usersRouter.openapi(route, (async (c) => { ... }) as AppRouteHandler<typeof route>);
    ```
    To:
    ```typescript
    usersRouter.openapi(route, typedHandler<typeof route>(async (c) => { ... }));
    ```
  - For handlers with `async (c: any) =>`, update to use `typedHandler`:
    ```typescript
    docsRouter.openapi(route, typedHandler<typeof route>(async (c) => { ... }));
    ```
- **Scale:** Apply across 50+ route files.

## 3. [BLOCKING] Verification
- **Action:** Run `npx tsc --noEmit` and ensure it passes successfully with zero errors across the backend.
- **Action:** Run `npm run test:unit` to ensure test execution is unimpacted.
