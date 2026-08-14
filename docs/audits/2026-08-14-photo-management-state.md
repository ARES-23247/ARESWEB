# Photo management state-consistency audit — 2026-08-14

## Scope and evidence

- Audited base commit: `a76a551fc5368495fa69708a2721b63d2771d197`
- Branch: `codex/next-audit-cycle`
- Initial worktree: clean; this report records the resulting dirty worktree before commit
- Runtime used for the release gate: Node `22.13.1`, pnpm `11.21.0`, JetBrains Runtime/OpenJDK `21.0.8`
- Scope: authenticated photo and album management state, pagination/filter races, reversible archive behavior, existing media-management tests, and repository-wide release regressions

The audit traced the live React page, `authenticatedFetch`, the photo and album DTOs, the corresponding Cloud Functions routes, and the existing media-management tests. No production data or configuration was changed.

## Confirmed findings and remediation

### PM-01 — Stale requests could replace a newer filtered view

- Severity: medium
- Confidence: high
- Evidence: the previous `loadPhotos` and `loadAlbums` callbacks applied every response without identifying which request was newest. Filter changes recreate the callbacks and start another request, so a slower prior request could resolve last and replace or append records from the wrong filter.
- Affected behavior: changing the album filter or archive visibility while a page request was pending could show records that did not belong to the selected view.
- Impact: operators could act on an outdated or mixed photo/album list until refreshing the page.
- Remediation: request sequences at [photo page](../../src/app/dashboard/photos/page.tsx#L124) now allow only the newest photo and album request to update data, errors, cursors, or loading state.
- Acceptance tests: the delayed-response cases at [media tests](../../src/test/MediaManagementPages.test.tsx#L280) and [media tests](../../src/test/MediaManagementPages.test.tsx#L340) prove that old photo and album responses cannot overwrite the newer filter result.
- Status: fixed.

### PM-02 — Inclusive archive views removed successfully mutated records

- Severity: medium
- Confidence: high
- Evidence: the APIs define `includeArchived=true` as active plus archived records, but the previous archive and restore handlers always filtered the affected item out of client state.
- Affected behavior: with **Show archived photos/albums** enabled, archiving or restoring an item made it disappear even though it still matched the inclusive server view.
- Impact: the UI contradicted the selected filter and made a successful reversible action look like deletion until the next reload.
- Remediation: archive handlers now preserve and update items when the inclusive view is active; restore handlers reconcile the authoritative photo or album DTO returned by the server. Album public state and media counts are updated consistently in local state. See [photo page](../../src/app/dashboard/photos/page.tsx#L401).
- Acceptance tests: the end-to-end component cases at [media tests](../../src/test/MediaManagementPages.test.tsx#L403) and [media tests](../../src/test/MediaManagementPages.test.tsx#L459) archive and restore both record types while proving they remain visible and their badges change correctly.
- Status: fixed.

### PM-03 — Photo and album pagination shared one busy flag

- Severity: low
- Confidence: high
- Evidence: both independent pagers used one `loadingMore` state. A request completing in a background tab could clear the busy state for the other pager.
- Affected behavior: fast tab switching during pagination could re-enable a still-running load-more action.
- Impact: avoidable duplicate requests and confusing button feedback.
- Remediation: photo and album pagination now have independent state at [photo page](../../src/app/dashboard/photos/page.tsx#L75), consumed by their respective controls at lines 967 and 1118.
- Acceptance test: the complete component suite and four-browser navigation suite pass; request-sequence tests also protect the underlying cross-request state transitions.
- Status: fixed.

## Verification executed

All commands below completed successfully under the supported runtime:

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

- Frontend: 90 files, 517 tests; 77.59% lines and 73.08% functions.
- Functions: 45 files, 573 tests; 94.84% lines and 98.32% functions.
- Firestore/Storage rules: 20 tests.
- Playwright: 52 tests across desktop Chromium, mobile Chromium, Firefox, and WebKit.
- Production build: 4,162 modules, 22 prerendered route shells, 17 PWA precache entries / 874.90 KiB.
- Bundle budgets: all six passed.
- Production dependency audit: no known vulnerabilities.
- Diff validation: clean except repository line-ending conversion notices.

## Residual risk and next work

- Follow-up: the 1,318-line page risk was addressed in the next independently reviewable cycle by extracting library, album, Google sync, and shared-state presentation modules. See `2026-08-14-photo-management-components.md`.
- This cycle did not mutate production media, exercise Google Picker import, or perform a legacy derivative backfill. Those actions require separate production-data approval.
- Automated accessibility and four-browser interaction gates passed, but this is not a new manual WCAG conformance claim.
