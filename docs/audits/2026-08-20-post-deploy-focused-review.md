# Post-deploy focused review — 2026-08-20

**Audited commit:** `eba9ed25f285384af32049ad26dbd477a2d139ee`
(`master`, deployed successfully before this review)

**Starting state:** clean worktree. This review used bounded production observation
plus source and regression-test inspection. It did not enumerate private records,
read secrets, mutate production data, perform destructive testing, or claim WCAG
conformance. The fixes described below were local and had not been deployed when
this report was written.

**Scope:** recently changed PWA update behavior, public calendar/event boundaries,
recurring-event display, and mobile homepage/navigation/calendar/admin-event
interaction at a 390 x 844 viewport.

## Outcome

Two confirmed defects were found and fixed locally. No email address, telephone
number, legal student name, inquiry content, or other confirmed PII was observed
in the bounded public checks. The legacy event format nevertheless created a
credible private-notes disclosure path and is treated as a high-risk privacy
boundary defect.

### PDR-01 — MEDIUM — Dismissed PWA update prompt could immediately reappear

- **Confidence:** High; reproduced in the deployed application and source-confirmed.
- **Evidence:** the deployed “Portal update ready” prompt remained visible after
  its close button was activated and returned after reload. The component relied
  on `sessionStorage` alone when handling repeated service-worker refresh callbacks.
  The relevant control is now in `src/components/PwaUpdatePrompt.tsx:59-167`.
- **Impact:** users could not reliably dismiss a persistent overlay. On mobile it
  obstructed calendar and dashboard content and made the reload control appear
  ineffective.
- **Remediation:** retain an in-memory dismissal latch for the mounted component,
  while preserving session storage for navigation/reload persistence. Clear the
  latch only when the user intentionally starts update activation or activation
  succeeds.
- **Acceptance test:** `src/test/PwaUpdatePrompt.test.tsx` blocks storage writes,
  dismisses the prompt, emits another refresh callback, and proves the prompt
  remains hidden.

### PDR-02 — HIGH RISK — Legacy private event notes and locations crossed the public feed boundary

- **Confidence:** High in the code path and legacy format; no confirmed live PII
  was printed or retained during this review.
- **Evidence:** a deployed legacy event description visibly contained
  `--- Meeting Notes ---` followed by serialized editor content labelled for
  verified members. The public event DTO and iCalendar feed previously consumed
  the complete legacy description. The feed also emitted the raw legacy
  `location` field, bypassing the `isAddressPublic` venue control used by the
  public event-detail DTO. Recurrence exceptions consumed the managed event DTO,
  so their descriptions and locations had the same problem. Relevant controls
  are now in `functions/src/routes/calendarHelpers.ts:414-443` and
  `functions/src/routes/calendar.ts:1004-1059`.
- **Impact:** notes intended for members, or a legacy location such as a private
  meeting address, could be included in unauthenticated JSON or calendar
  subscription output.
- **Remediation:** public descriptions stop at the case-insensitive legacy marker.
  Managed DTOs retain the complete value for authorized editing. The same filter
  applies to base and overridden recurrence descriptions. The public subscription
  feed no longer emits raw legacy location fields; public event pages continue to
  expose only opted-in venue DTOs.
- **Acceptance test:** route/helper tests prove the public DTO and both feed event
  forms omit the marker suffix and raw location while managed DTOs preserve the
  complete legacy value.

## Production checks that passed

- Homepage content stayed within a 390-pixel viewport; the primary heading did
  not overflow horizontally.
- Mobile navigation opened as a labelled dialog, moved focus into the dialog,
  and remained within the viewport.
- The calendar loaded without console errors. Recurring event links appeared,
  and the sampled Saturday practice rendered as 6:00–8:00 PM.
- A sampled recurring-event detail URL loaded the selected occurrence and correct
  time without console errors.
- The mobile administrative event editor remained within the viewport and did
  not create body-level horizontal overflow.
- The public priority-announcement banner dismissed and stayed dismissed after
  reload.

## Verification

Focused tests after the fixes:

- PWA prompt: 13/13 passing.
- Calendar route and helper suites: 55/55 passing.
- Focused total: 68/68 passing.

Repository-wide verification also passed on Node 24.19.0 and pnpm 11.21.0:

- frozen-lockfile install and agent configuration validation;
- frontend and Functions lint with zero warnings;
- frontend type-check and Functions build;
- frontend coverage: 122 files, 675 tests, 79.85% lines, 74.83% functions;
- Functions coverage: 57 files, 717 tests, 95.38% lines, 97.91% functions;
- Firestore/Storage rules: 24 tests;
- production build, 25-route prerender, PWA generation, and all bundle budgets;
- Playwright: 90 tests across desktop Chromium/Firefox/WebKit and mobile
  Chromium/WebKit;
- production dependency audit: no known vulnerabilities.

Manual screen-reader and physical-device testing remains required for a
conformance claim.
