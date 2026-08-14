# Event-day printable match plan

- Date: August 14, 2026
- Audited baseline: `323b59095f60ffa18869691e99a98f77debf75e7` (`origin/master`)
- Branch: `codex/next-operations-cycle`
- Initial worktree: clean and equal to the deployed baseline
- Supported verification runtime: Node `22.13.1`, pnpm `11.21.0`, OpenJDK `21.0.8`
- Scope: authenticated tournament match handoff, print accessibility, data boundaries, and browser behavior
- Production mutation: none

## Confirmed workflow gap

### EDP-01 — The event-day checklist had no readable paper/PDF handoff

- Severity: low
- Confidence: high
- Evidence: the existing match toolbar exposed only the interactive checklist and formula-safe CSV export. The CSV was useful for spreadsheets, but the live workflow had no formatted preview or print action for queueing, pit review, or a device-loss fallback.
- Impact: volunteers had to reconstruct a readable match plan from the interactive page or reformat the CSV before using it as a paper handoff.
- Remediation: [TournamentMatchPrintDialog](../../src/app/tournaments/[id]/TournamentMatchPrintDialog.tsx#L16) provides a labeled Radix dialog containing event context, recorded summary values, every saved match, scores, and notes. The trigger is integrated next to the existing CSV export in [TournamentMatchesList](../../src/app/tournaments/[id]/TournamentMatchesList.tsx#L163). Print-specific rules isolate only the opened report in [globals.css](../../src/app/globals.css#L286).
- Acceptance test: [Tournaments.test.tsx](../../src/test/Tournaments.test.tsx#L368) proves the complete saved list remains in the preview when the visual search hides it, verifies event context and score/notes rendering, invokes printing, closes the dialog, and verifies focus restoration. [interactive.spec.ts](../../e2e/interactive.spec.ts#L85) exercises the flow in a built browser application with API responses at the existing DTO boundary.
- Status: fixed in this branch; full release verification and protected deployment remain pending.

## Security, privacy, and accessibility boundary

- The preview consumes only the authenticated tournament and match DTOs already loaded by the detail page. It adds no request, Firestore read, Storage read, secret, permission, or server route.
- The report deliberately includes internal scouting notes because the existing authenticated CSV includes the same field. Copy warns users that those notes remain in the local printout.
- React escapes every user-controlled value. No HTML or formula interpretation is introduced.
- Radix supplies the modal label, focus containment, Escape handling, background inertness, and trigger focus restoration. The preview uses native headings, description lists, a captioned table, column scopes, and row-header scopes.
- The print layout contains all matches, not only the current search result, so a temporary UI filter cannot produce an incomplete event-day handoff.

## Verification evidence

Completed during implementation:

- focused tournament integration: 14 tests passed;
- new component focused coverage: 100% statements, branches, functions, and lines;
- focused Chromium built-app flow: 1 test passed;
- scoped ESLint: zero warnings;
- root TypeScript: passed;
- diff validation: clean apart from repository line-ending notices.

Complete supported-runtime gate:

- frozen install and shared Codex/Gemini/Antigravity/Copilot skill validation: passed;
- root and Functions ESLint: passed with zero warnings;
- root TypeScript and Functions build: passed;
- frontend coverage: 90 files / 518 tests, 75.28% lines and 69.71% functions; the new print dialog measured 100% statements, branches, functions, and lines;
- Functions coverage: 45 files / 573 tests, 94.84% lines and 98.32% functions;
- Firestore and Storage emulator rules: 20 tests passed;
- production build: 4,167 modules and 22 prerendered public shells; PWA precache remained bounded at 17 entries / 876.23 KiB;
- all six bundle budgets passed;
- Playwright: 56/56 tests across desktop Chromium, mobile Chromium, Firefox, and WebKit;
- production dependency audit: no known vulnerabilities;
- production deployment contract: valid for 8 Functions and 12 health checks;
- diff validation: clean apart from repository line-ending notices.

Independent protected-branch CI and read-only production verification remain required before this feature is described as released. Automated semantics and browser checks do not establish manual WCAG conformance; print preview should still receive a human page-break and legibility check with representative multi-page match data.
