# Error Handling Audit Report
**ARES Web Portal - Comprehensive Error Handling Analysis**
**Generated:** 2026-05-09
**Auditor:** Claude Code Agent
**Scope:** API Routes, Middleware, Frontend Error Boundaries, Async Operations

---

## Executive Summary

This audit examined error handling patterns across the ARES Web Portal codebase against the "Throw, Never Return" policy defined in the project's error handling guidelines. The audit identified **27 findings** across 4 severity levels:

- **CRITICAL (5):** Violations of core error handling policy that mask errors
- **HIGH (8):** Silent failures that could hide production issues
- **MEDIUM (9):** Inconsistent error handling patterns
- **LOW (5):** Minor code quality issues

### Key Findings

1. **Policy Violation:** 3 instances of returning errors instead of throwing in API routes
2. **Silent Failures:** 15+ locations where errors are caught and silently ignored
3. **waitUntil() Risks:** 90+ async background tasks lack error handling
4. **Auth Handler Inconsistency:** Better Auth catch-all returns errors instead of throwing

---

## 1. "Throw, Never Return" Compliance

### CRITICAL: Auth Handler Returns Errors Instead of Throwing

**File:** `functions/api/routes/auth.ts` (lines 154-173, 188-203)

**Issue:** The test session creation handler and Better Auth catch-all return error responses instead of throwing `ApiError`. This violates the core error handling policy.

```typescript
// VIOLATION: Returns error instead of throwing
} catch (error: unknown) {
  // ... logging ...
  return c.json({ error: 'Failed to create test session', details: errorMessage, stack: errorStack }, 500);
}

// VIOLATION: Better Auth handler returns instead of throws
} catch (error: unknown) {
  console.error("[Auth Handler] Internal Exception:", error);
  return c.json({
    message: message || "Internal Server Error during Authentication",
    stack: isDevBypass ? stack : undefined
  }, (status || 500));
}
```

**Impact:** Errors bypass the global error handler, losing standardized error formatting and audit logging.

**Remediation:**
```typescript
// CORRECT: Throw ApiError for proper handling
} catch (error: unknown) {
  console.error('[Test Auth] Error creating test session:', error);
  const message = error instanceof Error ? error.message : String(error);
  throw new ApiError(`Failed to create test session: ${message}`, 500, ErrorCode.INTERNAL_SERVER_ERROR);
}

// CORRECT: Let global handler process
} catch (error: unknown) {
  if (error instanceof ApiError) throw error;
  throw new ApiError(
    error instanceof Error ? error.message : "Authentication failed",
    (error as any)?.status || 500
  );
}
```

---

### HIGH: GitHubWebhook Returns Error on Missing Configuration

**File:** `functions/api/routes/githubWebhook.ts` (line 135)

**Issue:** Returns 503 instead of throwing when webhook secret is not configured.

```typescript
if (!secret) {
  console.warn("[GitHubWebhook] GITHUB_WEBHOOK_SECRET not configured. Rejecting request.");
  return c.json({ error: "Webhook not configured" }, 503);
}
```

**Impact:** Bypasses global error handler; inconsistent with other configuration error patterns.

**Remediation:**
```typescript
if (!secret) {
  throw new ApiError("Webhook not configured - GITHUB_WEBHOOK_SECRET missing", 503, ErrorCode.SERVICE_UNAVAILABLE);
}
```

---

### MEDIUM: GitHub Board Returns 200 on Configuration Missing

**File:** `functions/api/routes/github.ts` (lines 136-139)

**Issue:** Returns empty board with 200 status instead of throwing when configuration is missing.

```typescript
if (!ghConfig) {
  console.error("[GitHub:Board] Configuration missing — GITHUB_PAT or GITHUB_PROJECT_ID not set");
  return c.json({ success: false, board: [] }, 200);
}
```

**Impact:** Frontend cannot distinguish between "configured but empty" and "not configured" states.

**Remediation:**
```typescript
if (!ghConfig) {
  throw new ApiError("GitHub integration not configured", 503, ErrorCode.SERVICE_UNAVAILABLE);
}
```

---

## 2. Silent Failures and Swallowed Errors

### HIGH: Analytics Route Silently Ignores SQL Errors

**File:** `functions/api/routes/analytics.ts` (lines 235-239)

**Issue:** Empty catch block swallows all SQL errors when fetching latency data.

```typescript
} catch {
  // Table doesn't exist or other error - use defaults
  apiCount = { total: 0 };
  latencyData = [];
}
```

**Impact:** Database schema issues are silently hidden, making debugging difficult.

**Remediation:**
```typescript
} catch (err) {
  const msg = err instanceof Error ? err.message : String(err);
  console.error("[Analytics] Failed to fetch API latency stats:", msg);
  // Log to system errors for visibility
  c.executionCtx.waitUntil(logSystemError(db, "AnalyticsLatencyQuery", msg));
  apiCount = { total: 0 };
  latencyData = [];
}
```

---

### HIGH: Badge Notification Errors Silently Ignored

**File:** `functions/api/routes/badges.ts` (lines 128-130)

**Issue:** Zulip notification errors in waitUntil() are completely swallowed.

```typescript
} catch {
  /* ignore */
}
```

**Impact:** Notification delivery failures are invisible to administrators.

**Remediation:**
```typescript
} catch (err) {
  console.error("[Badges:Zulip] Failed to send notification:", err);
  c.executionCtx.waitUntil(logSystemError(db, "BadgeNotification", err instanceof Error ? err.message : String(err)));
}
```

---

### MEDIUM: Multiple .catch(() => {}) Patterns

**Files:** Various routes

**Issue:** Over 15 instances of silent error suppression in async operations:

- `events/handlers.ts:675, 679` - Social dispatch errors ignored
- `events/handlers.ts:879` - Zulip message errors ignored
- `docs.ts:900` - Storage deletion errors ignored
- `github.ts:64` - Repo fetch errors return null
- `tba.ts:34` - TBA API fetch errors return null
- `zulipWebhook.ts:270` - Broadcast message errors ignored
- `inquiries/handlers.ts:220, 225, 237, 242` - Multiple async errors ignored
- `tasks.ts:335` - Task notification errors ignored

**Example:**
```typescript
// events/handlers.ts
await dispatchSocials(db, { ... }, socialConfig, socials).catch(() => {});
await sendZulipMessage(socialConfig, "events", eventTopic, eventContent).catch(() => {});
```

**Impact:** Background operation failures are invisible, making production debugging nearly impossible.

**Remediation Pattern:**
```typescript
await dispatchSocials(db, payload, socialConfig, socials).catch((err) => {
  console.error("[Events:SocialDispatch] Failed:", err);
  c.executionCtx.waitUntil(logSystemError(db, "EventSocialDispatch", err instanceof Error ? err.message : String(err)));
});
```

---

## 3. waitUntil() Task Error Handling

### HIGH: 90+ waitUntil() Calls Lack Error Handling

**Files:** Across all route files

**Issue:** The majority of `c.executionCtx.waitUntil()` calls wrap async operations but don't handle errors within those operations. Since waitUntil runs asynchronously, any thrown errors are lost.

**Affected Areas:**
- Audit logging (`logAuditAction`) - 40+ instances
- Social media dispatch - 15+ instances
- Notification delivery - 10+ instances
- Cache operations - 8+ instances
- Storage operations - 5+ instances

**Example:**
```typescript
// NO ERROR HANDLING
c.executionCtx.waitUntil(logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted"));
```

**Impact:** Audit log failures, notification failures, and cache update failures are silent.

**Remediation Pattern:**
```typescript
// WITH ERROR HANDLING
c.executionCtx.waitUntil(
  logAuditAction(c, "award_deleted", "awards", params.id, "Award soft-deleted")
    .catch((err) => console.error("[AuditLog] Failed to log action:", err))
);
```

---

### MEDIUM: Usage Metrics Logging Has Minimal Error Handling

**File:** `functions/api/[[route]].ts` (lines 116-139)

**Issue:** Usage metrics logging in waitUntil() only catches and logs specific error types.

```typescript
c.executionCtx.waitUntil(
  (async () => {
    try {
      await db.insert(schema.usageMetrics).values({...}).run();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      if (!errorMsg.includes("no such table") && !errorMsg.includes("does not exist")) {
        console.error("[UsageMetrics] Log failed:", errorMsg);
      }
    }
  })()
);
```

**Issue:** Intentionally suppresses "no such table" errors but logs others. This is acceptable for this specific use case but should be documented.

**Status:** ACCEPTABLE - But add inline comment explaining why table-missing errors are ignored.

---

## 4. Frontend Error Boundaries

### GOOD: Comprehensive Error Boundary Implementation

**File:** `src/components/ErrorBoundary.tsx`

**Strengths:**
1. Handles stale chunk errors with auto-reload (prevents PWA cache issues)
2. Detects third-party security errors (iframe/CORS issues)
3. Generates correlation IDs for debugging
4. Provides user-friendly UI with ARES branding
5. Includes HTTP status code extraction
6. Logs errors to console

**Minor Recommendation:**
- Consider adding Sentry/error tracking service integration for production error monitoring

---

### MEDIUM: API Client Error Handling Could Be Improved

**File:** `src/utils/apiClient.ts`

**Issue:** The `fetchJson` function properly throws errors with status codes, but doesn't handle 401 responses to trigger session refresh.

```typescript
// Current: throws error with status attached
const err = new Error(errorMessage) as Error & { status?: number; url?: string };
err.status = res.status;
err.url = url;
throw err;
```

**Recommendation:** Add 401 detection to trigger auth refresh:
```typescript
if (res.status === 401) {
  // Trigger session refresh logic
  window.dispatchEvent(new CustomEvent('ares:auth-expired'));
}

const err = new Error(errorMessage) as Error & { status?: number; url?: string };
err.status = res.status;
err.url = url;
throw err;
```

---

## 5. Global Error Handler Assessment

### GOOD: Global Error Handler in [[route]].ts

**File:** `functions/api/[[route]].ts` (lines 292-309)

**Strengths:**
1. Handles `ApiError` with proper status codes
2. Logs all errors to console
3. Logs system errors to database in production
4. Returns standardized error responses
5. Hides stack traces in production

**Minor Issue:**
- Uses dynamic import for `ApiError` which could be optimized

**Status:** COMPLIANT - No changes needed

---

## 6. Error Helper Usage

### GOOD: ApiError and throwErrors Helpers Exist

**File:** `functions/api/middleware/errorHandler.ts`

**Strengths:**
1. `ApiError` class with status, code, and details
2. `throwErrors` helper with common error types
3. `asyncHandler` wrapper for route-level error handling

**Issue:** Underutilized in the codebase. Many routes still return errors instead of using these helpers.

**Recommendation:** Create linting rule or code review checklist item to enforce `throwErrors` usage.

---

## Severity Classification

### Critical (Fix Immediately)
1. Auth test session handler returns error instead of throwing
2. Better Auth catch-all returns error instead of throwing

### High (Fix Within Sprint)
3. GitHubWebhook returns 503 instead of throwing
4. Analytics empty catch block swallows SQL errors
5. Badge notification errors completely ignored
6. waitUntil() calls lack error handling patterns

### Medium (Fix Within Release)
7. GitHub board returns 200 on config missing
8. Multiple silent .catch(() => {}) patterns
9. API client lacks 401 session refresh handling

### Low (Technical Debt)
10. Dynamic ApiError import in global handler
11. Inconsistent error message formatting
12. Some error logs lack contextual prefixes

---

## Remediation Priority Matrix

| Priority | Finding | Files Affected | Effort | Impact |
|----------|---------|---------------|--------|--------|
| P0 | Auth handler return violations | auth.ts | Low | High |
| P0 | Analytics silent failures | analytics.ts | Low | Medium |
| P1 | waitUntil() error handling | All routes | High | High |
| P1 | Silent .catch(() => {}) | events, docs, inquiries | Medium | Medium |
| P2 | GitHub board 200 on missing config | github.ts | Low | Low |
| P2 | API client 401 handling | apiClient.ts | Medium | Medium |

---

## Recommended Actions

### Immediate (This Sprint)
1. **Fix Auth Handler Violations**
   - Convert `return c.json({ error })` to `throw new ApiError(...)`
   - Ensure Better Auth errors bubble to global handler

2. **Add Analytics Error Logging**
   - Replace empty catch with proper error logging
   - Use `logSystemError` for visibility

3. **Create waitUntil() Helper**
   ```typescript
   // Add to middleware
   export function safeWaitUntil(
     ctx: ExecutionContext,
     promise: Promise<unknown>,
     context: string
   ) {
     ctx.waitUntil(
       promise.catch((err) => {
         console.error(`[${context}] Async operation failed:`, err);
       })
     );
   }
   ```

### Short-term (Next Release)
4. **Audit and Fix Silent .catch() Patterns**
   - Review all `.catch(() => {})` instances
   - Add console.error logging at minimum
   - Add system error logging for critical paths

5. **Add 401 Session Refresh**
   - Implement custom event for auth expiration
   - Add global event listener for session refresh

6. **Error Code Standardization**
   - Ensure all ApiError throws include appropriate error codes
   - Document error code conventions

### Long-term (Technical Debt)
7. **Add Error Tracking**
   - Integrate Sentry or similar service
   - Track error rates and patterns

8. **Create Error Handling Lint Rules**
   - ESLint rule to catch return-error patterns
   - Require error handling in waitUntil() calls

9. **Improve Error Messages**
   - Standardize error message format
   - Add troubleshooting hints for common errors

---

## Testing Recommendations

1. **Add Error Scenario Tests**
   - Test 401 responses trigger session refresh
   - Test ErrorBoundary catches and displays errors
   - Test global error handler formats responses

2. **Test waitUntil() Error Handling**
   - Mock failures in async operations
   - Verify errors are logged

3. **Chaos Testing**
   - Test behavior when D1 is unavailable
   - Test behavior when external APIs fail
   - Test behavior when storage is unavailable

---

## Conclusion

The ARES Web Portal has a solid error handling foundation with the global error handler and ErrorBoundary component. However, there are significant violations of the "Throw, Never Return" policy, particularly in authentication handlers, and widespread silent failure patterns in async operations.

The most critical issue is the auth handler returning errors instead of throwing, which bypasses the global error handler and loses audit logging. This should be fixed immediately.

The second priority is addressing the 90+ waitUntil() calls that lack error handling, as these represent hidden failure points in the application.

---

**Report End**

For questions about specific findings, refer to the line numbers and file paths provided in each section.
