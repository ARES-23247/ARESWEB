# ARESWEB maintainability and monolith audit

Date: 2026-08-29  
Branch: `codex/academy-robotics-curriculum-expansion`  
Audited commit: `e71151230c9915023c1c7c543f2ae37a0080b0d5`  
Compared with: `origin/master` at `5cd09833ed068e2e25b49aa5ae7f9fe8ba1a0aef`  
Worktree at audit start: modified `e2e/navigation.spec.ts` and
`src/components/layout/LayoutWrapper.tsx`  
Branch divergence at audit start: 2 commits behind and 46 commits ahead of
`origin/master`

## Scope and method

This focused audit reviewed current source and configuration for file-level
monoliths and maintainability debt. It inventoried TypeScript, TSX, JavaScript,
CSS, route modules, generated registries, tests, Git state, and prior debt leads.
Large files were not classified as monoliths from size alone: the review also
checked responsibilities, state ownership, endpoint count, imports, generated
status, registrations, references, tests, and recent change frequency.

The audit did not change production state and did not claim a complete security,
accessibility, or correctness review.

## Executive conclusion

ARESWEB is not an application-level monolith. The backend is split into five
Cloud Function applications and 38 route modules, while the frontend has 51 page
modules and 92 separately lazy-loaded interactive modules. The former monolithic
Functions API has therefore been materially addressed.

There is, however, one clear backend file monolith and four high-value frontend
refactoring clusters. These are maintainability and regression-risk findings,
not evidence that the live site is currently broken.

## Confirmed findings

### MT-01 — Calendar route is a file-level backend monolith

- Severity: Medium
- Confidence: High
- Status: Confirmed, live code
- Evidence:
  - `functions/src/routes/calendar.ts` is 1,294 physical lines.
  - The router begins at line 238 and registers 25 endpoints.
  - Public event and media delivery starts at lines 313-478.
  - Managed event lifecycle routes start at lines 636-844.
  - Recurrence exception routes start at lines 870-982.
  - Location management starts at line 1026.
  - Calendar feed generation starts at line 1133.
  - The same file has changed in 16 of the last 200 repository commits that
    touched it.
- Affected behavior: public calendar reads, event media, event management,
  recurrence overrides, locations, and iCalendar feeds share one route module.
- Impact: unrelated calendar changes collide in the same file and test harness;
  route-level reasoning and review become slower, and regression scope is larger
  than necessary.
- Remediation: retain the `/api/calendar` mount but register separate routers or
  route registrars for public events/media, managed events, occurrences,
  locations, and feeds. Keep DTO/schema helpers separate from transport code.
- Acceptance test: all existing calendar route/helper tests pass; the 25 route
  method/path pairs and their middleware order are unchanged; route-security,
  emulator rules, coverage, and public calendar Playwright flows pass.

### MT-02 — Event editing concentrates five domains in one state hook

- Severity: Medium
- Confidence: High
- Status: Confirmed, live code
- Evidence:
  - `src/app/dashboard/events/hooks/useEventEditor.ts` is 682 physical lines and
    declares 33 `useState` calls at lines 106-143.
  - It owns role/publish policy at lines 152-169, live roster/photo subscriptions
    at lines 178-303, revision loading at line 329, event lifecycle actions at
    lines 374-477, media actions at lines 497-574, and recurrence actions at
    lines 577-607.
  - The hook has changed in 15 of the last 200 commits that touched it.
- Affected behavior: event form state, authorization-derived UI state, roster,
  photos, revisions, uploads, and recurring occurrence management.
- Impact: a change to one tab or data source can cause rerenders or regressions in
  unrelated editor behavior; the returned controller surface is difficult to
  understand and mock.
- Remediation: compose `useEventForm`, `useEventRoster`, `useEventPhotos`,
  `useEventRevisions`, and `useEventOccurrences` behind a small editor
  coordinator. Keep permission derivation in a pure utility.
- Acceptance test: `src/test/useEventEditor.test.tsx` remains green and gains
  focused tests for each extracted hook; the editor drawer Playwright flow covers
  series and individual-occurrence edits, photo approval, and explicit failure
  states.

### MT-03 — Task management has coupled page and modal monoliths

- Severity: Medium
- Confidence: High
- Status: Confirmed, live code
- Evidence:
  - `src/app/dashboard/tasks/page.tsx` is 704 physical lines and combines live
    loading, filtering, revision writes, Zulip synchronization, drag/drop,
    archive operations, subtasks, creation, and board rendering (notably lines
    101-489).
  - `src/app/dashboard/tasks/components/TaskDetailsModal.tsx` is 818 physical
    lines with 19 `useState` declarations at lines 61-78, Firestore revision
    subscription logic at lines 99-147, save orchestration at line 152, subtask
    mutation at line 295, delete flow at line 307, and a large renderer beginning
    at line 326.
  - The two files have changed in 21 and 12 of their last 200 touching commits,
    respectively.
- Affected behavior: Kanban data orchestration, revisions, integrations,
  drag/drop, task editing, comments, subtasks, AI assistance, and deletion.
- Impact: the feature has a broad regression surface and requires heavy component
  mocks; presentation and persistence changes are not independently reviewable.
- Remediation: introduce a task-board controller/service, extract task-form,
  revision-history, subtask, and delete-confirmation components, and keep the
  modal as accessible dialog composition only.
- Acceptance test: task reliability and modal reliability suites pass; new tests
  cover the extracted controller without rendering the board; Playwright verifies
  keyboard and touch task movement, create/edit/archive, and error recovery.

### MT-04 — Academy page is an overextended route coordinator

- Severity: Medium
- Confidence: High
- Status: Confirmed, live code
- Evidence:
  - `src/app/academy/page.tsx` is 770 physical lines and has changed in 23 of the
    last 200 commits that touched it.
  - It owns dual `/academy` and `/docs` routing at lines 50-69, document loading
    and search/path derivation at lines 71-215, feedback writes at lines 235-267,
    the search overlay at line 275, sidebar composition at line 391, progress and
    prerequisite UI at lines 507-580, related navigation at line 647, feedback at
    line 711, and discussion at line 759.
- Affected behavior: two documentation products, loading/error state, search,
  learning paths, local progress, feedback, related lessons, editor links, and
  discussion.
- Impact: curriculum UI additions repeatedly touch a central page and make it
  harder to test loading, navigation, search, and feedback independently.
- Remediation: extract a document-loading controller, search dialog, lesson
  shell, feedback panel, and discussion panel. Preserve one small route-level
  coordinator for `/academy` and `/docs` compatibility.
- Acceptance test: all `AcademyPage` tests remain green; each extracted workflow
  has a focused component/hook test; deep links, local progress, filters, errors,
  and both base paths remain covered by Playwright.

### MT-05 — Photo management page owns unrelated tab controllers

- Severity: Medium
- Confidence: High
- Status: Confirmed, live code
- Evidence:
  - `src/app/dashboard/photos/page.tsx` is 698 physical lines and declares 28
    `useState` calls across lines 37-106.
  - It handles connection state at line 108, local filtering at line 167, photo
    editing at line 177, album editing at line 228, archive/restore at lines
    284-338, uploads at line 381, Google Picker OAuth/session work at line 460,
    and Picker import at line 499.
- Affected behavior: library browsing, albums, upload queues, archive/restore,
  Google Photos connection, Picker session polling, and imports.
- Impact: OAuth and upload changes can destabilize ordinary library management;
  the state surface makes mobile and error-state testing expensive.
- Remediation: use independent library, album, upload, and Google Picker
  controllers rendered by a small tab shell. Keep shared selection and notices in
  the page only where cross-tab behavior is intentional.
- Acceptance test: existing media-management tests pass; focused tests cover
  Picker timeout/error, upload retry, archive/restore, and tab-state isolation;
  mobile Playwright verifies dialogs and tab navigation.

### MT-06 — Several interactive lessons combine engine, drawing, and UI

- Severity: Low
- Confidence: High
- Status: Confirmed, live code; bounded by lazy loading
- Evidence:
  - `src/sims/bee/index.tsx` is 1,190 physical lines. It defines models and random
    generation at lines 3-142, canvas drawing at lines 143-318, React/game state
    at lines 319-409, animation loops at lines 410-714, pointer interaction at
    lines 718-780, and the UI at line 782.
  - `src/sims/linearequations/index.tsx` is 960 physical lines and combines
    algebra normalization, synchronized equation modes, SVG pointer behavior,
    and presentation.
  - Eighteen interactive entry files exceed 450 non-generated source lines.
  - Each interaction is independently lazy-loaded through the generated registry,
    so this does not create one large startup bundle or an application-level
    monolith.
- Affected behavior: individual interactive lessons only.
- Impact: pure math/simulation behavior is harder to unit-test and visual changes
  can accidentally alter engine behavior.
- Remediation: when an interaction next receives substantive work, extract pure
  domain/model functions, canvas/SVG rendering, and controller hooks. Do this
  incrementally rather than as a broad rewrite.
- Acceptance test: deterministic unit tests cover the extracted engine; existing
  interaction tests and curriculum embed validation pass; the per-interaction
  bundle budget does not regress.

### MT-07 — Backend route tests repeat large untyped Firebase fixtures

- Severity: Low
- Confidence: High
- Status: Confirmed, test code
- Evidence:
  - `functions/src/routes/__tests__/calendar.test.ts` is 1,634 nonblank lines and
    builds a large Firebase mock inline at lines 7-107.
  - `functions/src/routes/__tests__/profiles.test.ts` is 1,139 nonblank lines.
  - There are 346 explicit `any` patterns under `functions/src`; the inventory
    places all of them in test files, led by calendar (60), profiles (55),
    tournaments (51), and authentication middleware tests (38).
  - Production source has no hand-written explicit `any`; the only two production
    matches are generated component registry types.
- Affected behavior: test authoring and refactoring, not production runtime.
- Impact: endpoint refactors require editing broad fixtures and can mask mock/API
  shape drift.
- Remediation: create typed Firestore/Storage test builders and split route tests
  alongside the route domains proposed in MT-01. Avoid weakening production
  coverage ratchets.
- Acceptance test: test behavior/count and coverage floors are preserved; shared
  fixtures are type-checked without `any`; each route-domain suite can run alone.

### OPS-01 — The current release branch and worktree are not integrated

- Severity: Medium
- Confidence: High
- Status: Confirmed, repository state
- Evidence: the audited branch is 46 commits ahead and 2 commits behind
  `origin/master`, with two unrelated modified files in the worktree.
- Affected behavior: release reproducibility and future merges.
- Impact: continued feature work increases merge conflict risk and makes it less
  clear which code is deployed or authoritative.
- Remediation: preserve and separately review the two worktree edits, integrate
  the two upstream commits, rerun the complete verification gate, then merge the
  curriculum branch through the normal reviewed release path.
- Acceptance test: working tree is clean; `git rev-list --left-right --count
  origin/master...HEAD` is `0 0` on the release result; required CI is green; the
  deployed revision matches the merged commit.

## Large files that are not current monolith findings

- `src/components/generated/sim-registry.ts` is 1,088 physical lines, but it is
  deterministic generated code, imported by `TiptapRenderer`, `SimManager`, and
  `DocsMarkdownRenderer`. It should remain generated and should not be manually
  split.
- Large calendar/profile/tournament tests are not production monoliths. MT-07
  addresses their fixture maintainability without treating tests as runtime
  architecture.
- `src/components/Footer.tsx` is mostly static presentation markup. It can be
  decomposed opportunistically, but it does not currently own multiple data or
  mutation domains.
- Markdown curriculum, catalog JSON, lockfiles, and migration fixtures were not
  classified as monoliths from line count alone.

## Positive debt indicators

- The deployed backend architecture is already split into `public`, `core`,
  `media`, `drive`, and `communications` function applications.
- The former GSD planning trees, retired telemetry/upload/replay routes, duplicate
  security/storage-key modules, duplicate `untitled` simulator, dead cart/code
  modules, and starter SVGs identified in the August 12 audit are absent.
- No unresolved production `TODO`, `FIXME`, `HACK`, or `XXX` markers were found.
- Directly executed checks passed:
  - `node scripts/check-route-security.mjs` — 99 mutation routes checked.
  - `node scripts/validate-agent-config.mjs` — shared Codex/Gemini/Antigravity
    configuration validated.
  - `node node_modules/eslint/bin/eslint.js . --max-warnings=0`.
  - `node node_modules/typescript/bin/tsc --noEmit`.

## Validation limitation

The normal `pnpm run ...` wrappers attempted to refresh the existing
`node_modules` tree and were blocked by the sandbox's unavailable registry/no-TTY
environment. The four checks above were therefore executed directly from the
already-installed toolchain. No dependency installation or production mutation
was performed, and the full build, coverage, emulator, and Playwright gates were
not rerun for this read-only audit.

## Recommended order

1. Resolve OPS-01 before adding more changes to the long-running branch.
2. Split the calendar route and its test harness (MT-01 and MT-07 together).
3. Refactor event and task controllers (MT-02 and MT-03) as bounded behavior-
   preserving changes.
4. Decompose Academy and photo page coordinators (MT-04 and MT-05).
5. Refactor interactive lessons only when they are already being changed (MT-06).
