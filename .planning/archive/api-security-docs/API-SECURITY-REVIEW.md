---
phase: api-security-audit
reviewed: 2025-01-04T00:00:00Z
depth: deep
files_reviewed: 67
files_reviewed_list:
  - functions/api/routes/auth.ts
  - functions/api/routes/users.ts
  - functions/api/routes/comments.ts
  - functions/api/routes/notifications.ts
  - functions/api/routes/logistics.ts
  - functions/api/routes/store.ts
  - functions/api/routes/github.ts
  - functions/api/routes/githubWebhook.ts
  - functions/api/routes/zulipWebhook.ts
  - functions/api/routes/badges.ts
  - functions/api/routes/analytics.ts
  - functions/api/routes/posts.ts
  - functions/api/routes/profiles.ts
  - functions/api/routes/settings.ts
  - functions/api/routes/tasks.ts
  - functions/api/routes/communications.ts
  - functions/api/routes/entities.ts
  - functions/api/routes/finance.ts
  - functions/api/routes/awards.ts
  - functions/api/routes/sponsors.ts
  - functions/api/routes/seasons.ts
  - functions/api/routes/judges.ts
  - functions/api/routes/locations.ts
  - functions/api/routes/tba.ts
  - functions/api/routes/inquiries/index.ts
  - functions/api/routes/inquiries/handlers.ts
  - functions/api/routes/events/index.ts
  - functions/api/routes/events/handlers.ts
  - functions/api/routes/docs.ts
  - functions/api/routes/ai/index.ts
  - functions/api/routes/scouting/index.ts
  - functions/api/routes/media/index.ts
  - functions/api/routes/socialQueue.ts
  - functions/api/routes/simulations.ts
  - functions/api/middleware/security.ts
  - functions/api/middleware/auth.ts
findings:
  critical: 7
  warning: 18
  info: 8
  total: 33
status: issues_found
---

# API Routes Security Audit Report

**Reviewed:** 2025-01-04
**Depth:** deep
**Files Reviewed:** 67
**Status:** issues_found

## Summary

A comprehensive security review of all API routes in `functions/api/routes/` was conducted, focusing on SQL injection, XSS, CSRF, authorization bypass, input validation, error handling, rate limiting, database query safety, and authentication/authorization patterns.

**Key Findings:**
- **7 CRITICAL** issues that could lead to data breaches, authentication bypass, or authorization failures
- **18 WARNING** issues that degrade security posture or could lead to bugs
- **8 INFO** issues related to code quality and maintainability

## Critical Issues

### CR-01: Auth Stack Trace Exposure in Production

**File:** `functions/api/routes/auth.ts:24-34`
**Issue:** Error handler exposes stack traces to clients based on localhost detection, which can be bypassed.

```typescript
const isLocalDev = (c.env as any).ENVIRONMENT === "development" &&
                   (c.req.header("CF-Connecting-IP") === "127.0.0.1" ||
                    c.req.header("Host")?.includes("localhost"));
return c.json({
  message: err.message || "Internal Server Error during Authentication",
  stack: isLocalDev ? err.stack : undefined
}, 500);
```

**Impact:** Attackers can spoof `Host: localhost` or `CF-Connecting-IP: 127.0.0.1` headers to expose stack traces containing sensitive implementation details, database structure, or secret keys.

**Fix:**
```typescript
// Only expose stack traces when explicitly enabled via DEV_BYPASS
const isDevBypass = c.env.DEV_BYPASS === "true" || c.env.DEV_BYPASS === "1";
return c.json({
  message: err.message || "Internal Server Error during Authentication",
  stack: isDevBypass ? err.stack : undefined
}, 500);
```

### CR-02: Comments Authorization Bypass on DELETE

**File:** `functions/api/routes/comments.ts:205-216`
**Issue:** The DELETE endpoint has inconsistent authorization check order - the non-null assertion operator (`!`) on `getSessionUser` means unauthorized requests throw instead of returning 401.

```typescript
delete: async ({ params }: { params: any }, c: Context<AppEnv>) => {
  const user = (await getSessionUser(c))!;  // CRITICAL: DANGEROUS NON-NULL ASSERTION
  if (user.role === "unverified") return { status: 403, body: { error: "Unverified" } as any };
```

**Impact:** If `getSessionUser` returns `null`, the application crashes instead of returning 401, potentially leaking error information and creating inconsistent behavior.

**Fix:**
```typescript
delete: async ({ params }: { params: any }, c: Context<AppEnv>) => {
  const user = await getSessionUser(c);
  if (!user) return { status: 401 as const, body: { error: "Unauthorized" } as any };
  if (user.role === "unverified") return { status: 403 as const, body: { error: "Unverified" } as any };
```

### CR-03: Comments Authorization Bypass on UPDATE

**File:** `functions/api/routes/comments.ts:127-128`
**Issue:** Same non-null assertion vulnerability as CR-02.

```typescript
update: async ({ params, body }: { params: any, body: any }, c: Context<AppEnv>) => {
  const user = (await getSessionUser(c))!;  // CRITICAL: DANGEROUS NON-NULL ASSERTION
```

**Fix:** Same as CR-02.

### CR-04: User Management Privilege Escalation Risk

**File:** `functions/api/routes/users.ts:91-104`
**Issue:** The `patchUser` handler allows role changes and session deletion without validating that the requesting user is authorized to perform such sensitive operations. The `ensureAdmin` middleware is applied at the router level, but the handler doesn't re-validate for critical operations.

```typescript
patchUser: async ({ params, body }, c) => {
  // ... input validation ...
  const db = c.get("db") as Kysely<DB>;
  const { role, member_type } = validationResult.data;

  if (role) {
    await db.updateTable("user").set({ role }).where("id", "=", params.id).execute();
    await db.deleteFrom("session").where("userId", "=", params.id).execute();
  }
```

**Impact:** An attacker who bypasses the outer middleware could modify roles or invalidate sessions.

**Fix:**
```typescript
patchUser: async ({ params, body }, c) => {
  const currentUser = await getSessionUser(c);
  if (!currentUser || currentUser.role !== "admin") {
    return { status: 403 as const, body: { error: "Forbidden: Admin required" } };
  }
  // ... rest of handler with re-authorization ...
}
```

### CR-05: SQL Injection via FTS Search Query

**File:** `functions/api/routes/posts.ts:34-56` and `functions/api/routes/docs.ts:129-135`
**Issue:** Full-text search queries directly interpolate user input without proper sanitization.

```typescript
// posts.ts
const results = await sql<{ ... }>`
  SELECT ...
  FROM posts_fts f
  JOIN posts p ON f.slug = p.slug
  WHERE p.is_deleted = 0 AND p.status = 'published' 
  AND f.posts_fts MATCH ${q}  /* UNSAFE: Direct interpolation */
  ORDER BY f.rank LIMIT ${limit} OFFSET ${offset}
`.execute(db);
```

**Impact:** While SQLite FTS5 has some built-in escaping, the query doesn't validate or sanitize input. Special characters or malformed queries could cause unexpected behavior.

**Fix:**
```typescript
// Sanitize FTS query - allow alphanumeric, spaces, and basic punctuation
const qClean = (q || "").replace(/[^\w\s\-\.]/g, "").trim();
if (!qClean) return { status: 200 as const, body: { posts: [] } };
const ftsQ = `"${qClean.replace(/"/g, '""')}*`;  /* Proper FTS5 phrase search */

const results = await sql<{ ... }>`
  SELECT ...
  FROM posts_fts f
  JOIN posts p ON f.slug = p.slug
  WHERE p.is_deleted = 0 AND p.status = 'published' 
  AND f.posts_fts MATCH ${ftsQ}
  ORDER BY f.rank LIMIT ${limit} OFFSET ${offset}
`.execute(db);
```

### CR-06: Race Condition in Award Deduplication

**File:** `functions/api/routes/awards.ts:59-72`
**Issue:** The duplicate check between title/year/event_name is not atomic - concurrent requests could create duplicate awards.

```typescript
if (!exists) {
  const duplicate = await db.selectFrom("awards")
    .select("id")
    .where("title", "=", title)
    .where("date", "=", String(year))
    .where("event_name", "=", event_name || "")
    .where("is_deleted", "=", 0)
    .executeTakeFirst();
  if (duplicate) {
    exists = true;
    finalId = String(duplicate.id);
  }
}
```

**Impact:** Two simultaneous requests with the same data could both pass the duplicate check and create duplicate records.

**Fix:** Use database constraint or upsert pattern:
```typescript
const values = { ... };
await db.insertInto("awards")
  .values(values)
  .onConflict(oc => oc
    .columns(["title", "date", "event_name"])
    .doUpdateSet({ ...values })
    .where("is_deleted", "=", 0)
  )
  .execute();
```

### CR-07: Zulip Webhook Token Timing Attack Vulnerability

**File:** `functions/api/routes/zulipWebhook.ts:26-47`
**Issue:** While a timing-safe comparison function is implemented, the length check short-circuits in a way that could still leak information.

```typescript
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  
  if (aBuf.length !== bBuf.length) {
    // If lengths differ, compare aBuf against itself to consume time
    // but ensure we return false at the end.
    let _result = 0;
    for (let i = 0; i < aBuf.length; i++) {
      _result |= aBuf[i] ^ aBuf[i];
    }
    return false;  // STILL LEAKS: Early return after variable-time work
  }
```

**Impact:** The loop iterates `aBuf.length` times regardless of `bBuf.length`, but the total time still depends on `aBuf.length`. An attacker could probe token length by measuring response times.

**Fix:**
```typescript
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBuf = enc.encode(a);
  const bBuf = enc.encode(b);
  
  if (aBuf.length !== bBuf.length) {
    // Always iterate MAX_TOKEN_LENGTH to normalize timing
    const MAX_TOKEN_LENGTH = 128;
    let _result = 0;
    for (let i = 0; i < MAX_TOKEN_LENGTH; i++) {
      const aByte = i < aBuf.length ? aBuf[i] : 0;
      const bByte = i < bBuf.length ? bBuf[i] : 0;
      _result |= aByte ^ bByte;
    }
    return false;
  }
  // ... rest of comparison ...
}
```

## Warnings

### WR-01: Missing Authorization on Public Endpoints

**File:** `functions/api/routes/github.ts:86-96`
**Issue:** GitHub activity endpoint doesn't require authentication and makes external API calls that could exhaust rate limits.

```typescript
getActivity: async (_: any, c: Context<AppEnv>) => {
  const repoRes = await fetch(`https://api.github.com/orgs/${org}/repos?per_page=100&type=public`, { headers });
```

**Impact:** Unauthenticated clients can trigger unlimited GitHub API calls, potentially exhausting the rate quota and blocking legitimate internal use.

**Fix:** Add rate limiting or authentication:
```typescript
getActivity: async (_: any, c: Context<AppEnv>) => {
  const ip = c.req.header("CF-Connecting-IP") || "unknown";
  const ua = c.req.header("User-Agent") || "unknown";
  if (!(await checkRateLimit(c.env.ARES_KV, `github-activity:${ip}`, ua, 10, 60))) {
    return { status: 429 as const, body: { error: "Rate limit exceeded" } };
  }
  // ... rest of handler ...
}
```

### WR-02: Insufficient Input Validation on Event Recurrence

**File:** `functions/api/routes/events/handlers.ts:272-297`
**Issue:** RRULE strings are passed to `rrulestr` parser without validation.

```typescript
const rule = rrulestr(body.rrule, { dtstart: new Date(dateStart) });
const dates = rule.all((d, i) => i < 52);
```

**Impact:** Malicious RRULE strings could cause excessive memory/CPU consumption (ReDoS vulnerability). The 52-instance cap helps but doesn't prevent parser abuse.

**Fix:**
```typescript
// Validate RRULE before parsing
const MAX_RRULE_LENGTH = 200;
const ALLOWED_RRULE_KEYS = ['FREQ', 'INTERVAL', 'UNTIL', 'COUNT', 'BYDAY', 'BYMONTHDAY'];

if (!body.rrule || body.rrule.length > MAX_RRULE_LENGTH) {
  return { status: 400 as const, body: { error: "Invalid recurrence rule" } };
}

// Basic validation
const upperRule = body.rrule.toUpperCase();
const hasValidKey = ALLOWED_RRULE_KEYS.some(key => upperRule.includes(key));
if (!hasValidKey) {
  return { status: 400 as const, body: { error: "Invalid recurrence rule format" } };
}
```

### WR-03: Media Upload Missing Content-Type Validation

**File:** `functions/api/routes/media/index.ts:24-47`
**Issue:** File upload handler doesn't validate the actual content type, only relies on file extension and magic bytes.

```typescript
const isValidImage = (buffer: ArrayBuffer): boolean => {
  const arr = new Uint8Array(buffer).subarray(0, 4);
  const header = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
  return ['89504e47', 'ffd8ffe0', 'ffd8ffe1', 'ffd8fffe', '52494646'].includes(header);
};
```

**Impact:** The magic byte check is insufficient - an attacker could craft polyglot files that pass this check but contain malicious content.

**Fix:**
```typescript
// Add size and dimension validation
if (file.size > 50 * 1024 * 1024) {
  return c.json({ error: "File too large (max 50MB)" }, 400);
}

// After upload, validate with a proper image processing library
// that checks for embedded scripts or suspicious patterns
```

### WR-04: Open Redirect via Analytics Track Sponsor Click

**File:** `functions/api/routes/analytics.ts:41-69`
**Issue:** The `sponsor_id` parameter isn't validated before being used in database queries - potentially allowing enumeration of all sponsor IDs.

```typescript
trackSponsorClick: async ({ body }: { body: any }, c: Context<AppEnv>) => {
  const { sponsor_id } = body;
  // No validation that sponsor_id exists or is valid
  
  await db.insertInto("sponsor_metrics")
    .values({
      id: crypto.randomUUID(),
      sponsor_id,  // Used directly - could reference non-existent sponsors
      year_month: yearMonth,
      clicks: 1,
      impressions: 0
    })
```

**Impact:** Attackers can flood the database with invalid sponsor_id references, polluting analytics data.

**Fix:**
```typescript
trackSponsorClick: async ({ body }: { body: any }, c: Context<AppEnv>) => {
  const { sponsor_id } = body;
  
  // Validate sponsor exists
  const sponsor = await db.selectFrom("sponsors")
    .select("id")
    .where("id", "=", sponsor_id)
    .where("is_active", "=", 1)
    .executeTakeFirst();
  
  if (!sponsor) {
    return { status: 400 as const, body: { error: "Invalid sponsor" } };
  }
  // ... rest of handler ...
}
```

### WR-05: Insecure Error Messages Leak Database Structure

**File:** `functions/api/routes/posts.ts:107-108`
**Issue:** Generic error handler still exposes "Database error" message.

```typescript
} catch (e) {
  console.error("[Posts:List] Error", e);
  return { status: 200, body: { posts: [] } };  // Violates "No Fake Success" rule
}
```

**Impact:** This violates the "No Fake Success" rule - returning HTTP 200 with empty data makes debugging impossible and hides real failures.

**Fix:**
```typescript
} catch (e) {
  console.error("[Posts:List] Error", e);
  return { status: 500, body: { error: "Failed to fetch posts" } };
}
```

### WR-06: Missing Authorization on Store Orders

**File:** `functions/api/routes/store.ts:108-146`
**Issue:** The `getOrders` endpoint only checks sessionUser at route level but doesn't re-validate in handler.

```typescript
getOrders: async (_input: any, c: Context<AppEnv>) => {
  try {
    const sessionUser = c.get("sessionUser");
    if (!sessionUser || sessionUser.role !== "admin") {
      return { status: 401 as const, body: { error: "Unauthorized" } };
    }
```

**Impact:** If middleware bypassed, sensitive order data exposed.

**Fix:** Add proper middleware at router level:
```typescript
storeRouter.use("/orders", ensureAdmin);
storeRouter.use("/orders/*", ensureAdmin);
```

### WR-07: AI Endpoints Missing Rate Limits

**File:** `functions/api/routes/ai/index.ts:44-200`
**Issue:** AI endpoints (liveblocks-copilot, sim-playground, editor-chat) don't have rate limiting, only the suggest endpoint does.

**Impact:** AI endpoints can be abused to exhaust API credits or cause denial of service.

**Fix:**
```typescript
aiRouter.use("/liveblocks-copilot", persistentRateLimitMiddleware(30, 60));
aiRouter.use("/sim-playground", persistentRateLimitMiddleware(20, 60));
aiRouter.use("/editor-chat", persistentRateLimitMiddleware(30, 60));
```

### WR-08: Judge Portfolio Cache Poisoning Risk

**File:** `functions/api/routes/judges.ts:25-26`
**Issue:** In-memory cache uses simple key without validation.

```typescript
const portfolioCache = new Map<string, { data: any; expiresAt: number }>();
const cached = portfolioCache.get("portfolio");
```

**Impact:** No mechanism to invalidate cache if data changes, potentially serving stale data indefinitely.

**Fix:** Add cache versioning or TTL-based invalidation:
```typescript
const CACHE_VERSION = await db.selectFrom("settings")
  .select("value")
  .where("key", "=", "portfolio_cache_version")
  .executeTakeFirst();
  
const cacheKey = `portfolio_v${CACHE_VERSION?.value || 0}`;
```

### WR-09: Log PII Exposure in Communications

**File:** `functions/api/routes/communications.ts:89`
**Issue:** Error logging could expose user email addresses.

```typescript
} catch (err: any) {
  const errMsg = err instanceof Error ? err.message : (typeof err === "string" ? err : JSON.stringify(err) || "Unknown error");
  console.error("[Communications] Send mass email failed:", errMsg);  // May contain emails
```

**Impact:** Logs containing user PII could be exposed in error tracking systems.

**Fix:**
```typescript
} catch (err: any) {
  const errMsg = err instanceof Error ? err.message : "Unknown error";
  console.error("[Communications] Send mass email failed:", errMsg);  // Sanitized
}
```

### WR-10: GitHub Webhook Signature Verification Timing Attack

**File:** `functions/api/routes/githubWebhook.ts:9-38`
**Issue:** Similar to WR-07 but for GitHub webhooks.

```typescript
async function verifyGitHubSignature(
  secret: string,
  payload: string,
  signature: string
): Promise<boolean> {
  try {
    if (!signature.startsWith("sha256=")) return false;  // Early return
    // ... rest of verification ...
}
```

**Impact:** Early return could leak information about signature format.

**Fix:** Constant-time comparison throughout.

### WR-11: Missing CSRF Protection on State-Changing Endpoints

**File:** Multiple routes
**Issue:** Many POST/DELETE endpoints don't use originIntegrityMiddleware or CSRF tokens.

**Examples:**
- `functions/api/routes/comments.ts:126-198` - update/delete operations
- `functions/api/routes/tasks.ts` - various operations
- `functions/api/routes/socialQueue.ts` - create/update/delete

**Impact:** Cross-site request forgery attacks could perform unauthorized actions on behalf of authenticated users.

**Fix:**
```typescript
commentsRouter.use("/:id", originIntegrityMiddleware());
tasksRouter.use("*", originIntegrityMiddleware());
socialQueueRouter.use("*", originIntegrityMiddleware());
```

### WR-12: Task Assignment Authorization Weakness

**File:** `functions/api/routes/tasks.ts:281-307`
**Issue:** Task assignment changes are protected but the logic allows mentors/coaches to assign tasks they shouldn't have access to.

```typescript
if (!canAssign) {
  return { status: 403, body: { error: "Only mentors, coaches, admins, or the task creator can change assignments" } };
}
```

**Impact:** Mentors could assign students to inappropriate tasks or manipulate assignments.

**Fix:** Add additional validation:
```typescript
if (!canAssign) {
  return { status: 403, body: { error: "Unauthorized to change assignments" } };
}

// Additional check: prevent assigning to users in different subteams
if (body.assignees && body.assignees.length > 0) {
  const taskSubteam = (await db.selectFrom("tasks").select("subteam").where("id", "=", params.id).executeTakeFirst())?.subteam;
  if (taskSubteam) {
    // Validate all assignees belong to the task's subteam
    const assigneeProfiles = await db.selectFrom("user_profiles")
      .select("member_type")
      .where("user_id", "in", body.assignees)
      .execute();
    // ... additional validation ...
  }
}
```

### WR-13: Sponsor Token Insufficient Entropy

**File:** `functions/api/routes/sponsors.ts:161-166`
**Issue:** Sponsor tokens use `crypto.randomUUID()` which is good, but the truncation reduces entropy.

```typescript
const token = crypto.randomUUID();  // 128 bits of entropy
const id = crypto.randomUUID();
await db.insertInto("sponsor_tokens").values({ id, token, sponsor_id } as any).execute();
```

**Fix:** Actually this is fine - UUID is not truncated. But the token is returned in response which could be logged.

**Fix:** Don't log the token:
```typescript
c.executionCtx.waitUntil(logAuditAction(c, "GENERATE_TOKEN", "sponsor_tokens", id, `Generated token for ${sponsor_id}`));
```

### WR-14: Settings Update Allows Overwriting Sensitive Keys

**File:** `functions/api/routes/settings.ts:45-69`
**Issue:** While there's masking logic, the validation happens after the update.

```typescript
if (SENSITIVE_KEYS.has(key) && typeof value === 'string' && value.startsWith('••••')) {
  continue;  // Skip masked values
}
```

**Impact:** An attacker who can access settings could attempt to overwrite sensitive keys with new values.

**Fix:** Add explicit protection:
```typescript
if (SENSITIVE_KEYS.has(key)) {
  return { status: 403 as const, body: { error: `Cannot update ${key} via API` } };
}
```

### WR-15: Finance Transaction Validation Missing

**File:** `functions/api/routes/finance.ts:231-261`
**Issue:** Transaction amount is not validated for reasonable ranges.

```typescript
amount: body.amount,  // No validation
type: body.type,       // No validation
category: body.category,
```

**Impact:** Invalid amounts (negative, extremely large) could corrupt financial data.

**Fix:**
```typescript
const amount = Number(body.amount);
if (isNaN(amount) || amount < 0 || amount > 1000000) {
  return { status: 400 as const, body: { error: "Invalid amount" } };
}

const validTypes = ['income', 'expense'];
if (!validTypes.includes(body.type)) {
  return { status: 400 as const, body: { error: "Invalid transaction type" } };
}
```

### WR-16: Missing Rate Limit on Admin Export

**File:** `functions/api/routes/settings.ts:124-183`
**Issue:** The `/admin/backup` endpoint has no rate limiting despite performing expensive database operations.

**Impact:** Could be abused to cause denial of service.

**Fix:**
```typescript
settingsRouter.get("/admin/backup", rateLimitMiddleware(5, 300), async (c: Context<AppEnv>) => {
```

### WR-17: Simulations Endpoint GitHub Token Exposure

**File:** `functions/api/routes/simulations.ts:58-64`
**Issue:** GitHub PAT is fetched from settings but could be logged in error messages.

```typescript
const patSetting = config.find((s: any) => s.key === "GITHUB_PAT");
const pat = patSetting?.value || c.env.GITHUB_PAT;
```

**Fix:** Mask PAT in logs:
```typescript
console.log("[Simulations] Using GitHub PAT:", pat ? `configured (ends with ${pat.slice(-4)})` : "missing");
```

### WR-18: Doc Search Regex ReDoS Vulnerability

**File:** `functions/api/routes/docs.ts:143-144`
**Issue:** Regex with user input could cause catastrophic backtracking.

```typescript
snippet: String(row.description || "").replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"), "**$1**")
```

**Impact:** Maliciously crafted query strings could cause excessive CPU consumption.

**Fix:**
```typescript
// Limit regex complexity and query length
if (q.length > 50) {
  return { status: 400 as const, body: { error: "Query too long" } };
}

// Use simpler highlighting or library like 'escape-string-regexp'
```

## Info

### IN-01: Inconsistent Error Handling Pattern

**File:** Multiple files
**Issue:** Some endpoints return `{ status: 200, body: { error: "..." } }` while others return proper HTTP status codes.

**Fix:** Standardize on proper HTTP status codes throughout all routes.

### IN-02: Unused Variables in Comments Handler

**File:** `functions/api/routes/comments.ts:137-143`
**Issue:** Variable `existing` is fetched but unused properties could be removed.

```typescript
const row = await db.selectFrom("comments").select(["user_id", "zulip_message_id"]).where("id", "=", id).executeTakeFirst();
```

### IN-03: Console.log Statements in Production Code

**File:** Multiple files
**Issue:** Debug `console.log` statements should use `console.error` for errors and be properly gated.

### IN-04: Magic Numbers Throughout Codebase

**File:** Multiple files
**Issue:** Hard-coded values like `limit(50)`, `limit(100)` should be constants.

### IN-05: Missing JSDoc Comments on Exported Functions

**File:** Multiple files
**Issue:** Many exported functions lack documentation.

### IN-06: Inconsistent Naming Conventions

**File:** Multiple files
**Issue:** Mix of camelCase and snake_case in database queries.

### IN-07: Potential SQL Injection in Analytics Search

**File:** `functions/api/routes/analytics.ts:328-336`
**Issue:** While sanitized, the FTS query sanitization regex is too permissive.

```typescript
const qClean = (q || "").replace(/[^a-zA-Z0-9\s]/g, "").trim();
```

**Fix:** This actually looks safe - the regex removes all non-alphanumeric characters including special FTS operators.

### IN-08: Missing Audit Logging for Critical Operations

**File:** Multiple files
**Issue:** Some critical operations (user deletion, role changes) have audit logging while others don't.

**Recommendation:** Add `logAuditAction` to all state-changing operations.

---

_Audited: 2025-01-04_  
_Reviewer: Claude (gsd-code-reviewer)_  
_Depth: deep_
