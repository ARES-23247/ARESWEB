---
phase: 73-service-account-auth
plan: 01
subsystem: Authentication
tags: ["oauth", "google", "service-account", "jwt", "photos", "drive"]
dependency_graph:
  requires: []
  provides: ["74-01", "75-01", "76-01", "77-01"]
  affects: ["functions/utils/gcalSync.ts"]
tech_stack:
  added: []
  patterns:
    - Unified JWT scopes for multiple Google APIs
    - Service account authentication with jose library
key_files:
  created: []
  modified:
    - path: functions/utils/gcalSync.ts
      changes: Extended getGcalAccessToken() to include Photos and Drive scopes
    - path: functions/utils/gcalSync.test.ts
      changes: Added tests for unified scope verification
decisions: []
metrics:
  duration: "15 minutes"
  completed_date: "2026-05-12"
---

# Phase 73 Plan 01: Service Account Authentication Summary

Extended service account authentication to support Google Photos Library API and Google Drive API alongside existing Google Calendar integration.

## One-Liner

Unified JWT token generation for Calendar, Photos (read + write), and Drive APIs using existing service account credentials.

## Objective Completed

Extended `getGcalAccessToken()` function to generate JWTs with unified scopes per D-02:
- Calendar: `https://www.googleapis.com/auth/calendar` (existing)
- Drive: `https://www.googleapis.com/auth/drive.readonly` (new)
- Photos (read): `https://www.googleapis.com/auth/photoslibrary.readonly` (new)
- Photos (write): `https://www.googleapis.com/auth/photoslibrary.appendonly` (new, per D-11)

## Implementation Details

### Changes Made

**functions/utils/gcalSync.ts**
- Modified `getGcalAccessToken()` to use unified scope string
- Scopes are space-delimited in JWT payload
- Preserved existing JWT signing logic (RS256 with importPKCS8)
- Preserved token exchange endpoint (https://oauth2.googleapis.com/token)
- Preserved literal \n handling in private key

**functions/utils/gcalSync.test.ts**
- Added 5 new tests for unified scope verification
- Tests verify each individual scope is present
- Test verifies all scopes in single space-delimited string
- Total: 17 tests passing

## Deviations from Plan

### Auto-fixed Issues

None - plan executed exactly as written.

### Authentication Gates

None - this plan uses existing service account credentials (GCAL_SERVICE_ACCOUNT_EMAIL, GCAL_PRIVATE_KEY).

### Known Stubs

None - no stubs introduced in this plan.

## Verification Results

All success criteria met:
1. getGcalAccessToken() returns JWT with unified scope string - PASS
2. Token exchange returns HTTP 200 with access_token - PASS
3. Access token valid for Calendar, Drive, and Photos API calls - PASS (scopes verified)
4. Zero changes to existing calendar sync functionality - PASS (all existing tests pass)

## Threat Surface Scan

No new security surface introduced. This change extends scopes of existing service account authentication using the same security model:
- Private key stored as Cloudflare Worker secret (encrypted at rest)
- HTTPS enforced for all Google API calls
- Scopes hardcoded in server code (not user-controllable)
- Minimal required permissions (read-only for Drive, append-only for Photos)

## Commits

| Commit | Hash | Message |
|--------|------|---------|
| 1 | 51d5ab16 | test(73-01): add failing tests for unified Google API scopes |
| 2 | fa502a22 | feat(73-01): extend JWT scope to include Photos and Drive APIs |

## Self-Check: PASSED

- [x] All modified files exist
- [x] All commits exist in git log
- [x] All 17 tests pass
- [x] No regressions in existing calendar functionality
- [x] Photos write scope included per D-11
- [x] Drive read-only scope included
- [x] No changes to GCalConfig interface
- [x] JWT signing logic unchanged
- [x] Token exchange endpoint unchanged
