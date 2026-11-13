---
name: aresweb-api-reference
description: Implement or review ARESWEB backend routes and server-side data contracts.
---

# ARESWEB backend and data

## Locate the affected boundary

Use `functions/src/apps/` and `functions/src/routes/` for Express API routes,
`functions/src/apiApp.ts` for shared middleware, and `firebase.json` for Hosting
rewrites. For Function exports, secret bindings, or deployment contracts,
inspect `functions/src/index.ts`, `functions/src/functionConfig.ts`,
`infra/gcp/production-deployment.json`, `infra/verification-areas.json`, and
`scripts/deployment-fingerprints.mjs`.

`functions/src/gameServer.ts` (`functions/src/apps/game.ts`) and
`functions/src/biobuzzServer.ts` (`functions/src/apps/biobuzz.ts`) run the
Cloud Run game processes. `functions/src/web.ts` and scheduled Functions have
separate entry points.

## Request and data contracts

- Mount routers in the appropriate isolated app using `createApiApp`.
- Use `AuthenticatedRequest` and `functions/src/middleware/auth.ts`. Active
  canonical roles are `admin`, `coach`, `mentor`, and `member`; legacy
  normalization does not authorize new roles. Reject missing, unknown,
  unverified, or archived authorizations, and call `linkAuthorizedUserByEmail`
  in custom role helpers so newly invited users are linked on first hit.
- Authenticate, authorize, apply required App Check and rate limits, and
  validate path, query, and body inputs with Zod before expensive parsing or
  external calls (`ftcScout`, GitHub, Drive, Gemini).
- Wrap async handlers with `asyncHandler`, throw `ApiError`, and route through
  `globalErrorHandler`. Log redacted context via `functions/src/lib/logger.ts`.
- Return explicit DTOs; never spread raw Firestore documents or expose student
  PII, internal UIDs, receipt/storage URLs, encryption fields, or secrets.
- Bound queries, batches, and soft-delete scan loops (`isDeleted !== 1` filters
  must advance cursors across bounded batches cleanly). Preserve existing
  `isDeleted` fields on updates, enforce stable ordering matching cursors, and
  keep `firestore.rules` / `storage.rules` at least as restrictive as API routes.
- When exporting files (`CSV`), sanitize formula prefixes (`=`, `+`, `-`, `@`).

## Verify changed behavior

Exercise the complete middleware chain for changed routes, including success,
unauthenticated, cross-role, pre-authorized link, archived-user, validation,
rate-limit, pagination, and upstream failure cases. Changed Firestore/Storage
permissions require emulator tests (`pnpm run test:rules` and
`pnpm run test:functions-emulator`), plus `pnpm run check:route-security`.
