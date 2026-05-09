# ARES Web Portal - Comprehensive Audit Fix Plan

**Created:** 2026-05-09
**Strategy:** Parallel execution with 6 specialized fixer agents
**Estimated Time:** 2-3 hours with parallel execution

---

## Overview

This plan addresses **141 total findings** across 6 audit dimensions:
- Security: 19 threats (7 CRITICAL, 12 HIGH)
- Type Safety: 48 violations (2 CRITICAL, 15 HIGH)
- Error Handling: 27 findings (2 CRITICAL, 8 HIGH)
- Database: 28 findings (1 CRITICAL, 8 HIGH)
- Code Quality: 47 findings (8 CRITICAL, 15 HIGH)

---

## Parallel Execution Strategy

### Wave 1: Critical Security Fixes (BLOCKER - must complete first)
**Agent:** Security Fixer
**Duration:** ~30 minutes
**Dependencies:** None (must go first due to security nature)

These fixes MUST complete before other work because they affect the core security model.

### Wave 2: Core Infrastructure (Can run in parallel)
**Agents:**
1. Database Fixer - FTS triggers, migrations, soft-delete
2. Type Safety Fixer - Hono client, error utilities, type inference
3. Error Handler Fixer - Global error policy, waitUntil helpers

**Duration:** ~45 minutes
**Dependencies:** Wave 1 complete

### Wave 3: Application Layer (Can run in parallel)
**Agents:**
1. Route Handler Fixer - Auth, authorization, PII redaction
2. Code Quality Fixer - XSS, N+1 queries, refactoring

**Duration:** ~60 minutes
**Dependencies:** Wave 2 complete

---

## Detailed Fix清单 by Wave

### Wave 1: Critical Security Fixes (Agent: Security Fixer)

#### CRITICAL-001: SQL Injection in Lifecycle Middleware
**File:** `functions/api/middleware/lifecycle.ts`
**Lines:** 46, 66, 82, 99, 120

**Current Code:**
```typescript
await db.run(sql.raw(`UPDATE ${tableName} SET status = 'published' WHERE ${idColumn} = '${id}'`));
```

**Fix:**
```typescript
await db.run(sql`UPDATE ${sql.raw(tableName)} SET status = 'published' WHERE ${sql.raw(idColumn)} = ${id}`);
```

---

#### CRITICAL-002: Student PII Exposure in Analytics
**File:** `functions/api/routes/analytics.ts`

**Fix:** Add query-level redaction for student profiles before returning data.

---

#### CRITICAL-003: Missing Authorization on Logistics
**File:** `functions/api/routes/logistics.ts`

**Fix:** Add `ensureAuth` middleware to the route.

---

#### CRITICAL-004: Hostname-based Auth Bypass
**File:** `functions/api/middleware/auth.ts`

**Fix:** Remove or strengthen hostname-based development bypass detection.

---

#### CRITICAL-005: Hardcoded Secret
**File:** `functions/api/routes/auth.ts`

**Fix:** Move to environment variable.

---

#### CRITICAL-006: Client-side Secret
**File:** `src/utils/security.ts`

**Fix:** Remove from client bundle, move to server-only.

---

#### CRITICAL-007: Timing Attack in Webhook
**File:** `functions/api/routes/githubWebhook.ts`

**Fix:** Use constant-time comparison for signature verification.

---

### Wave 2: Core Infrastructure (Parallel Agents)

#### Agent 1: Database Fixer

**Fixes:**
1. **HIGH-001:** Hard DELETE on inquiries → Soft-delete
2. **HIGH-002:** FTS triggers missing → Add migration
3. **HIGH-003:** FTS cleanup on purge → Delete from FTS tables
4. **MEDIUM-001:** Inconsistent soft-delete status → Standardize
5. **MEDIUM-002:** Purge doesn't check isDeleted → Add condition
6. **MEDIUM-003:** Missing composite indexes → Add to schema
7. **MEDIUM-004:** FTS sanitization inconsistency → Create shared utility
8. **LOW-001:** Migration naming → Document current state

**Files to modify:**
- `functions/api/middleware/lifecycle.ts`
- `functions/api/routes/inquiries/handlers.ts`
- `functions/api/routes/docs.ts`
- `functions/api/routes/posts.ts`
- `drizzle/` (new migration)
- `src/db/schema.ts`
- `functions/api/utils/fts.ts` (create)

---

#### Agent 2: Type Safety Fixer

**Fixes:**
1. **CRITICAL-001:** Hono client typed as `any`
2. **CRITICAL-002:** Error utilities return `any`
3. **HIGH-001 through HIGH-015:** Database result mapping with `any` types

**Files to modify:**
- `src/api/honoClient.ts`
- `shared/errors/api.ts`
- `functions/api/routes/outreach/list.ts`
- `functions/api/routes/judges.ts`
- `functions/api/routes/inquiries/handlers.ts`
- `functions/api/routes/docs.ts`
- `functions/api/routes/settings.ts`

---

#### Agent 3: Error Handler Fixer

**Fixes:**
1. **CRITICAL-001:** Auth handler returns error instead of throwing
2. **CRITICAL-002:** Better-Auth catch-all returns error
3. **HIGH-001:** GitHub webhook returns 503 instead of throwing
4. **HIGH-002:** Analytics silently swallows SQL errors
5. **MEDIUM-001:** GitHub board returns 200 with empty data
6. **MEDIUM-002 through MEDIUM-009:** Silent .catch() patterns
7. **Create:** `safeWaitUntil()` helper utility

**Files to modify:**
- `functions/api/routes/auth.ts`
- `functions/api/routes/githubWebhook.ts`
- `functions/api/routes/analytics.ts`
- `functions/api/utils/safeWaitUntil.ts` (create)
- All files with `.catch(() => {})` patterns

---

### Wave 3: Application Layer (Parallel Agents)

#### Agent 4: Route Handler Fixer

**Fixes:**
1. **HIGH-001 through HIGH-012:** Security issues in route handlers
   - Missing authorization on analytics endpoint
   - CSRF protection gaps
   - Inconsistent sanitization
   - Session validation issues

2. **MEDIUM-001 through MEDIUM-008:** Medium priority route issues

**Files to modify:**
- `functions/api/routes/analytics.ts`
- `functions/api/routes/profiles.ts`
- `functions/api/routes/users.ts`
- `functions/api/middleware/security.ts`
- All route files with mutations

---

#### Agent 5: Code Quality Fixer

**Fixes:**
1. **CRITICAL-01 through CRITICAL-08:** XSS and injection vulnerabilities
2. **HIGH-01 through HIGH-15:** Race conditions, N+1 queries
3. **MEDIUM-01 through MEDIUM-16:** Code quality issues

**Files to modify:**
- `src/components/SimPreviewFrame.tsx`
- `src/components/DocsTableOfContents.tsx`
- `src/db/query-helpers.ts`
- Various component files with innerHTML usage
- Files with race conditions

---

#### Agent 6: Test Coverage Fixer

**Fixes:**
1. Add tests for new security utilities
2. Add tests for new type-safe patterns
3. Fix broken test imports
4. Add E2E tests for critical security paths

**Files to modify:**
- Test files for modified handlers
- New test files for new utilities
- Fix 15 TSC compilation errors in tests

---

## Execution Commands

### Option 1: Full Parallel Execution (Recommended)
```bash
# Execute all waves in sequence, with parallel agents within each wave
/gsd-quick "Execute Wave 1: Critical Security Fixes"
/gsd-quick "Execute Wave 2: Core Infrastructure (3 parallel agents)"
/gsd-quick "Execute Wave 3: Application Layer (3 parallel agents)"
```

### Option 2: Manual Agent Invocation
Invoke each agent individually with specific task assignments:

**Wave 1:**
```
Agent: gsd-code-fixer
Task: Fix all 7 CRITICAL security issues
Files: functions/api/middleware/lifecycle.ts, functions/api/routes/auth.ts, etc.
```

**Wave 2:**
```
Agent 1: gsd-code-fixer (Database)
Agent 2: gsd-code-fixer (Type Safety)
Agent 3: gsd-code-fixer (Error Handling)
```

**Wave 3:**
```
Agent 4: gsd-code-fixer (Route Handlers)
Agent 5: gsd-code-fixer (Code Quality)
Agent 6: gsd-code-fixer (Tests)
```

---

## Success Criteria

After execution, verify:

1. **Zero CRITICAL findings** remain
2. **TSC compiles** with zero errors
3. **All tests pass** (`npm run test:unit`, `npm run test:e2e:remote`)
4. **Security audit** shows 0 CRITICAL, <5 HIGH
5. **Type safety audit** shows >90% compliance
6. **Error handling audit** shows 0 CRITICAL violations

---

## Rollback Plan

If critical issues arise:

1. Each wave creates atomic commits
2. Roll back by wave using `git revert`
3. Preserve test additions while reverting functional changes

---

## Monitoring During Execution

Watch for:
- Test failures in CI
- Type errors after bulk changes
- Performance regressions
- Breaking changes to API contracts

---

*Plan created: 2026-05-09*
*Ready for execution*
