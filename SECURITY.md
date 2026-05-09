# ARES Web Portal Security Audit Report

**Audit Date:** 2026-05-09
**Auditor:** Security Audit Agent
**Scope:** Full-stack security review of ARES Web Portal
**ASVS Level:** 2 (Target)
**Environment:** Production

---

## Executive Summary

This comprehensive security audit identified **7 CRITICAL**, **12 HIGH**, **8 MEDIUM**, and **6 LOW** severity issues across the ARES Web Portal codebase. The primary concerns are:

1. **SQL Injection vulnerability** in lifecycle middleware with raw parameter interpolation
2. **Youth data protection gaps** where student PII could be exposed in certain contexts
3. **Authorization bypass risks** in logistics export and analytics endpoints
4. **Header spoofing vulnerabilities** in development bypass detection

All issues have been mapped to specific remediation steps with code references.

---

## Threat Model & Security Architecture

### Zero Trust Identity Verification
- **Authentication:** Better-Auth via `getSessionUser(c)`
- **Authorization:** `ensureAuth` (authenticated) and `ensureAdmin` (admin/author)
- **Session Management:** Cloudflare D1-backed sessions with HMAC-signed tokens
- **RBAC:** Role-based access control with granular path-based checks

### Youth Data Protection (COPPA/YPP)
- **Sanitization:** `sanitizeProfileForPublic()` filters student PII
- **Encryption:** PII fields encrypted at rest using `ENCRYPTION_SECRET`
- **Redaction:** Student emails, phones, and full names never exposed publicly

---

## Critical Findings (BLOCKER)

### CRITICAL-001: SQL Injection in Lifecycle Middleware

**File:** `functions/api/middleware/lifecycle.ts:46, 66, 82, 99, 120`

**Issue:** Raw SQL queries with string interpolation create SQL injection vulnerabilities. The `id` parameter from route params is directly interpolated into SQL statements without sanitization.

```typescript
// VULNERABLE CODE:
await db.run(sql.raw(`UPDATE ${tableName} SET status = 'published' WHERE ${idColumn} = '${id}'`));
```

**Attack Vector:**
```http
PATCH /api/posts/'; DROP TABLE posts; -- /approve
```

**Impact:** Complete database compromise, data deletion, authentication bypass.

**Remediation:**
```typescript
// SECURE PATTERN:
const db = getDb(c);
const table = getTableBuilder(tableName); // Map to Drizzle table
const idValue = c.req.param("id");
await db.update(table)
  .set({ status: "published" })
  .where(eq(table[idColumn], idValue))
  .execute();
```

**References:** `functions/api/middleware/lifecycle.ts:15-132`

---

### CRITICAL-002: Youth PII Exposure in Analytics Leaderboard

**File:** `functions/api/routes/analytics.ts:350-360`

**Issue:** While student names are redacted to "ARES Member", the raw database query still fetches `first_name` and `last_name` which could be exposed through debugging, logs, or future code changes.

```typescript
// Current implementation:
const rows = (results || []) as LeaderboardRow[];
const leaderboard = rows.map((r) => {
  const isMinor = r.member_type === "student";
  return {
    user_id: String(r.user_id),
    first_name: isMinor ? "ARES Member" : String(r.first_name || "ARES"),
    last_name: isMinor ? null : (r.last_name || null),
    // ...
  };
});
```

**Attack Vector:** Memory dumps, error stack traces, or debugging outputs could contain the original student names.

**Impact:** COPPA violation, student PII exposure.

**Remediation:**
```typescript
// Do not SELECT PII fields for students at all
const results = await db.all(sql`
  SELECT
    u.id as user_id,
    CASE WHEN p.member_type = 'student'
      THEN 'ARES Member'
      ELSE u.name
    END as display_name,
    p.nickname,
    p.member_type,
    u.image,
    COUNT(ub.id) as badge_count
  FROM user as u
  INNER JOIN user_profiles as p ON u.id = p.user_id
  INNER JOIN user_badges as ub ON u.id = ub.user_id
  WHERE p.show_on_about = 1
  GROUP BY u.id, p.nickname, p.member_type, u.image
  ORDER BY badge_count DESC
  LIMIT 50
`);
```

**References:** `functions/api/routes/analytics.ts:340-365`

---

### CRITICAL-003: Authorization Bypass in Logistics Email Export

**File:** `functions/api/routes/logistics.ts:59-100`

**Issue:** The `/export-emails` endpoint returns decrypted email addresses and emergency contact information but relies on route-level middleware (`/admin/*`) which may not cover all access patterns.

```typescript
logisticsRouter.use("/admin/*", ensureAdmin);
logisticsRouter.openapi(exportLogisticsEmailsRoute, ...);
```

**Attack Vector:** Direct routing bypass, middleware chain manipulation, or future route additions that don't follow the `/admin/*` pattern.

**Impact:** Export of all user emails and emergency contacts, potential COPPA violation.

**Remediation:**
```typescript
// Add explicit authorization check in handler
logisticsRouter.openapi(exportLogisticsEmailsRoute, typedHandler<typeof exportLogisticsEmailsRoute>(async (c) => {
  const user = c.get("sessionUser");
  if (!user || (user.role !== "admin" && user.member_type !== "mentor" && user.member_type !== "coach")) {
    throw new ApiError("Forbidden: Admin access required", 403);
  }
  // ... rest of handler
}));
```

**References:** `functions/api/routes/logistics.ts:12-100`

---

### CRITICAL-004: Header Spoofing in Development Bypass

**File:** `functions/api/middleware/auth.ts:22-49`

**Issue:** Development bypass checks `hostname` for localhost values which can be spoofed via the `Host` header in requests to preview deployments.

```typescript
const url = new URL(c.req.url);
const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
```

**Attack Vector:** Send request with `Host: localhost` to bypass authentication in preview/production if environment detection fails.

**Impact:** Complete authentication bypass, unauthorized admin access.

**Remediation:**
```typescript
// CR-03 FIX: Only bypass auth in local development, NOT in preview environments
const isDev = c.env.ENVIRONMENT === "development" ||
              ((globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test");
if (!isDev) return false;

const url = new URL(c.req.url);
const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
const enabled = isLocalhost && isDev && (c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1");
```

**Note:** This fix is already partially implemented in lines 25-26 but needs review for edge cases.

**References:** `functions/api/middleware/auth.ts:22-49`

---

### CRITICAL-005: Hardcoded Local Development Secret

**File:** `functions/api/routes/auth.ts:111`

**Issue:** Hardcoded secret used for local development session signing could accidentally be used in production if environment detection fails.

```typescript
secret = "ares-local-dev-secret-do-not-use-in-production";
```

**Impact:** Session token forgery if this secret is used in production.

**Remediation:**
```typescript
if (!secret) {
  throw new ApiError("BETTER_AUTH_SECRET is required in all environments", 500);
}
// Never use hardcoded fallbacks for cryptographic secrets
```

**References:** `functions/api/routes/auth.ts:107-114`

---

### CRITICAL-006: Tutorial HMAC Secret in Source Code

**File:** `src/utils/security.ts:10`

**Issue:** Tutorial signature secret is hardcoded and visible in client-side bundle.

```typescript
const TUTORIAL_SIGNATURE_SECRET = "ares-tutorial-hmac-2025";
```

**Impact:** Tutorial progress signatures can be forged, allowing fake completion claims.

**Remediation:**
```typescript
// Remove tutorial signature validation or use server-side signing
// Tutorial progress should be informational only, not used for authorization
```

**References:** `src/utils/security.ts:10`

---

### CRITICAL-007: GitHub Webhook Signature Verification Timing Attack

**File:** `functions/api/routes/githubWebhook.ts:113-114`

**Issue:** Early return in signature verification that performs a verification operation even when prefix doesn't match.

```typescript
if (!prefixMatches || sigBytes.length === 0) {
  await crypto.subtle.verify("HMAC", key, new Uint8Array(64), enc.encode(payload));
  return false;
}
```

**Impact:** Timing attack vulnerability, unnecessary computation.

**Remediation:**
```typescript
if (!prefixMatches || sigBytes.length === 0) {
  return false;
}
// Only verify signature if format is valid
```

**References:** `functions/api/routes/githubWebhook.ts:90-126`

---

## High Severity Findings

### HIGH-001: Missing Authorization on Analytics Platform Stats

**File:** `functions/api/routes/analytics.ts:368-393`

**Issue:** Platform stats endpoint returns security block counts and integration status without authentication, potentially revealing security posture to attackers.

```typescript
analyticsRouter.openapi(getStatsRoute, typedHandler<typeof getStatsRoute>(async (c) => {
  const db = getDb(c);
  // No authentication check
  const [postsCount, eventsCount, docsCount, securityBlocksRow, dbSettings] = await Promise.all([...]);
```

**Remediation:** Add `ensureAuth` middleware or explicit authentication check.

**References:** `functions/api/routes/analytics.ts:368-393`

---

### HIGH-002: Origin Integrity Middleware Can Be Bypassed

**File:** `functions/api/middleware/security.ts:255-294`

**Issue:** Origin integrity checks skip for requests with both Origin and Referer headers missing. GET requests are also skipped entirely, allowing information disclosure through state-changing GET requests (if any exist).

```typescript
// 1. Skip for GET/OPTIONS/HEAD (read-only or preflight)
if (["GET", "OPTIONS", "HEAD"].includes(c.req.method)) {
  return await next();
}
```

**Remediation:** Review all GET endpoints to ensure no state changes occur. Consider applying origin checks to sensitive GET endpoints like export functions.

**References:** `functions/api/middleware/security.ts:233-295`

---

### HIGH-003: Profile Email/Phone Not Sanitized Before Decryption Check

**File:** `functions/api/routes/profiles.ts:423-428`

**Issue:** The public profile endpoint checks if encrypted values contain ':' before decrypting, but this check happens AFTER the data is already selected from the database and could leak in logs.

```typescript
email: (memberType === "mentor" || memberType === "coach") && Number(profileRow.showEmail || 0) === 1
  ? (profileRow.contactEmail || undefined)
  : undefined,
```

**Remediation:** Apply `sanitizeProfileForPublic()` consistently before any data transformation.

**References:** `functions/api/routes/profiles.ts:401-432`

---

### HIGH-004: Missing CSRF Protection on State-Changing Endpoints

**File:** Multiple route files

**Issue:** While `originIntegrityMiddleware()` is applied to some endpoints, it's not consistently applied to all state-changing operations. Comments routes have it, but other mutation routes may not.

**Remediation:** Audit all POST/PUT/PATCH/DELETE routes and ensure CSRF protection via origin headers or tokens.

**References:** `functions/api/routes/comments.ts:24-41` (good example to follow)

---

### HIGH-005: Rate Limiting Circuit Breaker Fails Open in Non-Production

**File:** `functions/api/middleware/security.ts:62-69, 125-133`

**Issue:** Rate limiting fails open (allows requests) in non-production environments when database errors occur, which could be exploited if environment detection is bypassed.

```typescript
const isProd = /* ... */;
if (!isProd) {
  console.warn("[RateLimit] No database attached, allowing in non-production");
  return true;
}
```

**Remediation:** Make rate limiting mandatory for all environments or use a local in-memory fallback.

**References:** `functions/api/middleware/security.ts:45-135`

---

### HIGH-006: Test Login Endpoint Accessible via Header Bypass

**File:** `functions/api/routes/auth.ts:49-59`

**Issue:** Test login can be enabled via `x-test-bypass-auth` header, which could be exploited if header validation is incomplete.

```typescript
const isTestMode = env.ENVIRONMENT === 'test' ||
                   env.CI === 'true' ||
                   c.req.header('x-test-bypass-auth') === 'true';
```

**Remediation:** Remove header bypass, only use environment variables.

**References:** `functions/api/routes/auth.ts:49-59`

---

### HIGH-007: AI Routes Not Validating Session Before Processing

**File:** `functions/api/routes/ai/index.ts`

**Issue:** AI editor and RAG endpoints rely on Turnstile validation but don't validate user sessions, potentially allowing anonymous AI usage.

**Remediation:** Add `ensureAuth` middleware to AI endpoints.

**References:** `functions/api/routes/ai/index.ts:80-549`

---

### HIGH-008: FTS5 Search Query Sanitization Insufficient

**File:** `functions/api/routes/analytics.ts:401-406`

**Issue:** FTS query sanitization only allows alphanumeric characters but doesn't protect against all SQLite FTS5 special characters and operators.

```typescript
const qClean = (q || "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
```

**Remediation:** Use parameterized queries or more strict sanitization for FTS5.

**References:** `functions/api/routes/analytics.ts:396-426`

---

### HIGH-009: Comment Length Limit Can Be Bypassed

**File:** `functions/api/routes/comments.ts:89-92`

**Issue:** Comment length check uses `rawContent.length` but trimming happens first, potentially allowing different interpretations of length.

```typescript
const rawContent = body.content;
// ...
const content = rawContent.trim();
if (rawContent.length > MAX_INPUT_LENGTHS.comment) {
  throw new ApiError(`Comment exceeds ${MAX_INPUT_LENGTHS.comment} character limit`, 400);
}
```

**Remediation:** Check length after trimming or validate both pre and post-trim lengths.

**References:** `functions/api/routes/comments.ts:76-92`

---

### HIGH-010: User Role Change Doesn't Invalidate All Session Types

**File:** `functions/api/routes/users.ts:164-174`

**Issue:** When user roles change, only some sessions are invalidated. If multiple session types exist, some may remain active with old permissions.

```typescript
if (role) {
  await db.update(schema.user).set({ role }).where(eq(schema.user.id, id));
  await db.delete(schema.session).where(eq(schema.session.userId, id));
```

**Remediation:** Ensure all session types (account, session, etc.) are invalidated.

**References:** `functions/api/routes/users.ts:164-174`

---

### HIGH-011: Emergency Contact Data Not Always Encrypted

**File:** `functions/api/routes/profiles.ts:176-186`

**Issue:** Emergency contact decryption assumes values are always encrypted, but database may contain unencrypted legacy data.

```typescript
const [emergencyContactName, emergencyContactPhone, phone, contactEmail, parentsName, parentsEmail, studentsName, studentsEmail] =
  await Promise.all([
    safeDecrypt(p.emergencyContactName as string | null),
    // ...
  ]);
```

**Remediation:** Check for encryption marker (':') before attempting decryption.

**References:** `functions/api/routes/profiles.ts:176-196`

---

### HIGH-012: Posts Route FTS Query Vulnerable to Boolean Injection

**File:** `functions/api/routes/posts.ts:90-94`

**Issue:** FTS query sanitization doesn't escape quotes properly, allowing boolean query injection.

```typescript
const sanitizeFtsQuery = (query: string): string => {
  const cleanQ = (query || "").replace(/[^\w\s\-.]/g, "").trim();
  if (!cleanQ) return "";
  return `"${cleanQ.replace(/"/g, '""')}*`;
};
```

**Remediation:** Use Drizzle's parameterized queries for FTS5.

**References:** `functions/api/routes/posts.ts:86-131`

---

## Medium Severity Findings

### MEDIUM-001: localStorage Used for Session-Adjacent Data

**Files:** Multiple React components

**Issue:** Tutorial progress and judge codes stored in localStorage, which persists across sessions and could be accessed by malicious scripts if XSS occurs.

**Remediation:** Use sessionStorage with shorter expiration or server-side storage.

**References:** `src/components/InteractiveTutorial.tsx:74-130`, `src/pages/JudgesHub.tsx:27-56`

---

### MEDIUM-002: Error Messages Expose Internal Structure

**File:** `functions/api/middleware/errorHandler.ts:46-54`

**Issue:** Error handler returns detailed error messages that could expose internal implementation details.

```typescript
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
```

**Remediation:** Sanitize error messages for client responses, log details server-side only.

**References:** `functions/api/middleware/errorHandler.ts:127-151`

---

### MEDIUM-003: Missing Content-Type Validation on Some Routes

**Issue:** Not all POST/PUT/PATCH routes validate Content-Type headers before parsing JSON.

**Remediation:** Apply `contentTypeValidationMiddleware()` globally.

**References:** `functions/api/middleware/security.ts:348-362` (middleware exists but not universally applied)

---

### MEDIUM-004: Audit Log Not Enforced on All Sensitive Operations

**Issue:** Some sensitive operations don't log to `auditLog` table, making security incident investigation difficult.

**Remediation:** Add audit logging to all: role changes, PII access, data exports, authentication failures.

**References:** `functions/api/middleware/auth.ts:102-113` (example of good audit logging)

---

### MEDIUM-005: Hard Delete Still Available in Lifecycle Router

**File:** `functions/api/middleware/lifecycle.ts:111-129`

**Issue:** Despite soft-delete policy, hard DELETE operation still exists via purge endpoint.

```typescript
router.delete("/:id/purge", async (c) => {
  // ...
  await db.run(sql.raw(`DELETE FROM ${tableName} WHERE ${idColumn} = '${id}'`));
```

**Remediation:** Require additional confirmation or separate authentication for purge operations.

**References:** `functions/api/middleware/lifecycle.ts:111-129`

---

### MEDIUM-006: Turnstile Token Extraction Can Fail Silently

**File:** `functions/api/middleware/security.ts:309-323`

**Issue:** Turnstile token extraction catches errors but doesn't differentiate between missing token and parsing errors.

```typescript
try {
  if (contentType.includes("application/json")) {
    const clonedReq = c.req.raw.clone();
    const body = await clonedReq.json() as { turnstileToken?: string };
    token = body.turnstileToken;
  }
} catch (err) {
  console.error("[Turnstile] Token extraction failed:", err);
}
```

**Remediation:** Fail closed when token extraction fails in production.

**References:** `functions/api/middleware/security.ts:301-342`

---

### MEDIUM-007: Session User Cache Could Become Stale

**File:** `functions/api/middleware/auth.ts:147-154`

**Issue:** Session user caching (`c.get("sessionUser")`) doesn't account for mid-session role/permission changes.

**Remediation:** Implement cache invalidation on role changes or use shorter cache TTL.

**References:** `functions/api/middleware/auth.ts:147-154`

---

### MEDIUM-008: Missing Request Size Limits

**Issue:** No global request size limit middleware exists, allowing potential DoS via large request bodies.

**Remediation:** Add request size limit middleware (e.g., 10MB max).

**References:** `functions/api/[[route]].ts` (add to main middleware chain)

---

## Low Severity Findings

### LOW-001: Verbose Console Logging in Production

**Files:** Multiple files

**Issue:** Extensive console logging could expose sensitive information in production logs.

**Remediation:** Implement log levels and sanitize sensitive data from logs.

---

### LOW-002: Missing HTTP Security Headers

**Issue:** Some security headers (CSP, X-Frame-Options, etc.) may not be set consistently.

**Remediation:** Add security headers middleware.

---

### LOW-003: No Account Lockout on Failed Authentication

**File:** `functions/api/routes/auth.ts:11-16` (commented)

**Issue:** No account lockout mechanism after repeated failed login attempts.

**Remediation:** Implement progressive delays and account lockout.

---

### LOW-004: Decryption Failure Returns Static String

**File:** Multiple files using `decrypt()`

**Issue:** Decryption failures return "[Decryption Failed]" which could be confusing to users.

**Remediation:** Return null and handle gracefully in UI.

---

### LOW-005: Email/Phone Validation Not Enforced

**Issue:** Email and phone formats aren't validated before encryption/storage.

**Remediation:** Add format validation with Zod schemas.

---

### LOW-006: Missing OpenAPI Security Documentation

**Issue:** OpenAPI route definitions don't consistently document security requirements.

**Remediation:** Add security schemes to OpenAPI specs.

---

## Accepted Risks

### ACCEPT-001: Development Bypass with Audit Logging
**Disposition:** Accept - Audit logging ensures accountability, bypass only in localhost development.

### ACCEPT-002: Public Read-Only Endpoints
**Disposition:** Accept - Public data (blog posts, events, team roster) is intentionally accessible without authentication.

### ACCEPT-003: Turnstile Bypass in Non-Production
**Disposition:** Accept - CAPTCHA only needed in production to prevent automated abuse.

---

## Security Testing Recommendations

1. **SQL Injection Testing:** Test lifecycle endpoints with malicious payloads like `'; DROP TABLE--`
2. **Authentication Bypass Testing:** Attempt header spoofing (`Host: localhost`) in preview environments
3. **PII Exposure Testing:** Verify student data never appears in API responses or logs
4. **CSRF Testing:** Test state-changing endpoints without Origin/Referer headers
5. **Rate Limit Testing:** Verify rate limiting works correctly under load
6. **FTS5 Injection Testing:** Test search endpoints with FTS5 special characters

---

## Compliance Status

### COPPA (Children's Online Privacy Protection Act)
- **Status:** Partially Compliant
- **Gaps:** Student PII selected before filtering (CRITICAL-002), potential exposure in logs

### GDPR
- **Status:** Largely Compliant
- **Gaps:** Right to erasure not fully implemented (hard delete exists), data export needs review

### ASVS Level 2
- **Status:** In Progress
- **Gaps:** Input validation, authentication, session management, access control all have identified issues

---

## Next Steps

1. **Immediate (Blocker):** Fix SQL injection in lifecycle middleware (CRITICAL-001)
2. **High Priority:** Fix authentication bypass vulnerabilities (CRITICAL-003, CRITICAL-004)
3. **High Priority:** Review and fix youth data exposure (CRITICAL-002)
4. **Medium Priority:** Implement remaining CSRF protections
5. **Low Priority:** Add comprehensive logging and monitoring

**Threats Open:** 7 critical, 12 high

---

**Generated by:** Security Audit Agent
**Report Version:** 1.0
**Classification:** INTERNAL USE ONLY
