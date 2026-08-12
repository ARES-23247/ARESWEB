---
name: aresweb-api-reference
description: Implement or review ARESWEB Cloud Functions, Express routes, Firestore access, Storage access, API DTOs, authorization middleware, and backend error handling. Use for changes under functions/src, API documentation, or server-side data contracts.
---

# ARESWEB backend and data

Derive the active route inventory from `functions/src/index.ts` and the routers in
`functions/src/routes/`. Do not copy endpoint lists from planning archives or old
documentation.

## Request pipeline

- Mount every handler through the shared Express application.
- Apply authentication, authorization, App Check when required, rate limiting,
  and validation before expensive parsing or external calls.
- Use `AuthenticatedRequest` and the middleware in
  `functions/src/middleware/auth.ts`.
- Treat `admin`, `coach`, `mentor`, and `member` as the canonical active roles.
  Legacy-role normalization is a migration bridge, not permission to add roles.
- Reject missing, unknown, unverified, or archived authorizations.
- Wrap async handlers with `asyncHandler`; throw `ApiError`; let
  `globalErrorHandler` produce the response.

## Data contracts

- Validate path, query, and body values at the boundary, preferably with Zod.
- Return explicit DTOs. Never spread raw Firestore documents into responses.
- Exclude student PII, internal IDs, receipt or storage URLs, encryption fields,
  audit metadata, and secret configuration unless the endpoint explicitly and
  safely requires a field.
- Use bounded queries, stable ordering, cursor pagination, and bounded batches.
- Filter public records to published and non-deleted states on the server.
- Keep Firestore and Storage rules at least as restrictive as API authorization.

## Diagnostics and tests

- Use `functions/src/lib/logger.ts`; never use request bodies or personal data as
  diagnostic context.
- Test the complete middleware chain, not only the final route handler.
- Add emulator rule tests for every changed Firestore or Storage permission.
- Verify successful, unauthenticated, unauthorized, invalid, archived, rate
  limited, and upstream-failure paths.
