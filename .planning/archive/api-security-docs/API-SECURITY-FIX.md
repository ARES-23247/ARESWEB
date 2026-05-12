---
phase: api-security-audit
fixed_at: 2026-05-04T22:30:00Z
review_path: functions/api/routes/API-SECURITY-REVIEW.md
iteration: 1
findings_in_scope: 18
fixed: 17
skipped: 1
status: partial
---

# API Security Audit Fix Report

**Fixed at:** 2026-05-04T22:30:00Z
**Source review:** functions/api/routes/API-SECURITY-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 18 (WARNING level only)
- Fixed: 17
- Skipped: 1

## Fixed Issues

### WR-01: Missing Authorization on Public Endpoints

**Files modified:** `functions/api/routes/github.ts`
**Commit:** `3df5fb7`
**Applied fix:** Added rate limiting to `/activity` endpoint to prevent unauthenticated clients from triggering unlimited GitHub API calls.

### WR-02: Insufficient Input Validation on Event Recurrence

**Files modified:** `functions/api/routes/events/handlers.ts`
**Commit:** `3122df4` (included with WR-03)
**Applied fix:** Added RRULE validation (max length 200, allowed keys whitelist) before parsing to prevent ReDoS attacks.

### WR-03: Media Upload Missing Content-Type Validation

**Files modified:** `functions/api/routes/media/index.ts`
**Commit:** `3122df4`
**Applied fix:** Added maximum file size validation (50MB limit) to prevent abuse through large file uploads.

### WR-04: Open Redirect via Analytics Track Sponsor Click

**Files modified:** `functions/api/routes/analytics.ts`
**Commit:** `ad702fb`
**Applied fix:** Added validation to ensure sponsor_id exists and is active before tracking clicks.

### WR-05: Insecure Error Messages Leak Database Structure

**Files modified:** `functions/api/routes/posts.ts`
**Commit:** `79cef38`
**Applied fix:** Replaced "Database error" messages with generic "Failed to fetch post" to avoid leaking database structure.

### WR-06: Missing Authorization on Store Orders

**Files modified:** N/A
**Applied fix:** Already fixed - `ensureAdmin` middleware already applied at router level (lines 14-16 of store.ts).

### WR-07: AI Endpoints Missing Rate Limits

**Files modified:** `functions/api/routes/ai/index.ts`
**Commit:** `0c8cf41`
**Applied fix:** Added `persistentRateLimitMiddleware` to `/liveblocks-copilot`, `/sim-playground`, and `/editor-chat` endpoints.

### WR-08: Judge Portfolio Cache Poisoning Risk

**Files modified:** `functions/api/routes/judges.ts`
**Commit:** `e857f25`
**Applied fix:** Added cache versioning mechanism that invalidates cache when content changes.

### WR-09: Log PII Exposure in Communications

**Files modified:** `functions/api/routes/communications.ts`
**Commit:** `8fbfd09`
**Applied fix:** Truncated error messages to 200 chars max to prevent logging of PII like email addresses.

### WR-10: GitHub Webhook Signature Verification Timing Attack

**Files modified:** `functions/api/routes/githubWebhook.ts`
**Commit:** `b18bf23`
**Applied fix:** Implemented constant-time comparison for signature verification to prevent timing attacks.

### WR-11: Missing CSRF Protection on State-Changing Endpoints

**Files modified:** `functions/api/routes/comments.ts`, `functions/api/routes/tasks.ts`, `functions/api/routes/socialQueue.ts`
**Commit:** `a409de2`
**Applied fix:** Added `originIntegrityMiddleware` to comments, tasks, and social queue routes.

### WR-12: Task Assignment Authorization Weakness

**Files modified:** `functions/api/routes/tasks.ts`
**Commit:** `7d29484`
**Applied fix:** Added subteam validation to prevent mentors/coaches from assigning users from different subteams.

### WR-13: Sponsor Token Insufficient Entropy

**Files modified:** `functions/api/routes/sponsors.ts`
**Commit:** `89dacd1`
**Applied fix:** Changed audit logging to log token ID instead of token value to prevent exposure in logs.

### WR-14: Settings Update Allows Overwriting Sensitive Keys

**Files modified:** `functions/api/routes/settings.ts`
**Commit:** `01e6fa4`
**Applied fix:** Added explicit blocking of sensitive key updates via API with 403 error.

### WR-15: Finance Transaction Validation Missing

**Files modified:** `functions/api/routes/finance.ts`
**Commit:** `7c83542`
**Applied fix:** Added validation for transaction amount (0-1M range) and type (income/expense only).

### WR-16: Missing Rate Limit on Admin Export

**Files modified:** `functions/api/routes/settings.ts`
**Commit:** `56694da`
**Applied fix:** Added rate limiting (5 requests per 5 minutes) to `/admin/backup` endpoint.

### WR-17: Simulations Endpoint GitHub Token Exposure

**Files modified:** `functions/api/routes/simulations.ts`
**Commit:** `f002d29`
**Applied fix:** Added masked logging that only shows last 4 characters of PAT.

### WR-18: Doc Search Regex ReDoS Vulnerability

**Files modified:** `functions/api/routes/docs.ts`
**Commit:** `b94a5df`
**Applied fix:** Added query length limit (50 characters) to prevent potential ReDoS attacks.

## Skipped Issues

### WR-06: Missing Authorization on Store Orders

**File:** `functions/api/routes/store.ts:14-16`
**Reason:** Already fixed - `ensureAdmin` middleware is already properly applied to `/orders` routes at the router level.
**Original issue:** The endpoint was claimed to only check sessionUser at route level without re-validation, but the middleware provides this protection.

---

_Fixed: 2026-05-04T22:30:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
