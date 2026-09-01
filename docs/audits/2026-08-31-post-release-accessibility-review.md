# ARESWEB post-release accessibility and responsive review

Date: 2026-08-31  
Branch: `codex/post-release-hardening-refinement`  
Audited commit at review start: `5990d034c2c848aa28c2685f882653d6bced2a9f`  
Compared with `origin/master`: `9fc56645edfef3e3c651b4b5dc14983c90f4f9d1`  
Worktree at review start: modified by the active, unreleased hardening goal

## Scope and method

This was a bounded manual and source-assisted review, not a claim of complete
WCAG 2.2 AA conformance. It covered:

- the public home page at 320 × 568 and 390 × 844 CSS pixels;
- the student inquiry form at 320 × 568 and 390 × 844 CSS pixels;
- a published Academy robotics lesson at 390 × 844 CSS pixels;
- the signed-in dashboard and its navigation at 390 × 844 CSS pixels;
- the public and dashboard mobile navigation drawers;
- the public video player and tournament print-dialog stacking source;
- skip-navigation wiring and regression coverage.

The review used the local production build for unreleased source, the live site
for production-backed Academy and dashboard data, DOM/accessibility snapshots,
rendered screenshots, keyboard Escape/focus checks, responsive overflow
measurements, focused Vitest regressions, and production-build CSS inspection.

The live site still represented the previous deployed revision while this
review was in progress. Local Academy data APIs intentionally failed closed in
the static preview because Firebase/App Check does not trust that origin, so the
new flowchart renderer was verified through its complete checked-in content
corpus and component tests rather than a live local Firestore response.

## Confirmed findings and remediation

### A11Y-01 — Closed documentation drawer exposed stale modal semantics

- Severity: Medium
- Confidence: High
- Status: Fixed in this branch
- Evidence: the prior `DocsSidebar` always assigned `role="dialog"` and
  `aria-modal="true"` at mobile widths, even when translated off-screen. It
  focused the search control when opened but did not contain subsequent Tab
  focus or make lesson content inert.
- Impact: screen-reader and keyboard users could encounter a modal boundary
  that did not match the visible UI, and keyboard focus could leave the open
  drawer for obscured lesson controls.
- Remediation: `src/components/docs/DocsSidebar.tsx:29-78` now uses the shared
  focus trap, locks background scrolling, and restores the previous inert and
  `aria-hidden` states. Lines 117-146 expose dialog semantics only while the
  drawer is open and provide an in-dialog 44 × 44 CSS-pixel close control.
- Acceptance test: `src/test/DocsSidebarAccessibility.test.tsx:24` verifies the
  closed/open semantics, inert background, contained focus, Escape close, and
  exact trigger focus restoration.

### A11Y-02 — Dashboard drawer did not identify its focus-return trigger

- Severity: Medium
- Confidence: High
- Status: Fixed in this branch
- Evidence: manual testing of the live mobile dashboard showed focus on
  `Close sidebar` while open, but Escape left focus on `body`. The open button
  changed the controlled Radix state directly and was not a `Dialog.Trigger`.
- Impact: keyboard and switch users had to restart navigation after closing the
  drawer instead of returning to the control that opened it.
- Remediation: `src/app/dashboard/layout.tsx:282` now wraps the open button with
  `Dialog.Trigger asChild`, allowing Radix to restore focus to the exact trigger.
- Acceptance test: `src/test/DashboardMobileNavigation.test.tsx:111` verifies
  Escape closes the dialog and returns focus to `Open sidebar menu`.

### A11Y-03 — Two dialogs used an undefined stacking utility

- Severity: Medium
- Confidence: High
- Status: Fixed in this branch
- Evidence: `src/app/videos/page.tsx` and
  `src/app/tournaments/[id]/TournamentMatchPrintDialog.tsx` used `z-modal`, but
  the current Tailwind configuration generated no such utility.
- Impact: the video and tournament dialogs could render under headers,
  announcements, or other positioned content, especially on mobile.
- Remediation: overlays now use explicit `z-[80]` and dialog content uses
  `z-[81]` at `src/app/videos/page.tsx:297-298` and
  `src/app/tournaments/[id]/TournamentMatchPrintDialog.tsx:44-45`.
- Acceptance test: the focused video/modal tests pass, and the production build
  contains both explicit z-index utilities.

## Manual checks that passed

- No horizontal document overflow was measured on the home page, join form,
  Academy lesson, or signed-in dashboard at the tested mobile widths.
- At 320 CSS pixels, the complete home-page heading remained inside the
  viewport; `Engineered` and `To Inspire` rendered at 38.4 CSS pixels without
  clipping.
- The join form exposed accessible names for all text fields, the grade select,
  the interest checkbox group and each checkbox, the tab controls, and the
  submit action.
- The public mobile navigation exposed a named modal dialog. Escape closed it
  and restored focus to `Open navigation menu`; the page had zero horizontal
  overflow.
- The published Academy lesson exposed one H1, a named local-progress region,
  explicit lesson metadata, verified-source links, and an accessible summary
  for its diagram.
- The signed-in dashboard exposed a single H1 and no horizontal overflow at
  390 CSS pixels. The Radix drawer placed initial focus on its close button.
- The bounded flowchart replacement parses every checked-in learning diagram,
  retains an accessible figure label, and falls back to visible source for
  unsupported or oversized input rather than injecting SVG or hiding failure.

## Limitations and follow-up

- No assistive-technology session with NVDA, JAWS, VoiceOver, voice control, or
  switch hardware was performed.
- Manual review sampled representative public and authenticated flows; it did
  not manually traverse every dashboard editor or every curriculum interaction.
- Browser zoom/reflow at 200% and 400% remains covered primarily by automation,
  not a complete manual page-by-page pass in this review.
- The full repository coverage, emulator, Playwright, build, audit, and release
  gates must pass before merge or deployment. Passing this bounded review alone
  is not evidence of complete accessibility conformance.

## Verification result

The complete local release gate passed after remediation:

- shared agent configuration, 100 mutation-route security invariants, and the
  Functions deployment lock validated;
- frontend and Functions lint plus TypeScript passed;
- 1,130 frontend tests passed with 85.17% line coverage;
- 807 Functions tests passed with 95.32% line coverage;
- 31 Firestore and Storage emulator rules tests passed;
- the production build and every bundle budget passed;
- 162 Playwright tests passed across desktop Chromium, mobile Chromium, mobile
  WebKit, Firefox, desktop WebKit, and the dedicated PWA worker project;
- the production dependency audit reported no known vulnerabilities.

These results establish the tested scope and date; they do not convert this
bounded review into an unconditional accessibility or security claim.
