# Lint Error Remediation Plan

**Total Issues:** 495 problems (445 errors, 50 warnings)
**Target:** Zero lint errors to comply with ARES TypeScript Safety skill

---

## Phase 0: Quick Wins (Single Agent, ~5 min)

**Auto-fixable issues:** 79 errors across 21 source files

### Agent: QuickFix
Run `eslint --fix` on all files with fixable issues:

```bash
npx eslint . --fix
```

**Files affected (21):**
- [src/api/events.ts](src/api/events.ts) - 11 fixable
- [src/api/docs.ts](src/api/docs.ts) - 8 fixable
- [src/api/posts.ts](src/api/posts.ts) - 8 fixable
- [src/api/badges.ts](src/api/badges.ts) - 4 fixable
- [src/api/finance.ts](src/api/finance.ts) - 4 fixable
- [src/api/inquiries.ts](src/api/inquiries.ts) - 4 fixable
- [src/api/seasons.ts](src/api/seasons.ts) - 4 fixable
- [src/api/socialQueue.ts](src/api/socialQueue.ts) - 4 fixable
- [src/api/tasks.ts](src/api/tasks.ts) - 4 fixable
- [src/api/media.ts](src/api/media.ts) - 3 fixable
- [src/api/notifications.ts](src/api/notifications.ts) - 3 fixable
- [src/api/sponsors.ts](src/api/sponsors.ts) - 3 fixable
- [src/api/users.ts](src/api/users.ts) - 3 fixable
- [src/api/awards.ts](src/api/awards.ts) - 2 fixable
- [src/api/locations.ts](src/api/locations.ts) - 2 fixable
- [src/api/outreach.ts](src/api/outreach.ts) - 2 fixable
- [src/api/profiles.ts](src/api/profiles.ts) - 2 fixable
- [src/api/simulations.ts](src/api/simulations.ts) - 2 fixable
- [src/api/zulip.ts](src/api/zulip.ts) - 2 fixable
- [src/api/judges.ts](src/api/judges.ts) - 1 fixable
- [src/api/points.ts](src/api/points.ts) - 1 fixable
- [src/api/settings.ts](src/api/settings.ts) - 1 fixable
- [src/api/store.ts](src/api/store.ts) - 1 fixable

---

## Phase 1: Source Files - Unused ESLint Disables (Single Agent, ~15 min)

**Pattern:** Files with `// eslint-disable-next-line @typescript-eslint/no-explicit-any` that's no longer needed (error is suppressed, not fixed)

### Agent: EslintDisableCleanup
**Files (21):** Same list as Phase 0

**Action:** For each file:
1. Remove the unused `eslint-disable` comment
2. Replace the `any` type with proper zod-inferred type
3. Follow ARES TypeScript Safety skill requirements

**Example transformation:**
```typescript
// BEFORE
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async functionSomething(props: any) {

// AFTER
import { someSchema } from './schema';
async functionSomething(props: z.infer<typeof someSchema>) {
```

---

## Phase 2: Unused Variables (Single Agent, ~20 min)

**Pattern:** `@typescript-eslint/no-unused-vars` warnings (50 total)

### Agent: UnusedVarsCleanup

#### Group A: functions/utils/*.test.ts (9 files, ~20 warnings)
- [functions/utils/content.test.ts](functions/utils/content.test.ts) - 1 warning
- [functions/utils/json.test.ts](functions/utils/json.test.ts) - 1 warning
- [functions/utils/postHistory.test.ts](functions/utils/postHistory.test.ts) - 9 warnings
- [functions/utils/social/band.test.ts](functions/utils/social/band.test.ts) - 3 warnings
- [functions/utils/social/bluesky.test.ts](functions/utils/social/bluesky.test.ts) - 3 warnings
- [functions/utils/social/twitter.test.ts](functions/utils/social/twitter.test.ts) - 4 warnings
- [functions/utils/zulipSync.test.ts](functions/utils/zulipSync.test.ts) - 2 warnings

#### Group B: tests/e2e/*.spec.ts (14 files, ~20 warnings)
- [tests/e2e/admin-inquiries.spec.ts](tests/e2e/admin-inquiries.spec.ts) - 1 warning
- [tests/e2e/badges-manager.spec.ts](tests/e2e/badges-manager.spec.ts) - 2 warnings
- [tests/e2e/blog-editor.spec.ts](tests/e2e/blog-editor.spec.ts) - 1 warning
- [tests/e2e/finance-manager.spec.ts](tests/e2e/finance-manager.spec.ts) - 6 warnings
- [tests/e2e/gallery.spec.ts](tests/e2e/gallery.spec.ts) - 1 warning
- [tests/e2e/locations-manager.spec.ts](tests/e2e/locations-manager.spec.ts) - 1 warning
- [tests/e2e/mass-email.spec.ts](tests/e2e/mass-email.spec.ts) - 2 warnings
- [tests/e2e/member-impact.spec.ts](tests/e2e/member-impact.spec.ts) - 2 warnings
- [tests/e2e/season-editor.spec.ts](tests/e2e/season-editor.spec.ts) - 1 warning
- [tests/e2e/sim-manager.spec.ts](tests/e2e/sim-manager.spec.ts) - 2 warnings
- [tests/e2e/store-orders.spec.ts](tests/e2e/store-orders.spec.ts) - 1 warning
- [tests/e2e/task-detail.spec.ts](tests/e2e/task-detail.spec.ts) - 1 warning

#### Group C: src/ test files (2 files, ~10 warnings)
- [src/components/calendar/MonthViewGrid.test.tsx](src/components/calendar/MonthViewGrid.test.tsx) - 2 warnings
- [src/components/editor/CommandsList.test.tsx](src/components/editor/CommandsList.test.tsx) - 3 warnings

**Action:** Prefix unused variables with `_` or remove entirely

---

## Phase 3: Test Files - `any` Type Fixes (5 Agents, ~2-3 hours total)

**Pattern:** `vi.fn().mockResolvedValue<any>(...)` in test files (~300+ errors)

### Agent Group: TestAnyFix-A (High Error Count)

**Files (7, ~90 errors):**
- [src/components/kanban/TaskDetailsModal.test.tsx](src/components/kanban/TaskDetailsModal.test.tsx) - 20 errors
- [functions/api/routes/routes-integration.test.ts](functions/api/routes/routes-integration.test.ts) - 18 errors
- [src/api/events.test.tsx](src/api/events.test.tsx) - 13 errors
- [src/api/docs.test.tsx](src/api/docs.test.tsx) - 12 errors
- [src/api/media.test.tsx](src/api/media.test.tsx) - 12 errors
- [src/api/finance.test.tsx](src/api/finance.test.tsx) - 11 errors
- [src/api/inquiries.test.tsx](src/api/inquiries.test.tsx) - 11 errors

### Agent Group: TestAnyFix-B (Medium-High Error Count)

**Files (7, ~70 errors):**
- [src/api/posts.test.tsx](src/api/posts.test.tsx) - 11 errors
- [src/api/sponsors.test.tsx](src/api/sponsors.test.tsx) - 11 errors
- [src/api/badges.test.tsx](src/api/badges.test.tsx) - 10 errors
- [src/api/socialQueue.test.tsx](src/api/socialQueue.test.tsx) - 10 errors
- [src/api/tasks.test.tsx](src/api/tasks.test.tsx) - 10 errors
- [src/api/simulations.test.tsx](src/api/simulations.test.tsx) - 9 errors
- [src/components/editor/useRichEditor.test.ts](src/components/editor/useRichEditor.test.ts) - 9 errors

### Agent Group: TestAnyFix-C (Medium Error Count)

**Files (8, ~65 errors):**
- [src/api/awards.test.tsx](src/api/awards.test.tsx) - 8 errors
- [src/api/locations.test.tsx](src/api/locations.test.tsx) - 8 errors
- [src/api/outreach.test.tsx](src/api/outreach.test.tsx) - 8 errors
- [src/api/profiles.test.tsx](src/api/profiles.test.tsx) - 8 errors
- [src/api/users.test.tsx](src/api/users.test.tsx) - 8 errors
- [src/api/notifications.test.tsx](src/api/notifications.test.tsx) - 7 errors
- [src/api/zulip.test.tsx](src/api/zulip.test.tsx) - 7 errors
- [src/api/ai.test.tsx](src/api/ai.test.tsx) - 6 errors

### Agent Group: TestAnyFix-D (Low-Medium Error Count)

**Files (8, ~45 errors):**
- [src/api/seasons.test.tsx](src/api/seasons.test.tsx) - 6 errors
- [src/api/store.test.tsx](src/api/store.test.tsx) - 6 errors
- [src/components/AdminInquiries.test.tsx](src/components/AdminInquiries.test.tsx) - 6 errors
- [src/api/judges.test.tsx](src/api/judges.test.tsx) - 5 errors
- [src/api/points.test.tsx](src/api/points.test.tsx) - 5 errors
- [src/api/analytics.test.tsx](src/api/analytics.test.tsx) - 4 errors
- [src/api/communications.test.tsx](src/api/communications.test.tsx) - 4 errors
- [src/api/github.test.tsx](src/api/github.test.tsx) - 4 errors

### Agent Group: TestAnyFix-E (Remaining)

**Files (10, ~30 errors):**
- [src/api/settings.test.tsx](src/api/settings.test.tsx) - 4 errors
- [functions/utils/caseMapper.test.ts](functions/utils/caseMapper.test.ts) - 3 errors
- [src/hooks/useSimulationChat.test.ts](src/hooks/useSimulationChat.test.ts) - 3 errors
- [src/hooks/useSimulationChat.test.tsx](src/hooks/useSimulationChat.test.tsx) - 1 error
- [src/api/honoClient.test.ts](src/api/honoClient.test.ts) - 1 error
- [src/api/tba.test.tsx](src/api/tba.test.tsx) - 1 error
- [src/utils/security.test.ts](src/utils/security.test.ts) - 2 errors
- [src/utils/content.test.ts](src/utils/content.test.ts) - 1 error
- [src/utils/lazyBabel.test.ts](src/utils/lazyBabel.test.ts) - 1 error

**Action for all agents:**
1. Read the corresponding source file to understand proper types
2. Replace `any` with proper Mock types using `vi.fn().mockResolvedValue<T>(...)`
3. Where T is the return type from the actual API function

**Example transformation:**
```typescript
// BEFORE
const mockGetAwards = vi.fn().mockResolvedValue<any>(mockAwards);

// AFTER
import { AwardsResponse } from './awards';
const mockGetAwards = vi.fn().mockResolvedValue<AwardsResponse>(mockAwards);
```

---

## Execution Order

1. **Phase 0** - Auto-fix (5 min) → Reduces to 416 errors
2. **Phase 1** - Source file `any` types (15 min) → Reduces to ~370 errors
3. **Phase 2** - Unused vars (20 min) → Eliminates 50 warnings
4. **Phase 3** - Test file `any` types (parallel, 2-3 hours) → Final cleanup

**Total estimated time:** ~3 hours with parallel agents

---

## Progress Tracking

| Phase | Agent | Files | Errors | Status |
|-------|-------|-------|--------|--------|
| 0 | QuickFix | 21 | 79 | ⬜ Pending |
| 1 | EslintDisableCleanup | 21 | ~50 | ⬜ Pending |
| 2A | UnusedVarsCleanup (functions) | 7 | ~20 | ⬜ Pending |
| 2B | UnusedVarsCleanup (e2e) | 14 | ~20 | ⬜ Pending |
| 3A | TestAnyFix-A | 7 | ~90 | ⬜ Pending |
| 3B | TestAnyFix-B | 7 | ~70 | ⬜ Pending |
| 3C | TestAnyFix-C | 8 | ~65 | ⬜ Pending |
| 3D | TestAnyFix-D | 8 | ~45 | ⬜ Pending |
| 3E | TestAnyFix-E | 10 | ~30 | ⬜ Pending |

---

## Verification Command

```bash
npm run lint
```

Expected output: `✖ 0 problems (0 errors, 0 warnings)`
