# Phase 71: API Route Hardening

Goal: Achieve 100% type inference for the Hono RPC client by aligning backend return types and hardening the frontend client wrapper.

## Proposed Changes

### Frontend Infrastructure

#### [MODIFY] [honoClient.ts](file:///c:/Users/david/dev/robotics/ftc/ARESWEB/src/api/honoClient.ts)
- Update `baseClient` to use `hc<AppType>("/api", ...)` directly.
- Remove redundant dummy client intersections (`c1`, `c2`, etc.).
- Update `unwrapResponse` to extract `details` and `code` from error responses.
- Enhance `ApiError` to include optional `details` for better debugging.

### Backend Entry Point

#### [MODIFY] [[[route]].ts](file:///c:/Users/david/dev/robotics/ftc/ARESWEB/functions/api/[[route]].ts)
- Remove `as any` from the `routes` constant.
- Remove `any` from the `auditLogRoute` handler.
- Fix any type errors arising from the search results mapping.

### Backend Domain Routers

#### [MODIFY] Systematic Alignments
Sweep all files in `functions/api/routes/` to:
- Remove `as any` from `c.json()` calls.
- Ensure the data returned by handlers matches the Zod schema defined in `.openapi()`.
- Common targets: `auth/index.ts`, `finance/index.ts`, `posts/index.ts`, `events/index.ts`, `simulations/index.ts`, etc.

## Verification Plan

### Automated Tests
- `npx tsc --noEmit`: Ensure zero TypeScript errors across both `src/` and `functions/`.
- `npx eslint .`: Ensure zero linting errors.
- `npm test`: Run existing API tests to ensure no regressions in response handling.

### Manual Verification
- Trigger a validation error (e.g., submit an empty form) and verify the browser console shows structured error details.
