# Photo collection boundary and failure-state audit

- Date: August 14, 2026
- Audited baseline: `4aaa2b833f9f6406b6a27b839c3db13acde0b944` (`origin/master`)
- Branch: `codex/next-audit-cycle-2`
- Initial worktree: clean and equal to the deployed baseline
- Supported verification runtime: Node `22.13.1`, pnpm `11.21.0`, OpenJDK `21.0.8`
- Scope: authenticated photo/album collection requests, pagination, stale-response behavior, failure truthfulness, retry interaction, and controller maintainability
- Production mutation: none

## Confirmed findings and remediation

### PCB-01 — Collection orchestration remained embedded in the 797-line page controller

- Severity: medium
- Confidence: high
- Evidence: after presentation panels were extracted, `src/app/dashboard/photos/page.tsx` still owned both collection state machines, ten loading/cursor state values, two request-sequence refs, both paginated fetch functions, and their mount/filter effects alongside photo editing, album editing, uploads, archive/restore, connection state, and Google Picker orchestration.
- Impact: a change to list fetching or pagination required reasoning across unrelated mutation and external-integration code. The request-sequence invariants that prevent an old response from replacing a newer filter result were especially easy to disturb.
- Remediation: [usePhotoCollectionData](../../src/app/dashboard/photos/usePhotoCollectionData.ts#L23) now owns only photo and album request state, pagination, deduplication, and independent stale-response sequences. It returns the existing setters because confirmed mutations still reconcile the authoritative DTOs locally. The page remains the controller for mutations and integration effects, but is reduced from 797 to 703 lines.
- Acceptance test: the pre-existing stale photo/filter and stale album/archive tests still exercise the hook through the real page. The photo and album cursor tests prove both explicit cursors are sent. Focused coverage measures the hook at 100% lines/functions.
- Status: fixed for the collection boundary. Upload, editor, archive, and Picker workflows remain deliberately in the controller for later independently reviewable extraction.

### PCB-02 — Failed collection reads were simultaneously described as empty libraries

- Severity: medium
- Confidence: high
- Evidence: the page previously stored every collection failure in one global error while `PhotoLibraryPanel` and `PhotoAlbumsPanel` rendered their normal empty states whenever the failed request left an empty array.
- Impact: an outage could display both “could not load” and “No photos match this view” or “No albums are ready yet.” The empty copy was not supported by a successful response and could lead a user to believe team media had disappeared.
- Remediation: the collection hook now keeps [photo and album errors separate](../../src/app/dashboard/photos/usePhotoCollectionData.ts#L38). Each panel renders a dedicated failure with its own native retry control through [PhotoManagementFailure](../../src/app/dashboard/photos/PhotoManagementPrimitives.tsx#L30), suppresses unsupported empty copy, and continues showing the last confirmed DTOs if a later refresh fails.
- Acceptance test: [MediaManagementPages.test.tsx](../../src/test/MediaManagementPages.test.tsx#L317) makes both initial requests fail independently, proves neither empty state is shown, retries each collection, and confirms the authoritative photo and album appear while their failure state clears.
- Status: fixed.

## Security and accessibility boundary

- The hook continues to use `authenticatedFetch` and the existing bounded DTO endpoints. No authorization, App Check, query limit, server route, or public-data boundary changed.
- Request sequencing remains independent per collection, so a photo filter change cannot invalidate an album request and vice versa.
- Failure controls are native buttons with visible focus and descriptive accessible names. The alert text is present in the DOM and uses the existing readable error tokens.
- The remediation does not claim manual WCAG conformance. Keyboard and screen-reader behavior remains subject to the repository's pending manual checklist.

## Verification evidence

Completed during implementation:

- focused media-management integration: 14 tests passed;
- new hook coverage: 100% lines/functions, 97.33% statements, and 90.47% branches;
- scoped ESLint: zero warnings;
- root TypeScript: passed;
- diff validation: clean apart from repository line-ending notices.

Completed on the supported runtime before handoff:

- frozen install and all agent-mirror validation passed;
- root and Functions lint passed with zero warnings;
- frontend coverage: 90 files and 520 tests passed (74.08% statements, 67.05% branches, 70.17% functions, 75.69% lines);
- Functions coverage: 45 files and 573 tests passed (93.51% statements, 82.45% branches, 98.32% functions, 94.84% lines);
- Firestore and Storage rules: 20 tests passed;
- production build passed, including 22 prerendered shells and a 17-entry/876.23 KiB PWA precache;
- every bundle budget passed;
- Playwright: 56 tests passed across Chromium, mobile Chromium, Firefox, and WebKit;
- production dependency audit reported no known vulnerabilities;
- deployment contract validated 8 Functions and 12 health checks;
- diff validation remained clean apart from repository line-ending notices.

Independent protected-branch CI, deployment, and read-only production verification remain required before these changes are described as released.
