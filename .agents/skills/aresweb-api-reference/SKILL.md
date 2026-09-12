---
name: aresweb-api-reference
description: Implement or review ARESWEB backend routes and server-side data contracts.
---

# ARESWEB backend and data

## Locate the affected boundary

Use functions/src/apps/ and functions/src/routes/ for API routes, apiApp.ts
for shared middleware, and firebase.json for Hosting rewrites. For Function
exports or deployment changes, inspect index.ts, functionConfig.ts and
infra/gcp/production-deployment.json. gameServer.ts starts the Cloud Run game
process. web.ts and scheduled Functions have separate entry points.

## Request and data contracts

- Mount routers in the appropriate isolated app using createApiApp.
- Use AuthenticatedRequest and middleware/auth.ts. Active roles are admin,
  coach, mentor and member; legacy normalization does not authorize new roles.
  Reject missing, unknown, unverified or archived authorizations.
- Authenticate, authorize, apply required App Check and rate limits, and validate
  input before expensive parsing or external calls. Prefer Zod at input boundaries.
- Wrap async handlers with asyncHandler, throw ApiError, and use globalErrorHandler.
- Return explicit DTOs; exclude raw document fields, student PII, internal IDs,
  receipt/storage URLs, encryption, audit and secret fields unless the endpoint
  explicitly and safely requires them.
- Bound queries and batches; use stable ordering and cursor pagination. Public
  records must be published and non-deleted. Rules must remain at least as
  restrictive as API authorization.
- Use functions/src/lib/logger.ts with redacted operational context.

## Verify changed behavior

Exercise the complete middleware chain for changed routes, including applicable
success, authentication, role, archived-user, validation, rate-limit and upstream
failure cases. Changed Firestore or Storage permissions require emulator tests.
