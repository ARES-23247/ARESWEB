# ARES Web Portal - Comprehensive Fix Plan
## All 600+ Deep Audit Findings

**Created:** 2026-05-10
**Strategy:** 7-wave parallel execution with 15+ specialized agents
**Guidelines:** Following ARESWEB Institutional Skills

---

## Executive Summary

This plan addresses **600+ findings** from the exhaustive deep audit across 12 dimensions:

| Dimension | Grade | Findings | Priority |
|-----------|-------|----------|----------|
| TypeScript | D | 278+ violations | CRITICAL |
| Security | B+ | 23 (4 HIGH) | CRITICAL |
| Accessibility | D | 47 (12 CRITICAL) | CRITICAL |
| Brand | D+ | 250+ violations | HIGH |
| Code Quality | C | 150+ `as any` | HIGH |
| Testing | C | 29 files untested | HIGH |
| Database | C+ | 34 hard DELETEs | MEDIUM |
| Error Handling | C | 48+ silent failures | MEDIUM |
| API Contract | B+ | 180+ inconsistent | MEDIUM |
| Architecture | B- | God objects | LOW |
| Performance | A | 0 | ✅ |
| Dependencies | A- | 0 prod vulns | LOW |

**Overall Timeline:** ~6-8 hours with parallel execution
**Total Waves:** 7
**Total Agents:** 15+

---

## Wave Structure

```
Wave 1 (BLOCKER)                   ┃
├── Security HIGH Fixer            ┃  ~45 min
│   └── 4 HIGH severity issues     ┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 2 (Parallel - 4 agents)       ┃
├── Agent 1: Accessibility CRITICAL┃
├── Agent 2: TypeScript Core       ┃  ~60 min
├── Agent 3: Brand Hex Codes       ┃
└── Agent 4: Critical Testing Gaps ┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 3 (Parallel - 4 agents)       ┃
├── Agent 5: Accessibility HIGH    ┃
├── Agent 6: Brand Tailwind Colors ┃  ~60 min
├── Agent 7: Code Quality Cleanup  ┃
└── Agent 8: Database Soft Delete  ┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 4 (Parallel - 3 agents)       ┃
├── Agent 9: Brand Typography      ┃
├── Agent 10: Error Handling       ┃  ~45 min
└── Agent 11: API Standardization  ┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 5 (Parallel - 3 agents)       ┃
├── Agent 12: Test Coverage        ┃
├── Agent 13: Dependency Updates   ┃  ~45 min
└── Agent 14: Architecture Refactor┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 6 (Single agent)              ┃
├── Agent 15: Accessibility Final  ┃  ~30 min
│   └── Landmarks, hierarchy, etc. ┃
                                   ─━━━━━━━━━━━━━━━━━━
Wave 7 (Final)                     ┃
├── Verification Agent             ┃  ~30 min
│   └── Tests, re-audit, deploy    ┃
                                   ─━━━━━━━━━━━━━━━━━━
```

---

## Wave 1: Security HIGH (BLOCKER)

**Agent:** Security Fixer (Zero Trust Specialist)
**Duration:** ~45 minutes
**Skills:** `aresweb-zero-trust-security`

### HIGH-1: Path Traversal in Analytics Search

**File:** `functions/api/routes/analytics.ts`
**Issue:** FTS5 query injection via unsanitized search terms
**Fix Pattern:**
```typescript
// BEFORE
const searchTerm = c.req.query('search');
const results = await db.select().from(ftsTable).where(sql`${searchColumn} LIKE ${`%${searchTerm}%`}`);

// AFTER
import { ftsSanitize } from '../utils/fts';
const searchTerm = ftsSanitize(c.req.query('search'));
const results = await db.select().from(ftsTable).where(ftsMatch(searchColumn, searchTerm));
```

### HIGH-2: Missing AI Rate Limiting

**File:** `functions/api/routes/ai/index.ts`
**Issue:** AI endpoints lack rate limiting
**Fix Pattern:**
```typescript
// Add to AI endpoints
import { rateLimiter } from '../../middleware/rateLimiter';

export const aiRouter = new Hono<{ Variables: AppVariables }>()
// Apply rate limit: 10 requests per minute
.use('*', rateLimiter({ limit: 10, window: 60000 }))
```

### HIGH-3: Timing Attack in Webhook

**File:** `functions/api/routes/githubWebhook.ts`
**Issue:** String comparison timing leak
**Fix Pattern:**
```typescript
// BEFORE
if (signature === expectedSignature) {

// AFTER
import { timingSafeEqual } from 'crypto';
if (timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
```

### HIGH-4: Missing Encryption Marker Check

**Files:** Multiple decrypt operations
**Issue:** Decrypt without verifying encryption marker
**Fix Pattern:**
```typescript
// BEFORE
const decrypted = decrypt(encryptedField);

// AFTER
const decrypted = decrypt(encryptedField);
if (!decrypted.startsWith('ENC:')) {
  throw new ApiError(400, 'Invalid encrypted data format');
}
```

---

## Wave 2: Parallel - Critical Foundation

### Agent 1: Accessibility CRITICAL Fixer

**Skills:** `aresweb-inclusive-design`
**Duration:** ~60 minutes

#### A11Y-CRITICAL-1: Focus Outline Removal

**Issue:** `focus:outline-none` without fallback
**Files Affected:** 50+ components
**Fix Pattern:**
```tsx
// BEFORE
className="focus:outline-none"

// AFTER
className="focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:ring-offset-2"
```

**Search Pattern:**
```bash
grep -r "focus:outline-none" src/components
```

#### A11Y-CRITICAL-2: Low Contrast Text

**Issue:** `text-white/20`, `text-white/30`, `text-marble/60` fail 4.5:1
**Files Affected:** 15+ components
**Fix Pattern:**
```tsx
// BEFORE
className="text-white/20"

// AFTER
className="text-white/60"  // or text-marble/70
```

#### A11Y-CRITICAL-3: ares-red Contrast Failure

**Issue:** `ares-red` on dark backgrounds yields 2.69:1 (fails 4.5:1)
**Files Affected:** Red badges, notifications
**Fix Pattern:**
```tsx
// BEFORE - FAILS on obsidian
<span className="bg-ares-red text-white">Error</span>

// AFTER - PASSES
<span className="bg-ares-red text-white" style="background: linear-gradient(135deg, #C00000 0%, #E00000 100%)">Error</span>
// Or use higher contrast variant
<span className="bg-ares-red text-white font-bold">Error</span>
```

---

### Agent 2: TypeScript Core Fixer

**Skills:** `aresweb-typescript-safety`
**Duration:** ~60 minutes

#### TS-CORE-1: Eliminate `as any` in Manual Code

**File:** `functions/api/routes/users.ts:76`
**Issue:** `return c.json({ users, nextCursor } as any, 200);`
**Fix Pattern:**
```typescript
// BEFORE
return c.json({ users, nextCursor } as any, 200);

// AFTER - Define proper response type
import { z } from 'zod';

const UsersResponseSchema = z.object({
  users: z.array(UserSchema),
  nextCursor: z.string().nullable()
});

return c.json(UsersResponseSchema.parse({ users, nextCursor }), 200);
```

**Other `as any` locations:**
- `src/components/EventEditor.tsx` - Form handlers
- `src/components/BlogEditor.tsx` - Content state
- `src/components/FinanceManager.tsx` - Financial calculations

#### TS-CORE-2: Remove `@ts-ignore`

**Search Pattern:**
```bash
grep -r "@ts-ignore" src/
```

**Fix Pattern:**
```typescript
// BEFORE
// @ts-ignore - Zod inference issue
const data = response.data;

// AFTER
import { z } from 'zod';
const DataSchema = z.object({
  // Define shape
});
const data = DataSchema.parse(response.data);
```

---

### Agent 3: Brand Arbitrary Hex Codes

**Skills:** `aresweb-brand-enforcement`
**Duration:** ~60 minutes

#### BRAND-HEX-1: Inline Style Hex Codes

**Files:** 50+ simulation files
**Fix Pattern:**
```tsx
// BEFORE
style={{ color: '#000' }}
style={{ color: '#4CAF50' }}
style={{ color: '#ef4444' }}

// AFTER - Use CSS variables or Tailwind classes
style={{ color: 'var(--marble)' }}
style={{ color: 'var(--ares-success)' }}
style={{ color: 'var(--ares-red)' }}
```

**Files to Update:**
- `src/sims/nn-intro/index.tsx`
- `src/sims/nn-vision/index.tsx`
- `src/sims/montyhall/index.tsx`
- `src/sims/elevatorpid/index.tsx`
- `src/sims/zeroallocation/index.tsx`

#### BRAND-HEX-2: Bracket Notation Colors

**Files:**
- `src/components/editor/useRichEditor.ts:38`
- `src/components/editor/useRichEditor.test.ts`

**Fix Pattern:**
```tsx
// BEFORE
className="text-[#e6edf3]"

// AFTER
className="text-ares-offwhite"
```

---

### Agent 4: Critical Testing Gaps

**Skills:** `aresweb-testing-enforcement`
**Duration:** ~60 minutes

#### TEST-CRITICAL-1: middleware/auth.ts Coverage

**File:** `functions/api/middleware/auth.ts`
**Issue:** ZERO test coverage (contains auth bypass logic)
**Fix Pattern:**
```typescript
// Create: functions/api/middleware/auth.test.ts

import { describe, it, expect, vi } from 'vitest';
import { authMiddleware } from './auth';
import { createMockContext } from '../testUtils';

describe('authMiddleware', () => {
  it('should allow access with valid cf-access-authenticated-user-email', async () => {
    const c = createMockContext({
      header: vi.fn().mockReturnValue('admin@aresfirst.org')
    });
    // Test passes through
  });

  it('should block without cf-access-authenticated-user-email', async () => {
    const c = createMockContext({
      header: vi.fn().mockReturnValue(undefined)
    });
    // Test returns 401
  });

  it('should reject spoofed Referer header', async () => {
    const c = createMockContext({
      header: vi.fn((key) => {
        if (key === 'referer') return 'https://aresfirst.org/admin';
        return undefined;
      })
    });
    // Test returns 401 - Referer is spoofable
  });
});
```

**Target:** 90%+ coverage for `auth.ts`

---

## Wave 3: Parallel - High Priority Items

### Agent 5: Accessibility HIGH Priority

**Skills:** `aresweb-inclusive-design`
**Duration:** ~60 minutes

**Fixes:**
1. Add skip links to main layout
2. Fix focus traps in all modals
3. Add alt text to meaningful images
4. Ensure keyboard navigation works on all interactive elements
5. Add ARIA landmarks (main, nav, complementary)

---

### Agent 6: Brand Tailwind Color Cleanup

**Skills:** `aresweb-brand-enforcement`
**Duration:** ~60 minutes

#### BRAND-TAILWIND-1: Replace slate-* Colors

**Files:**
- `src/pages/Store.tsx`
- `src/components/store/CartDrawer.tsx`
- `src/components/store/ProductCard.tsx`
- `src/pages/Dashboard/StoreOrders.tsx`

**Fix Pattern:**
```tsx
// BEFORE
className="bg-slate-900 text-slate-300 border-slate-700"

// AFTER
className="bg-obsidian text-marble border-ares-bronze"
```

#### BRAND-TAILWIND-2: Replace zinc-* Colors

**Files:**
- `src/components/ai/GlobalRAGChatbot.tsx`
- `src/components/editor/CopilotMenu.tsx`
- `src/components/SimulationPlayground.tsx`

**Fix Pattern:**
```tsx
// BEFORE
className="bg-zinc-900 text-zinc-100"

// AFTER
className="bg-obsidian text-marble"
```

#### BRAND-TAILWIND-3: Replace Green/Emerald

**Fix Pattern:**
```tsx
// BEFORE
className="text-green-400 bg-green-500/10"
className="text-emerald-400 bg-emerald-500/10"

// AFTER
className="text-ares-success bg-ares-success/10"
```

#### BRAND-TAILWIND-4: Replace Indigo/Purple

**Fix Pattern:**
```tsx
// BEFORE - AI features
className="bg-indigo-600 text-indigo-400"

// AFTER - Rebrand to ARES cyan
className="bg-ares-cyan text-ares-cyan"

// BEFORE - RAG sources
className="text-purple-400 bg-purple-500/10"

// AFTER
className="text-ares-gold bg-ares-gold/10"
```

---

### Agent 7: Code Quality Cleanup

**Skills:** `aresweb-institutional-standards`
**Duration:** ~60 minutes

#### QUALITY-1: Split God Object

**File:** `functions/api/routes/events/handlers.ts` (1,427 lines)
**Fix Pattern:**
```typescript
// BEFORE - One giant file
// handlers.ts (1,427 lines)

// AFTER - Split into modules
functions/api/routes/events/
├── handlers/
│   ├── index.ts (exports)
│   ├── create.ts
│   ├── update.ts
│   ├── delete.ts
│   ├── list.ts
│   ├── signup.ts
│   └── utils.ts
```

#### QUALITY-2: Extract Duplicate Decryption Logic

**Fix Pattern:**
```typescript
// Create: shared/utils/decryption.ts

import { decrypt } from './crypto';

export function decryptField(encrypted: string | null): string | null {
  if (!encrypted) return null;
  try {
    const decrypted = decrypt(encrypted);
    if (!decrypted.startsWith('ENC:')) {
      throw new Error('Invalid encrypted format');
    }
    return decrypted.slice(4); // Remove ENC: prefix
  } catch {
    return null;
  }
}
```

#### QUALITY-3: Remove Auto-Generated `as any`

**File:** `src/routeTree.gen.ts`
**Action:** This is auto-generated by TanStack Router
**Fix:** Update router config or file issue upstream
**Note:** Not manual code, but indicates tooling issue

---

### Agent 8: Database Soft Delete Migration

**Skills:** `aresweb-database-management`
**Duration:** ~60 minutes

#### DB-DELETE-1: Replace Hard DELETE Operations

**Files Affected:** 34 locations
**Fix Pattern:**
```typescript
// BEFORE
await db.delete from(events).where(eq(events.id, id));

// AFTER
await db.update(events)
  .set({ isDeleted: true, deletedAt: new Date() })
  .where(eq(events.id, id));
```

**Files to Update:**
- `functions/api/routes/inquiries/handlers.ts`
- `functions/api/routes/docs.ts`
- `functions/api/routes/posts.ts`
- And 31 more files...

#### DB-DELETE-2: Add Soft Delete Indexes

**File:** `drizzle/schema.ts`
**Fix Pattern:**
```typescript
// Add to all tables with soft delete
export const events = sqliteTable('events', {
  // ... existing fields
  isDeleted: integer('isDeleted', { mode: 'boolean' }).notNull().default(false),
  deletedAt: integer('deletedAt', { mode: 'timestamp' }),
}, (table) => ({
  // Add partial index for non-deleted records
  idxNotDeleted: index('idx_events_not_deleted').on(table.id).where(sql`${table.isDeleted} = 0`),
}));
```

---

## Wave 4: Parallel - Medium Priority Items

### Agent 9: Brand Typography Fixer

**Skills:** `aresweb-brand-enforcement`
**Duration:** ~45 minutes

#### BRAND-TYPE-1: Inline Orbitron to Tailwind Class

**Files:** 10+ simulation files
**Fix Pattern:**
```tsx
// BEFORE
style={{ fontFamily: '"Orbitron", sans-serif' }}

// AFTER
className="font-sim-heading"
```

#### BRAND-TYPE-2: Inline JetBrains Mono to Tailwind

**Fix Pattern:**
```tsx
// BEFORE
style={{ fontFamily: '"JetBrains Mono", monospace' }}

// AFTER
className="font-sim-mono"
```

#### BRAND-TYPE-3: CSS Font Definitions

**Files:**
- `src/sims/PerformanceDashboard.css`
- `src/sims/TroubleshootingWizard.css`

**Fix Pattern:**
```css
/* BEFORE */
font-family: 'Orbitron';

/* AFTER */
font-family: var(--font-sim-heading);
```

---

### Agent 10: Error Handling Standardization

**Skills:** `aresweb-error-architecture`
**Duration:** ~45 minutes

#### ERROR-1: Replace Silent Catch Patterns

**Files:** 48+ locations
**Fix Pattern:**
```typescript
// BEFORE
try {
  await riskyOperation();
} catch {
  // Silent - no logging
}

// AFTER
import { logger } from '../../utils/logger';

try {
  await riskyOperation();
} catch (error) {
  logger.error('Operation failed', { error, context: 'riskyOperation' });
  throw new ApiError(500, 'Operation failed');
}
```

#### ERROR-2: Standardize Error Response Format

**Fix Pattern:**
```typescript
// Use existing standardErrors utility
import { standardErrors } from '../utils/standardErrors';

// In route handlers
if (!user) {
  throw standardErrors.unauthorized('User not found');
}
```

---

### Agent 11: API Standardization Fixer

**Skills:** `aresweb-api-reference`
**Duration:** ~45 minutes

#### API-STD-1: Standardize HTTP Methods

**Pattern:**
```typescript
// BEFORE
router.post('/posts/admin/:slug', ...)

// AFTER
router.patch('/posts/admin/:slug', ...)
```

#### API-STD-2: Standardize Response Naming

**Pattern:**
```typescript
// BEFORE - Mixed snake_case and camelCase
{ email_verified: true, memberType: "student" }

// AFTER - Consistent camelCase
{ emailVerified: true, memberType: "student" }
```

#### API-STD-3: Add Rate Limit Headers

**Pattern:**
```typescript
// In rate limiter middleware
c.header('X-RateLimit-Limit', limit.toString());
c.header('X-RateLimit-Remaining', remaining.toString());
c.header('X-RateLimit-Reset', reset.toString());
```

---

## Wave 5: Parallel - Remaining Items

### Agent 12: Test Coverage Expansion

**Skills:** `aresweb-testing-enforcement`
**Duration:** ~45 minutes

**Target Files** (29 untested):
- `functions/api/middleware/env.ts`
- `functions/api/middleware/cache.ts`
- `functions/api/middleware/cors.ts`
- `src/utils/apiClient.ts`
- And 25 more...

**Minimum Coverage Target:** 70% per file

---

### Agent 13: Dependency Updates

**Skills:** `aresweb-ci`
**Duration:** ~45 minutes

**Updates:**
1. **TipTap 3.22.5 → 3.23.1** (26 packages coordinated)
2. **@tiptap/extension-collaboration-cursor** - Fix deprecated version
3. **Vitest 2.x → 4.1.5** (security fix)
4. **@hono/zod-openapi** 1.3.0 → 1.4.0
5. **better-auth** 1.6.9 → 1.6.10

---

### Agent 14: Architecture Refactor

**Skills:** `aresweb-institutional-standards`
**Duration:** ~45 minutes

**Tasks:**
1. Evaluate `react-router-dom` (ghost dependency)
2. Consider TanStack Table implementation
3. Review layer boundary violations
4. Evaluate service extraction opportunities

---

## Wave 6: Accessibility Final Pass

**Agent:** Accessibility Fixer (Final Pass)
**Duration:** ~30 minutes

**Tasks:**
1. Add `<main role="main">` landmarks
2. Verify heading hierarchy (h1 → h2 → h3)
3. Add "In other words" sections for complex content
4. Verify 8th-grade reading level
5. Run Axe-core validation

---

## Wave 7: Verification & Testing

**Agent:** Verification Agent
**Duration:** ~30 minutes

**Tasks:**
1. Run all unit tests
2. Run TypeScript compilation (`npx tsc --noEmit`)
3. Run E2E tests with accessibility checks
4. Verify no regressions
5. Generate final audit report
6. Create rollback plan if needed

---

## ARESWEB Institutional Skills Compliance

| Skill | Applied In | Compliance |
|-------|------------|------------|
| `aresweb-typescript-safety` | Waves 2, 7 | ✅ |
| `aresweb-zero-trust-security` | Wave 1 | ✅ |
| `aresweb-inclusive-design` | Waves 2, 3, 6 | ✅ |
| `aresweb-brand-enforcement` | Waves 2, 3, 4 | ✅ |
| `aresweb-error-architecture` | Wave 4 | ✅ |
| `aresweb-database-management` | Wave 3 | ✅ |
| `aresweb-api-reference` | Wave 4 | ✅ |
| `aresweb-testing-enforcement` | Waves 2, 5, 7 | ✅ |
| `aresweb-ci` | Wave 5 | ✅ |
| `aresweb-institutional-standards` | Waves 3, 5 | ✅ |

---

## Success Criteria

After execution, verify:

- [ ] All 4 HIGH security issues fixed
- [ ] All 12 CRITICAL accessibility issues fixed
- [ ] All 50+ arbitrary hex codes replaced
- [ ] WCAG AA contrast ratio passes (4.5:1)
- [ ] All brand colors use semantic names
- [ ] No default Tailwind colors remain
- [ ] Manual `as any` reduced by 90%
- [ ] middleware/auth.ts has 90%+ test coverage
- [ ] All hard DELETEs converted to soft delete
- [ ] All tests pass (2601+ passed)
- [ ] TSC compiles with zero errors
- [ ] No regressions in E2E tests

---

## Estimated Timeline

| Wave | Duration | Agents |
|------|----------|--------|
| Wave 1: Security HIGH | 45 min | 1 |
| Wave 2: Critical Foundation | 60 min | 4 parallel |
| Wave 3: High Priority | 60 min | 4 parallel |
| Wave 4: Medium Priority | 45 min | 3 parallel |
| Wave 5: Remaining | 45 min | 3 parallel |
| Wave 6: Accessibility Final | 30 min | 1 |
| Wave 7: Verification | 30 min | 1 |
| **Total** | **~5-6 hours** | **15+ agents** |

---

## Rollback Plan

Each wave creates atomic commits. If critical issues arise:

1. **Identify the wave** that caused the issue
2. **Roll back by wave:** `git revert <wave-commit-range>`
3. **Preserve test additions** (move to separate branch)
4. **Re-execute failed wave** with adjustments
5. **Deploy rollback** to production if needed

---

## Execution Commands

### Full Automation

```bash
# Execute all waves sequentially
/gsd-quick "Execute comprehensive fix plan - all 7 waves for 600+ audit findings"
```

### Individual Waves

```bash
# Wave 1: Security HIGH
/gsd-quick "Execute Wave 1: Fix 4 HIGH severity security issues"

# Wave 2: Critical Foundation
/gsd-quick "Execute Wave 2: A11y CRITICAL, TypeScript core, Brand hex codes, Critical testing"

# Wave 3: High Priority
/gsd-quick "Execute Wave 3: A11y HIGH, Brand Tailwind colors, Code quality, Soft delete"

# And so on...
```

---

## Risk Assessment

| Wave | Risk Level | Mitigation |
|------|------------|------------|
| Wave 1 | LOW | Security fixes, well-tested patterns |
| Wave 2 | MEDIUM | Type safety changes may need adjustments |
| Wave 3 | MEDIUM | Color changes affect visuals, verify with QA |
| Wave 4 | LOW | Medium priority, lower impact |
| Wave 5 | MEDIUM | Dependency updates may have breaking changes |
| Wave 6 | LOW | Accessibility improvements only |
| Wave 7 | LOW | Verification only |

---

*Plan created: 2026-05-10*
*Ready for execution*
*Following ARESWEB Institutional Skills*
