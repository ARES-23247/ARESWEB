# Photo management component-boundary audit — 2026-08-14

## Scope and evidence

- Audited base commit: `b63fb9e70a2b4d582e35766f942e55481db546d5`
- Branch: `codex/photo-management-components`
- Initial worktree: clean and equal to the deployed `origin/master`
- Runtime: Node `22.13.1`, pnpm `11.21.0`, JetBrains Runtime/OpenJDK `21.0.8`
- Scope: photo-dashboard presentation boundaries, mutation interlocks, coverage visibility, and a release-gate WebKit failure found during verification

This cycle preserved the existing authenticated APIs, request sequencing, DTOs, authorization, and data mutations. It changed component boundaries and client interaction state only. No production data or configuration was changed.

## Confirmed findings and remediation

### PMC-01 — One page owned unrelated presentation systems

- Severity: medium
- Confidence: high
- Evidence: `src/app/dashboard/photos/page.tsx` was 1,318 lines and combined request orchestration with upload controls, the library grid, album cards, Google Picker status, shared loading states, and dialogs.
- Impact: changes to one photo workflow required reviewing a large unrelated JSX surface, increasing regression and merge-conflict risk in a security-sensitive media area.
- Remediation: the page now retains controller state and side effects while rendering focused modules at [photo page](../../src/app/dashboard/photos/page.tsx#L696). `PhotoLibraryPanel.tsx` is 345 lines, `PhotoAlbumsPanel.tsx` 189, `GooglePhotosSyncPanel.tsx` 152, and shared primitives 51. The controller page is now 797 lines.
- Acceptance test: the existing library, album, sync, edit, archive, restore, pagination, and race tests exercise the extracted modules through the real page. TypeScript and production builds resolve every new boundary.
- Status: fixed for presentation concerns. A later cycle may extract controller hooks if it can preserve request ordering and error semantics.

### PMC-02 — Independent mutation controls stayed enabled during restore/archive work

- Severity: medium
- Confidence: high
- Evidence: the page used one `actionBusy` mutation state, but album edit/archive/restore/create and photo edit/archive buttons did not all consume it.
- Impact: a user could start another archive or restore action while the first request was pending, making global busy/error state ambiguous and increasing the chance of overlapping writes.
- Remediation: every mutation-opening control in [photo library panel](../../src/app/dashboard/photos/PhotoLibraryPanel.tsx#L300) and [album panel](../../src/app/dashboard/photos/PhotoAlbumsPanel.tsx#L56) now disables consistently while `actionBusy` is true. Read-only navigation remains available.
- Acceptance test: [media-management test](../../src/test/MediaManagementPages.test.tsx#L529) holds a restore response open, proves competing edit/archive controls are disabled, then proves they re-enable after the authoritative response arrives.
- Status: fixed.

### PMC-03 — Photo management was absent from the primary coverage denominator

- Severity: medium
- Confidence: high
- Evidence: the explicit coverage include list omitted the entire authenticated photo-management surface, so its files could disappear from the main report even though media tests ran.
- Impact: test removal or untested refactors could remain invisible to coverage ratchets.
- Remediation: [Vite/Vitest config](../../vite.config.ts#L167) now instruments all `src/app/dashboard/photos/*.tsx` files.
- Acceptance test: the full coverage run reports the photo-management directory explicitly at 62.29% lines and 54.81% functions; aggregate measured coverage remains above the existing ratchets at 75.22% lines and 69.54% functions.
- Status: fixed. The measured figures are baselines for improvement, not a completeness claim.

### PMC-04 — Saturated WebKit could lose the first task-title fill during a development remount

- Severity: low
- Confidence: medium
- Evidence: the first complete four-browser run failed once because the task-title fill returned while the controlled input/button state stayed empty/disabled. Five isolated WebKit repetitions then passed, matching the repository's already documented development-remount behavior for the blog editor.
- Impact: a nondeterministic release gate could reject unrelated verified changes without proving a product failure.
- Remediation: [Playwright task flow](../../e2e/interactive.spec.ts#L53) now retries the complete user action together with exact input-value and enabled-button assertions. It does not retry a bare assertion or weaken the expected behavior.
- Acceptance test: five isolated WebKit repetitions passed before the change, and the subsequent complete 52-test/four-browser run passed with the strengthened action/value/result assertion.
- Status: fixed as a test-fidelity issue; no production task code changed.

## Verification executed

```text
pnpm install --frozen-lockfile
pnpm run validate:agents
pnpm run lint
pnpm --filter functions lint
pnpm exec tsc --noEmit
pnpm run test:coverage
pnpm --filter functions build
pnpm --filter functions test:coverage
pnpm run test:rules
pnpm run build
node scripts/check-bundle-size.mjs
pnpm run test:e2e
pnpm audit --prod --audit-level=high
git diff --check
```

Results:

- Frontend: 90 files, 518 tests; 75.22% lines and 69.54% functions after expanding the denominator.
- Photo management: 62.29% lines and 54.81% functions, now explicitly reported.
- Functions: 45 files, 573 tests; 94.84% lines and 98.32% functions.
- Firestore/Storage rules: 20 tests.
- Playwright: final complete run 52/52 across desktop Chromium, mobile Chromium, Firefox, and WebKit.
- Build: 4,166 modules, 22 prerendered shells, 17 PWA precache entries / 874.90 KiB.
- Bundle budgets: all six passed.
- Production dependency audit: no known vulnerabilities.
- Diff validation: clean except repository line-ending conversion notices.

## Residual risk

- The 797-line controller still owns several related asynchronous workflows. Further extraction should be controller-oriented and must retain the request-sequence guards added in the prior cycle.
- Coverage now exposes rather than hides the photo surface, but several Google Picker, upload failure, and dialog branches remain below the repository's standard for new utilities. Raising those figures requires behavioral tests, not exclusions or lower global thresholds.
- Google Picker import, real uploads, archive/restore writes, and legacy derivative backfill were not exercised against production because they mutate team data and require separate approval.
- Automated accessibility and four-browser checks passed; this is not a manual WCAG conformance claim.
