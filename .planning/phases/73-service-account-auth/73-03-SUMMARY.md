---
phase: 73-service-account-auth
plan: 03
subsystem: Authentication
tags: ["google-photos", "google-drive", "service-account", "health-check", "api-routers"]
dependency_graph:
  requires: ["73-02"]
  provides: ["74-01", "75-01"]
  affects: ["functions/api/routes/google-photos/index.ts", "functions/api/routes/google-drive/index.ts"]
tech_stack:
  added: []
  patterns:
    - OpenAPIHono router pattern with typedHandler
    - ensureAdmin middleware for zero-trust security
    - Service account authentication via googleAuth utilities
    - Health check endpoints for API verification
key_files:
  created:
    - path: functions/api/routes/google-photos/index.ts
      changes: New Photos API router with health check endpoint
    - path: functions/api/routes/google-photos/index.test.ts
      changes: TDD tests for Photos router (6 tests)
    - path: functions/api/routes/google-drive/index.ts
      changes: New Drive API router with health check endpoint
    - path: functions/api/routes/google-drive/index.test.ts
      changes: TDD tests for Drive router (6 tests)
  modified: []
decisions: []
metrics:
  duration: "8 minutes"
  completed_date: "2026-05-13"
---

# Phase 73 Plan 03: Google Photos and Drive API Routers Summary

Created API router skeletons for Google Photos and Google Drive with service account authentication integration.

## One-Liner

OpenAPIHono routers for Photos and Drive APIs with health check endpoints that verify service account authentication, protected by ensureAdmin middleware.

## Objective Completed

Created `google-photos/index.ts` and `google-drive/index.ts` routers with:
- Health check endpoints that test API authentication via minimal API calls
- ensureAdmin middleware applied to all routes per zero-trust security
- Placeholder routes for future phases (albums in Phase 75, files in Phase 74)
- Token refresh and error handling via getPhotosAccessToken/getDriveAccessToken

## Implementation Details

### Changes Made

**functions/api/routes/google-photos/index.ts** (new file)
- OpenAPIHono router with ensureAdmin middleware on all routes
- GET /health endpoint:
  - Calls getPhotosAccessToken() to get valid token (with lazy refresh)
  - Tests Photos API with POST to mediaItems:search (pageSize: 1)
  - Returns status "ok" with service name and authenticated flag
  - Throws ApiError on 401 or other API failures
- GET /albums placeholder (returns [], for Phase 75)
- Exports photosRouter for registration

**functions/api/routes/google-photos/index.test.ts** (new file)
- 6 TDD tests covering:
  1. GET /health returns 200 with service status
  2. Health endpoint calls Photos API with Bearer token
  3. Router requires admin authentication via ensureAdmin
  4. Token refresh failures trigger retry logic
  5. Exhausted retries throw error
  6. Albums placeholder returns empty array
- Mock implementation for googleAuth and middleware
- All tests passing

**functions/api/routes/google-drive/index.ts** (new file)
- OpenAPIHono router with ensureAdmin middleware on all routes
- GET /health endpoint:
  - Calls getDriveAccessToken() to get valid token (with lazy refresh)
  - Tests Drive API with GET to files?pageSize=1
  - Returns status "ok" with service name and authenticated flag
  - Throws ApiError on 401 or other API failures
- GET /files placeholder (returns [], for Phase 74)
- Exports driveRouter for registration

**functions/api/routes/google-drive/index.test.ts** (new file)
- 6 TDD tests covering:
  1. GET /health returns 200 with service status
  2. Health endpoint calls Drive API with Bearer token
  3. Router requires admin authentication via ensureAdmin
  4. Token refresh failures trigger retry logic
  5. Exhausted retries throw error
  6. Files placeholder returns empty array
- Mock implementation for googleAuth and middleware
- All tests passing

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Authentication Gates

None - this plan uses existing service account credentials (GCAL_SERVICE_ACCOUNT_EMAIL, GCAL_PRIVATE_KEY) that were already configured.

### Known Stubs

**google-photos/index.ts: /albums endpoint**
- File: functions/api/routes/google-photos/index.ts
- Lines: 113-121
- Description: The GET /albums endpoint returns an empty array with a TODO comment. This is intentional per the plan - the endpoint is established for Phase 75 implementation.

**google-drive/index.ts: /files endpoint**
- File: functions/api/routes/google-drive/index.ts
- Lines: 113-121
- Description: The GET /files endpoint returns an empty array with a TODO comment. This is intentional per the plan - the endpoint is established for Phase 74 implementation.

## Verification Results

All success criteria met:
1. Both routers successfully call their respective Google APIs - PASS (tests verify fetch is called with correct URL)
2. Health endpoints return authenticated: true status - PASS
3. Admin middleware blocks unauthenticated requests - PASS (ensureAdmin applied to all routes)
4. Placeholder routes established for future phases - PASS (/albums and /files return empty arrays)
5. Token refresh and error handling working as designed - PASS (getPhotosAccessToken/getDriveAccessToken handle retries)

All 12 tests passing (6 for Photos, 6 for Drive):
- Photos router tests: 6/6 passing
- Drive router tests: 6/6 passing

Full test suite: 2598 passing, 36 skipped, 244 todo (no regressions)

## Threat Surface Scan

New security surface introduced (mitigated per plan):
- New API endpoints at /api/google-photos/* and /api/google-drive/*
- Protected by ensureAdmin middleware (existing security model) - mitigates T-73-14
- Health endpoint returns only status, not access token - mitigates T-73-13
- Service account tokens never exposed to client
- Admin-only access prevents unauthorized API calls

Threat register from plan:
- T-73-13 (S): Token leakage in response - mitigated by not returning token in health response
- T-73-14 (T): API call without auth - mitigated by ensureAdmin on all routes
- T-73-15 (I): Response manipulation - accepted (read-only, validated by Zod schemas)
- T-73-16 (D): D1 settings unavailable - mitigated by retry logic in getOrRefreshToken
- T-73-17 (E): Google API rate limit - accepted (single call per health check)
- T-73-18 (R): Token replay attack - accepted (service account token, low value)

## Commits

| Commit | Hash | Message |
|--------|------|---------|
| 1 | 1eeca95e | test(73-03): add failing tests for Google Photos router |
| 2 | 9b53604c | feat(73-03): implement Google Photos router with health check |
| 3 | d843c182 | test(73-03): add failing tests for Google Drive router |
| 4 | 1de7a9ce | feat(73-03): implement Google Drive router with health check |

## Self-Check: PASSED

- [x] All created files exist
- [x] All commits exist in git log
- [x] All 12 tests pass (6 Photos + 6 Drive)
- [x] No regressions in existing tests (2598 passing)
- [x] Photos router exports photosRouter
- [x] Drive router exports driveRouter
- [x] ensureAdmin middleware applied to all routes
- [x] Health endpoints test Photos/Drive API authentication
- [x] Placeholder routes established for future phases
- [x] Token refresh via googleAuth utilities with retry logic
