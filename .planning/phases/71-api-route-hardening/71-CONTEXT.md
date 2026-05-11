# Phase 71: API Route Hardening - Context

**Gathered:** 2026-05-11
**Status:** Ready for planning
**Goal:** Achieve 100% type inference for the Hono RPC client by aligning backend return types and hardening the frontend client wrapper.

<domain>
## Phase Boundary
This phase focuses on the "last mile" of end-to-end type safety. We will eliminate the `any` type on the Hono RPC client, align backend handler returns with their OpenAPI schemas, and improve frontend error diagnostics.
</domain>

<decisions>
## Implementation Decisions

### 1. Unified Hono Client
- **Consolidation**: We will remove the `group1`...`group4` "dummy client" pattern in `src/api/honoClient.ts`.
- **Direct Inference**: Use `hc<AppType>("/api", ...)` directly.
- **Rationale**: Chaining is now standardized via `.openapi()`, so the combined type should be more manageable for the TypeScript compiler.

### 2. Full Handler Return Type Alignment
- **"Hard Work" Commitment**: We will systematically visit all 30+ router files in `functions/api/routes/`.
- **`as any` Removal**: Remove `as any` from all `c.json()` calls.
- **Type Enforcement**: If a Drizzle query result doesn't match the Zod schema, we will explicitly cast to the Zod schema type (or fix the query) instead of using `any`. This ensures the frontend receives exactly what is promised in the spec.

### 3. Hardened `unwrapResponse` & Error Diagnostics
- **Detailed Errors**: `unwrapResponse` in `src/api/honoClient.ts` will be updated to handle the standardized error schema (`{ error: string, code?: string, details?: unknown }`).
- **Validation Details**: For `400 Bad Request` errors, the `details` (containing field-specific Zod validation errors) will be extracted and included in the thrown `ApiError`, facilitating better frontend debugging and form validation.

### 4. Route Entry Point Cleanup
- **`[[route]].ts`**: Remove the final `as any` cast from the `routes` definition once all sub-routers are aligned.
</decisions>

<code_context>
## Existing Code Insights
- **Standardized Error Structure**: `shared/errors/api.ts` defines the response shape for errors.
- **Central Client**: `src/api/honoClient.ts` is the single point of truth for frontend API calls.
- **Middleware**: `functions/api/middleware/errorHandler.ts` handles the backend error transformations.
</code_context>

<specifics>
## Specific Ideas
- **Diagnostics**: Ensure `ApiError` in the frontend captures `details` for logging to the console during development.
</specifics>

<deferred>
## Deferred Ideas
- **Automated Client Generation**: Moving to a fully generated client from the JSON spec (outside of Hono RPC) is deferred.
</deferred>
