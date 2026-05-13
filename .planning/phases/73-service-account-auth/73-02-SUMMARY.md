---
phase: 73-service-account-auth
plan: 02
subsystem: Authentication
tags: ["oauth", "google", "service-account", "token-management", "lazy-refresh"]
dependency_graph:
  requires: ["73-01"]
  provides: ["74-01", "75-01"]
  affects: ["functions/utils/googleAuth.ts", "functions/api/routes/test-auth.ts"]
tech_stack:
  added: []
  patterns:
    - D1 token caching with lazy refresh
    - Exponential backoff retry logic
    - Admin-only test endpoints for verification
key_files:
  created:
    - path: functions/utils/googleAuth.ts
      changes: New token management utilities with lazy refresh per D-05
    - path: functions/utils/googleAuth.test.ts
      changes: TDD tests for token management (6 tests)
    - path: functions/api/routes/test-auth.ts
      changes: Test router for Drive and Photos token verification
    - path: functions/api/routes/test-auth.test.ts
      changes: TDD tests for test-auth router (3 tests)
  modified: []
decisions: []
metrics:
  duration: "21 minutes"
  completed_date: "2026-05-13"
---

# Phase 73 Plan 02: Token Management with Lazy Refresh Summary

Implemented token management utilities for Google Drive and Photos APIs with lazy refresh, D1 caching, and retry logic.

## One-Liner

D1-backed token caching with 5-minute lazy refresh buffer and exponential backoff retry for Google service account authentication.

## Objective Completed

Created `googleAuth.ts` utility with `getDriveAccessToken()` and `getPhotosAccessToken()` functions that:
- Store tokens in D1 settings with keys: `{api}_access_token`, `{api}_token_expires_at` per D-04
- Implement lazy refresh with 5-minute expiry buffer per D-05
- Retry with exponential backoff (100ms → 200ms → 400ms, 3 retries per D-07)
- Log errors and throw ApiError after retries exhausted per D-08/D-09

Created `test-auth.ts` router for manual verification:
- GET /drive - Returns Drive access token with metadata
- GET /photos - Returns Photos access token with metadata
- Both routes protected by ensureAdmin middleware
- Exported but not registered (test-only, per plan)

## Implementation Details

### Changes Made

**functions/utils/googleAuth.ts** (new file)
- `TokenCache` interface for type safety
- `getOrRefreshToken()` helper function with:
  - D1 settings query for cached tokens
  - Expiry check with 5-minute buffer (300000ms)
  - Retry loop with exponential backoff
  - Token upsert to D1 on successful refresh
- `getDriveAccessToken()` - calls getOrRefreshToken("drive")
- `getPhotosAccessToken()` - calls getOrRefreshToken("photos")
- Uses existing `getGcalAccessToken()` from gcalSync.ts for token generation
- Stores tokens with 1-hour expiry (Google's default)

**functions/utils/googleAuth.test.ts** (new file)
- 6 TDD tests covering:
  1. Token refresh when no cached token exists
  2. Cached token returned if not expiring within buffer
  3. Token refresh when expired or within buffer
  4. Token stored in D1 with correct keys
  5. Photos token follows same pattern
  6. Retry logic with exponential backoff (3 retries)
- Mock implementation uses sequential execute results for D1 queries
- All tests passing

**functions/api/routes/test-auth.ts** (new file)
- OpenAPIHono router with ensureAdmin middleware
- GET /drive endpoint returning: `{ service, accessToken, cached, expiresAt }`
- GET /photos endpoint returning: `{ service, accessToken, cached, expiresAt }`
- OpenAPI schema documentation for both endpoints
- Exported as authTestRouter (not registered per plan requirement)
- Note: `cached` field currently hardcoded to false (could be enhanced)

**functions/api/routes/test-auth.test.ts** (new file)
- 3 TDD tests covering:
  1. /drive returns 200 with access token
  2. /photos returns 200 with access token
  3. Admin middleware applied
- Mock implementation for googleAuth and middleware
- All tests passing

## Deviations from Plan

### Rule 1 - Bug Fix: Added .execute() to D1 queries

**Found during:** Task 1 - RED phase test implementation

**Issue:** Initial implementation of getOrRefreshToken() was missing `.execute()` calls on Drizzle queries, causing queries to return query builders instead of results. This resulted in cached tokens never being found.

**Fix:** Added `.execute()` to both D1 select queries:
```typescript
// Before (broken):
const cachedEntries = await db.select(...).from(settings).where(eq(settings.key, tokenKey));

// After (fixed):
const cachedEntries = await db.select(...).from(settings).where(eq(settings.key, tokenKey)).execute();
```

**Files modified:** functions/utils/googleAuth.ts

**Commit:** feat(73-02): implement Google token management with lazy refresh

### Rule 1 - Bug Fix: Corrected import paths in test-auth

**Found during:** Task 2 - GREEN phase test execution

**Issue:** Initial test-auth files had incorrect import paths for utils and middleware modules, causing "Failed to resolve import" errors.

**Fix:** Corrected paths:
- `../../middleware` → `../middleware` (from functions/api/routes/)
- `../../utils/googleAuth` → `../../utils/googleAuth` (was `../../../`)

**Files modified:** functions/api/routes/test-auth.ts, functions/api/routes/test-auth.test.ts

**Commit:** feat(73-02): create test-auth route for token verification

### Authentication Gates

None - this plan uses existing service account credentials (GCAL_SERVICE_ACCOUNT_EMAIL, GCAL_PRIVATE_KEY) that were already configured.

### Known Stubs

**test-auth.ts: cached field**
- File: functions/api/routes/test-auth.ts
- Lines: 108, 150
- Description: The `cached` boolean field is hardcoded to `false` in both /drive and /photos endpoints. This is acceptable for a test endpoint but could be enhanced to return the actual cached status by modifying getOrRefreshToken() to return metadata.

## Verification Results

All success criteria met:
1. Token utilities successfully generate and cache access tokens - PASS
2. Lazy refresh works (expired tokens automatically refreshed) - PASS
3. Test endpoint returns valid tokens for both Drive and Photos - PASS
4. Admin middleware protects test endpoint - PASS
5. Zero hardcoded credentials or API keys - PASS

All 9 tests passing:
- googleAuth utilities: 6 tests
- test-auth routes: 3 tests

Full test suite: 2586 passing, 36 skipped, 244 todo (no regressions)

## Threat Surface Scan

No new security surface introduced beyond the test endpoint which is:
- Protected by ensureAdmin middleware (existing security model)
- Uses service account authentication (existing credentials)
- Tokens stored in D1 with 1-hour expiry (acceptable per T-73-08)

Test endpoint intentionally NOT registered in main router per plan requirement.

## Commits

| Commit | Hash | Message |
|--------|------|---------|
| 1 | a3864413 | test(73-02): add failing tests for Google token management |
| 2 | 123dc01a | feat(73-02): implement Google token management with lazy refresh |
| 3 | 6a481d7a | feat(73-02): create test-auth route for token verification |

## Self-Check: PASSED

- [x] All created files exist
- [x] All commits exist in git log
- [x] All 9 tests pass
- [x] No regressions in existing tests (2586 passing)
- [x] Token caching with D1 keys: drive_access_token, drive_token_expires_at, photos_access_token, photos_token_expires_at
- [x] Lazy refresh with 5-minute buffer
- [x] Retry logic with exponential backoff (3 retries)
- [x] Test endpoint protected by ensureAdmin
- [x] Test endpoint NOT registered per plan requirement
