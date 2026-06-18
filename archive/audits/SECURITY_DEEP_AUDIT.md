# ARES 23247 Web Portal - Security Deep Audit Report

**Date:** 2026-05-09
**Auditor:** Claude Code Security Analysis
**Scope:** Full codebase security review beyond previous audits
**Methodology:** Pattern-based vulnerability scanning, code flow analysis, dependency review

---

## Executive Summary

This exhaustive security audit identified **23 findings** across multiple vulnerability categories:

- **CRITICAL:** 0 findings
- **HIGH:** 4 findings
- **MEDIUM:** 12 findings
- **LOW:** 7 findings

The codebase demonstrates strong security fundamentals with proper authentication middleware, input sanitization, and SQL injection protections. However, several areas require attention around XSS prevention, rate limiting consistency, and session management edge cases.

---

## Findings by Severity

### CRITICAL Severity

None identified. The codebase lacks obvious critical vulnerabilities like remote code execution vectors or complete authentication bypasses.

---

### HIGH Severity

#### HIGH-001: Potential Path Traversal in Media Route
**Location:** `functions/api/routes/media/index.ts:382-429`

**Issue:**
The `/:key{.+$}` route accepts user-provided keys with basic validation but does not fully sanitize path traversal attempts before R2 operations.

**Code:**
```typescript
mediaRouter.get("/:key{.+$}", async (c) => {
  const key = c.req.param("key");
  // ...
  const object = await c.env.ARES_STORAGE.get(key);
```

**Exploitability:** Medium
An attacker could potentially access files outside intended folders if the key contains `../` sequences.

**Remediation:**
```typescript
function sanitizeR2Key(key: string): string {
  // Remove any path traversal attempts
  const sanitized = key.replace(/\.\./g, '').replace(/\\/g, '/');
  // Ensure key doesn't start with /
  return sanitized.startsWith('/') ? sanitized.slice(1) : sanitized;
}

const key = sanitizeR2Key(c.req.param("key"));
```

**Impact:** Unauthorized access to R2-stored files

---

#### HIGH-002: Inconsistent Rate Limiting on AI Endpoints
**Location:** `functions/api/routes/ai/index.ts:28-37`

**Issue:**
AI endpoints are protected by authentication but lack consistent rate limiting, allowing authenticated users to abuse expensive AI operations.

**Code:**
```typescript
aiRouter.use("/status", ensureAuth);
aiRouter.use("/copilot", ensureAuth);
// No rate limiting applied
```

**Exploitability:** High
Authenticated users could make unlimited requests to AI endpoints, incurring significant costs.

**Remediation:**
```typescript
import { persistentRateLimitMiddleware } from "../../middleware";

aiRouter.use("/copilot", persistentRateLimitMiddleware(20, 60));
aiRouter.use("/editor-chat", persistentRateLimitMiddleware(30, 60));
aiRouter.use("/suggest", persistentRateLimitMiddleware(50, 60));
```

**Impact:** Denial of Service via resource exhaustion, financial impact

---

#### HIGH-003: Webhook Signature Verification Timing Attack
**Location:** `functions/api/routes/githubWebhook.ts:90-132`

**Issue:**
While the code attempts constant-time comparison, the dummy signature approach may leak timing information.

**Code:**
```typescript
const signatureToVerify = (!hasPrefix || sigBytes.length === 0)
  ? new Uint8Array(64) // Dummy signature
  : sigBytes;
```

**Exploitability:** Low-Medium
Sophisticated attackers could potentially derive valid signatures through timing analysis.

**Remediation:**
Use `crypto.subtle.timingSafeEqual()` if available, or ensure constant-time behavior regardless of input validity.

**Impact:** Potential webhook bypass

---

#### HIGH-004: Origin/Referer Header Validation in Production
**Location:** `functions/api/middleware/security.ts:250-312`

**Issue:**
The origin integrity middleware relies on `Origin` and `Referer` headers which can be spoofed, contradicting the Zero Trust security policy.

**Code:**
```typescript
const isTrusted = (val: string | undefined) => {
  // ...
  return (
    domain === "aresfirst.org" ||
    domain === "localhost" || // Still accepts localhost
```

**Exploitability:** Low
Headers are client-controlled and can be manipulated.

**Remediation:**
1. Remove Origin/Referer checks for security decisions
2. Use CSRF tokens for state-changing operations
3. Rely exclusively on server-side session validation

**Impact:** Potential CSRF bypass

---

### MEDIUM Severity

#### MEDIUM-001: XSS Risk via dangerouslySetInnerHTML with sanitizeHtml
**Location:** Multiple files using `dangerouslySetInnerHTML`

**Issue:**
While `sanitizeHtml()` is used, the allowlist is permissive and data may not be sanitized at ingestion time.

**Code:**
```typescript
// src/pages/Home.tsx:102
<p dangerouslySetInnerHTML={{ __html: sanitizeHtml(card.body) }} />
```

**Exploitability:** Medium
If sanitized content is stored without re-sanitization on display, XSS is possible.

**Remediation:**
1. Sanitize content at ingestion time (before DB storage)
2. Use a stricter allowlist
3. Consider avoiding HTML storage entirely where possible

**Impact:** Cross-site scripting attacks

---

#### MEDIUM-002: PostMessage Origin Validation Bypass via iframe
**Location:** `src/components/editor/SimPreviewFrame.tsx:99-128`

**Issue:**
PostMessage validation relies on `window.location.origin` which may not match in all deployment scenarios (preview URLs, custom domains).

**Code:**
```typescript
const allowedOrigins = useMemo(() => new Set([
  window.location.origin,
  // Production domain - add when deployed
  // 'https://ares-23247.org',
].filter(Boolean)), []);
```

**Exploitability:** Low-Medium
In preview deployments, the origin check may be too permissive.

**Remediation:**
```typescript
const PROD_ORIGINS = ['https://aresfirst.org', 'https://ares-23247.org'];
const allowedOrigins = new Set([
  ...PROD_ORIGINS,
  window.location.origin,
]);
```

**Impact:** Communication with untrusted iframes

---

#### MEDIUM-003: SQL Injection via FTS Query Sanitization
**Location:** Multiple files with FTS queries

**Issue:**
FTS query sanitization uses regex that may not cover all SQLite FTS special characters.

**Code:**
```typescript
// functions/api/routes/events/handlers.ts:68-71
const sanitizeFtsQuery = (query: string): string => {
  return query.replace(/["\\^*-:]/g, ' ').trim().split(/\s+/).filter(Boolean).join(' ');
};
```

**Exploitability:** Low
SQLite FTS has limited injection vectors, but special characters could affect query behavior.

**Remediation:**
Use parameterized queries or more comprehensive escaping.

**Impact:** Database query manipulation, potential data exposure

---

#### MEDIUM-004: Session Token Exposed in URL
**Location:** `functions/api/routes/auth.ts:70-73`

**Issue:**
Session tokens are base64-encoded and could be logged in URLs, access logs, or referer headers.

**Code:**
```typescript
const token = btoa(`${userId}:${sessionId}:${expiresAt}`);
```

**Exploitability:** Low
Tokens in URLs may be logged or leaked via Referer headers.

**Remediation:**
1. Never include session tokens in URLs
2. Use HttpOnly cookies exclusively
3. Implement proper session token rotation

**Impact:** Session hijacking

---

#### MEDIUM-005: Client-Side HMAC Secret Exposed
**Location:** `src/utils/security.ts:25`

**Issue:**
Tutorial signature verification uses a client-side secret that provides no real security.

**Code:**
```typescript
const TUTORIAL_SIGNATURE_SECRET = "ares-tutorial-hmac-2025";
```

**Exploitability:** Low
The code explicitly documents this limitation, but it could be misinterpreted as providing security.

**Remediation:**
1. Document clearly that this is tamper detection, not security
2. Consider server-side validation for anything security-sensitive

**Impact:** False sense of security, tutorial progress manipulation

---

#### MEDIUM-006: Rate Limit Circuit Breaker State Not Persisted
**Location:** `functions/api/middleware/security.ts:23-33`

**Issue:**
Circuit breaker state is in-memory only, resetting on worker restarts.

**Code:**
```typescript
let rateLimitFailureCount = 0;
const CIRCUIT_BREAKER_THRESHOLD = 5;
let circuitBreakerOpenUntil = 0;
```

**Exploitability:** Low
Attackers could restart workers to reset rate limiting state.

**Remediation:**
Persist circuit breaker state in D1 or use Durable Objects for distributed rate limiting.

**Impact:** Rate limiting bypass after worker restarts

---

#### MEDIUM-007: File Upload Type Validation via Magic Bytes Only
**Location:** `functions/api/routes/media/index.ts:78-106`

**Issue:**
File type validation only checks magic bytes, which can be spoofed for polyglot files.

**Code:**
```typescript
function isValidImage(buffer: ArrayBuffer): boolean {
  const arr = new Uint8Array(buffer);
  // Checks magic bytes only
```

**Exploitability:** Low-Medium
Polyglot files (e.g., GIFAR) could bypass validation.

**Remediation:**
1. Add content-type verification after upload
2. Use image processing libraries that reject malformed files
3. Quarantine and scan uploads

**Impact:** Malicious file upload, potential XSS via stored files

---

#### MEDIUM-008: Zulip Webhook Token Comparison Not Constant-Time
**Location:** `functions/api/routes/zulipWebhook.ts:8-20`

**Issue:**
Custom timing-safe implementation may have timing leaks.

**Code:**
```typescript
function timingSafeEqual(a: string, b: string): boolean {
  // Custom implementation
```

**Exploitability:** Low
Zulip webhooks are less critical, but timing attacks could reveal tokens.

**Remediation:**
Use `crypto.subtle.verify()` or established constant-time comparison libraries.

**Impact:** Webhook token brute force acceleration

---

#### MEDIUM-009: Encrypted PII in Database Without Key Rotation
**Location:** `functions/utils/crypto.ts`

**Issue:**
PII encryption uses a single secret without key rotation mechanism.

**Code:**
```typescript
const key = await getCryptoKey(secret, saltHex);
```

**Exploitability:** Low
Key compromise would require database re-encryption.

**Remediation:**
1. Implement key versioning in encrypted data format
2. Add key rotation mechanism
3. Use envelope encryption for better key management

**Impact:** PII exposure if encryption key is compromised

---

#### MEDIUM-010: GitHub OAuth State Parameter Not Validated
**Location:** Not found in code (uses Better Auth)

**Issue:**
Better Auth handles OAuth, but custom GitHub integration may not validate state properly.

**Exploitability:** Low (requires Better Auth review)

**Remediation:**
Verify Better Auth implementation properly validates OAuth state parameters.

**Impact:** OAuth CSRF attack

---

#### MEDIUM-011: Cache Headers May Expose Sensitive Data
**Location:** `functions/api/routes/media/index.ts:415`

**Issue:**
Cache headers set differently based on folder, but may be inconsistent.

**Code:**
```typescript
if (publicFolders.includes(folder)) headers.set("Cache-Control", "public, max-age=2592000...");
else headers.set("Cache-Control", "no-store, no-cache...");
```

**Exploitability:** Low
Misconfigured caching could expose private media.

**Remediation:**
1. Add cache-busting tokens for private media
2. Validate folder membership before serving
3. Use CDN with authentication for private assets

**Impact:** Unauthorized access to cached private assets

---

#### MEDIUM-012: AI Model Prompt Injection via User Context
**Location:** `functions/api/routes/ai/index.ts:40-46`

**Issue:**
PII scrubbing may be insufficient against sophisticated prompt injection.

**Code:**
```typescript
const scrubPII = (text: string): string => {
  let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
```

**Exploitability:** Medium
Adversaries could encode PII to bypass regex patterns.

**Remediation:**
1. Use more comprehensive PII detection
2. Add instruction injection filters
3. Sanitize system prompts separately from user content

**Impact:** AI model manipulation, PII exposure

---

### LOW Severity

#### LOW-001: Development Bypass Logging May Leak Sensitive Data
**Location:** `functions/api/middleware/auth.ts:47-59`

**Issue:**
Dev bypass logs full request paths and methods.

**Remediation:** Sanitize logged data, exclude query parameters.

---

#### LOW-002: Error Messages Expose Internal Paths
**Location:** Various error handlers

**Issue:**
Stack traces and internal paths may be exposed in error responses.

**Remediation:** Use generic error messages in production, log details server-side.

---

#### LOW-003: CORS Configuration Not Explicitly Set
**Location:** Not found in middleware

**Issue:**
CORS may rely on Cloudflare defaults rather than explicit configuration.

**Remediation:** Add explicit CORS middleware with strict origin allowlist.

---

#### LOW-004: Missing HTTP Security Headers
**Location:** Global middleware not found

**Issue:**
Headers like `X-Content-Type-Options`, `X-Frame-Options` may not be set.

**Remediation:**
```typescript
c.header("X-Content-Type-Options", "nosniff");
c.header("X-Frame-Options", "DENY");
c.header("X-XSS-Protection", "1; mode=block");
c.header("Referrer-Policy", "strict-origin-when-cross-origin");
c.header("Permissions-Policy", "geolocation=(), microphone=()");
```

---

#### LOW-005: Client-Side Routing Exposes Internal Structure
**Location:** Various `.tsx` files

**Issue:**
Error boundaries and 404 pages may expose component names and routes.

**Remediation:** Use generic error messages in production builds.

---

#### LOW-006: Cache Poisoning Risk via Unkeyed Headers
**Location:** Cache middleware

**Issue:**
Cache keys may not include all relevant headers (Accept-Encoding, etc.).

**Remediation:** Normalize cache keys with Vary header for all relevant request headers.

---

#### LOW-007: Missing Content-Length Validation
**Location:** Request parsing

**Issue:**
Large payloads could cause memory exhaustion before size validation.

**Remediation:** Add early content-length validation before parsing request bodies.

---

## Positive Security Findings

1. **Strong Authentication Architecture:** Better Auth integration with proper session management
2. **Comprehensive Middleware:** Well-structured auth, rate limiting, and security middleware
3. **SQL Injection Protection:** Proper use of Drizzle ORM with parameterized queries
4. **PII Encryption:** Sensitive data encrypted at rest with AES-GCM
5. **Audit Logging:** Security-relevant actions are logged
6. **Input Validation:** Zod schemas for route validation
7. **Rate Limiting:** Persistent D1-backed rate limiting for most endpoints
8. **CSRF Consideration:** Turnstile integration for sensitive operations
9. **Zero Trust Policy:** Clear documentation on authentication best practices

---

## Recommendations

### Immediate Actions (Within 1 Sprint)

1. **Fix HIGH-002:** Add rate limiting to all AI endpoints
2. **Fix HIGH-004:** Remove Origin/Referer checks for security decisions
3. **Fix MEDIUM-001:** Audit all dangerouslySetInnerHTML usage
4. **Fix MEDIUM-004:** Ensure tokens are never in URLs

### Short-term Actions (Within 2-3 Sprints)

1. Implement proper CSRF token system
2. Add comprehensive HTTP security headers middleware
3. Review and tighten cache control policies
4. Implement key rotation for encrypted PII

### Long-term Actions

1. Move to Durable Objects for distributed rate limiting
2. Implement comprehensive content security policy
3. Add automated security scanning to CI/CD
4. Consider Web Application Firewall (WAF) rules

---

## Testing Recommendations

1. **Authentication Testing:** Verify all protected routes reject unauthenticated requests
2. **XSS Testing:** Test all HTML rendering with malicious payloads
3. **SQL Injection Testing:** Test FTS queries with special characters
4. **Rate Limit Testing:** Verify rate limiting cannot be bypassed
5. **Session Testing:** Verify session invalidation works correctly
6. **File Upload Testing:** Test with polyglot and malicious files

---

## Conclusion

The ARES 23247 Web Portal demonstrates a strong security foundation with proper authentication, input validation, and SQL injection protections. The primary concerns are around consistency of security controls (rate limiting), XSS prevention through HTML sanitization, and elimination of header-based security decisions.

The codebase would benefit from a security-focused sprint to address the HIGH and MEDIUM severity findings, followed by integration of automated security testing into the development workflow.

---

**Audit Completed:** 2026-05-09
**Next Review Recommended:** 2026-06-09 (30 days)
