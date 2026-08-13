# Optimization and readability audit — 2026-08-13

## Scope and evidence

This was a targeted follow-up audit of current production source, configuration,
build output, and the largest frontend/backend modules. It is not a new claim of
complete security, accessibility, or WCAG conformance.

- Audited base: `e6b22e9dfd441bb5150ea7290b01b9f3d261fc33`
- Branch: `master`
- Worktree at start: clean
- Local defaults discovered: Node 24.13.0, pnpm 11.21.0, Java 11.0.30
- Required verification runtime: Node 22.13.1 and Java 21+
- Inventory methods: tracked-file inventory, import/config/script searches,
  production TypeScript line counts, direct-console and suppression searches,
  Firebase index source/live comparison, focused tests, production build, and
  the repository bundle-budget checker

## Improvements implemented

### OPT-01 — Photos management composition and pagination

Severity: medium. Confidence: high.

The Photos dashboard was the largest non-simulation frontend module at 1,566
lines. Its photo editor, album editor, and archive confirmation were embedded in
the page, while nine primitive state values represented two form drafts. Its
reload effects also suppressed dependency lint because pagination cursors were
captured by the reload callbacks.

Remediation:

- extracted typed photo/album dialogs and the archive confirmation;
- grouped the nine primitive fields into `PhotoEditorDraft` and
  `AlbumEditorDraft`;
- made pagination cursors explicit load arguments and removed both hook lint
  suppressions; and
- added photo edit/archive, album creation, and cursor regression tests.

Evidence: `src/app/dashboard/photos/page.tsx:31-35,88-106,124-207,227-233,910,1061,1189`,
`src/app/dashboard/photos/PhotoManagementDialogs.tsx`, and
`src/app/dashboard/photos/ArchiveConfirmationDialog.tsx`.

Result: the route module is 1,260 lines, and no new dialog module exceeds 500
lines.

### OPT-02 — Removed an unnecessary editor parser

Severity: medium. Confidence: high.

The simulation formatter uses only Prettier's `typescript` parser, but it also
downloaded the unrelated Babel parser. TypeScript formatting succeeds with the
TypeScript and ESTree plugins alone.

Remediation: `formatSimulationSource` now imports only those two required
plugins and has a real TypeScript formatting regression test.

Evidence: `src/hooks/useSimulationActions.ts:13-23,116` and
`src/test/useSimulationActions.test.tsx`.

Measured production-build result:

- `vendor-prettier`: 1,501,196 -> 1,184,088 raw bytes (-317,108; -21.1%)
- aggregate editor runtime: 14,841,947 -> 14,524,839 raw bytes
- aggregate editor runtime gzip: 3,517,406 -> 3,436,404 bytes

### OPT-03 — Firestore configuration drift and rule warning

Severity: medium. Confidence: high.

The active `internal_api_quotas.expiresAt` TTL policy existed in production but
not in `firestore.indexes.json`. The rules also contained an unused email helper
that caused compiler warnings during deployment.

Remediation: the TTL policy and a recommended single-field index exemption are
now checked into `firestore.indexes.json`; a regression test protects the
configuration; and the unused rules helper was removed.

Evidence: `firestore.indexes.json:102-106`,
`functions/src/middleware/distributedQuota.ts:7,49,94`,
`src/test/firestoreIndexConfig.test.ts`, and `firestore.rules:10`.

No production index, TTL policy, rule, or data was changed in this audit.

### OPT-04 — Authentication logging data minimization

Severity: medium. Confidence: high.

`AuthContext` bypassed the redacting frontend logger and included the provider
email in one warning. Authentication diagnostics now use generic messages and
only a safe HTTP status where useful. Tests assert that the provider email is
not passed to the logger.

Evidence: `src/context/AuthContext.tsx:95-104,175,295` and
`src/test/AuthContextSession.test.tsx`.

## Remaining prioritized work

### REM-01 — Split the profiles route by responsibility

Severity: medium. Confidence: high.

`functions/src/routes/profiles.ts:82-874` is 890 lines and combines public/team
rosters, profile sync and session linking, admin user lifecycle, permissions,
and Zulip provisioning. The mixed trust boundaries increase review and test
blast radius.

Recommended next tranche: preserve the current router order but extract roster,
session/sync, admin lifecycle, and Zulip subrouters. Acceptance requires full
Functions coverage plus middleware-order and role-denial regression tests.

### REM-02 — Separate document editor state from rendering

Severity: medium. Confidence: high.

`src/components/dashboard/DocFormDrawer.tsx:47-807` owns more than twenty form,
recovery, dialog, and presentation states alongside persistence and rendering.

Recommended next tranche: introduce a typed document draft/reducer, extract the
recovery lifecycle hook, and keep the drawer as composition. Preserve nested
dialog focus behavior and recovery semantics in focused tests.

### REM-03 — Enforce the shared logger repository-wide

Severity: medium. Confidence: high.

There are 114 direct production `console.*` references outside the shared
Functions logger. Several pass caught exception objects directly, bypassing the
frontend logger's production argument redaction.

Recommended next tranche: migrate by feature, then enable a production-source
`no-console` lint rule with a narrow exemption for the logger implementations.
Acceptance: only logger implementations call `console.*`, and tests verify that
email, names, raw UIDs, and request bodies never reach logger arguments.

### REM-04 — Retired Firestore composite indexes

Severity: low. Confidence: medium.

Production still has `aresplanner_paths(userId, updatedAt)` and
`aresplanner_logs(userId, createdAt)` indexes, while no repository source,
Firebase configuration, scripts, tests, or active documentation references
those retired collections. An external consumer cannot be excluded by source
inspection alone.

Recommended operational step: confirm there is no external Planner client,
then delete these two indexes in a separately approved production change. Do
not use forced index deletion as part of a general deployment.

### REM-05 — Make the supported local runtime automatic

Severity: low. Confidence: high.

`.nvmrc` correctly pins Node 22.13.1, but this workstation defaults to Node 24
and Java 11, producing engine warnings and requiring manual PATH overrides for
the authoritative gate.

Recommended next tranche: add a documented one-command developer environment
bootstrap or a checked-in multi-runtime tool configuration for Node 22.13.1,
pnpm 11.21.0, and Java 21+. CI must remain authoritative.

### REM-06 — Plan major dependency migrations separately

Severity: low. Confidence: high.

The installed `firebase-functions` 6.6 line is behind the current 7.x major, and
other backend packages also have major updates. These are not safe mechanical
upgrades because they affect runtime APIs, types, and deployment behavior.

Recommended next tranche: one dependency family at a time, using official
migration notes, emulator coverage, a supported Node 22 build, and a canary
deployment. Do not combine major runtime upgrades with route refactors.

## Acceptance status

The complete repository gate passed on Node 22.13.1, pnpm 11.21.0, and Java
24.0.2:

- frozen install and agent/Gemini/Antigravity mirroring validation;
- root and Functions lint with zero warnings;
- root TypeScript and Functions build;
- frontend coverage: 74 files, 414 tests;
- Functions coverage: 41 files, 513 tests;
- Firestore/Storage emulator rules: 17 tests;
- production build, 22 prerendered route shells, and every bundle budget;
- Playwright: 52 tests across Chromium, mobile Chromium, Firefox, and WebKit;
  and
- production dependency audit: no known high-severity vulnerabilities.

## Follow-up implementation — remaining priorities

The same working session completed or re-evaluated the six remaining items.
This section records implementation evidence; the final full gate is repeated
after all follow-up changes are assembled.

### REM-01 — Completed: profile responsibilities separated

The former 890-line profile router is now a small route-registration module.
Roster DTOs, sync/session handling, admin lifecycle, and Zulip provisioning live
in separate modules while preserving middleware and route order. The existing
41 profile tests passed after the split.

Evidence: `functions/src/routes/profiles.ts`, `profileRoster.ts`,
`profileSync.ts`, `profileAdmin.ts`, and `profileZulip.ts`.

### REM-02 — Completed: document draft and recovery separated

Document draft construction, recovery validation, revision mapping, and save
payload construction are now pure typed helpers. Autosave, unload persistence,
and discard behavior are owned by a recovery hook instead of the drawer's
rendering body. Focused drawer/model tests passed.

Evidence: `src/components/dashboard/documentEditorDraft.ts`,
`useEditorRecoveryDraft.ts`, `DocFormDrawer.tsx`, and
`src/test/documentEditorDraft.test.ts`.

### REM-03 — Completed: production logging ratchet

All direct frontend production `console.*` calls were migrated to the shared
logger. ESLint now rejects direct console usage in frontend and Functions
production source, with narrow exemptions only for logger implementations.
Tests remain free to spy on console output where they verify the logger itself.

Evidence: `eslint.config.mjs` and `functions/eslint.config.mjs`.

### REM-04 — Completed: retired production indexes removed

A second repository search found no source, configuration, script, test, or
documentation consumer for `aresplanner_paths` or `aresplanner_logs`. The user
confirmed there is no separate planning AI or active Planner client. A
read-only production check on 2026-08-13 found historical documents in
`aresplanner_paths` (including a sample updated 2026-06-06) and no documents in
`aresplanner_logs`; both composite indexes remain READY.

After the user explicitly approved production deletion, the two composite
indexes `CICAgOjXh4EK` (`aresplanner_paths`) and `CICAgJiUpoMK`
(`aresplanner_logs`) were deleted with `gcloud`. A follow-up production list
reported zero remaining Planner composite indexes. No collection documents were
deleted. The field definitions remain recorded in this audit if an index ever
needs to be recreated.

### REM-05 — Completed: supported runtime is self-checking

`pnpm run validate:runtime` now enforces Node 22.13+ within the Node 22 line,
pnpm 11.21.0, and Java 21+. A Windows wrapper resolves the pinned fnm Node and a
supported installed JDK for any child command without changing the user's
profile. The Firebase rules CI job verifies the same contract.

Evidence: `scripts/verify-runtime.mjs`,
`scripts/with-supported-runtime.ps1`, `package.json`, `README.md`, and
`.github/workflows/ci.yml`.

### REM-06 — Completed: supported backend families modernized

The Functions SDK moved from 6.x to 7.3.2, Express moved from 4.x to 5.2.1,
`express-rate-limit` moved to 8.6.2, Firebase Admin moved to 14.2.0, and
`@google/genai` moved to the aged 2.16.0
release without bypassing the workspace release-age policy. Express 5's route
parameter types exposed repeated parameters as arrays; production handlers now
reject those values before database or external-service access. All 516
Functions tests passed after this migration.

Firebase Admin 14's removed namespace API was migrated to modular `app`,
`app-check`, `auth`, `firestore`, and `storage` entry points. The shared wrapper
now exports explicit service instances, Firestore sentinel access, and the two
needed Firestore types. No unsafe compatibility casts or legacy default export
remain. Deployment should still proceed through the protected canary/health
workflow rather than a direct local deploy.

Official references:

- <https://github.com/firebase/firebase-functions/releases>
- <https://firebase.google.com/support/release-notes/admin/node>
- <https://github.com/googleapis/js-genai/releases>

### REM-07 — Completed: editor refresh races hardened

The full browser matrix exposed two same-record refresh hazards: a task detail
refresh could replace an unsaved title, and a document refresh could replace an
unsaved draft. Both editors now initialize once per stable record key while
open, rather than reinitializing from parent object identity changes. Focused
regression tests cover both cases, and the complete 52-test Playwright matrix
passed afterward on Chromium, mobile Chromium, Firefox, and WebKit.

Evidence: `src/app/dashboard/tasks/components/TaskDetailsModal.tsx`,
`src/components/dashboard/DocFormDrawer.tsx`,
`src/test/TaskDetailsModalReliability.test.tsx`, and
`src/test/DocFormDrawer.test.tsx`.

## Follow-up acceptance status

The complete gate passed again after the remaining-priority implementation on
Node 22.13.1, pnpm 11.21.0, and Java 24.0.2:

- frozen installation and supply-chain policy verification;
- runtime contract plus Codex/Gemini/Antigravity skill validation;
- frontend and Functions ESLint with zero warnings;
- root TypeScript and Functions build;
- frontend coverage (1,159/1,610 statements) and Functions coverage
  (3,255/3,493 statements; 3,035/3,219 lines), both above repository
  thresholds;
- all 516 Functions tests;
- Firestore/Storage emulator rules: 17/17;
- production build with 22 prerendered shells and all bundle budgets;
- Playwright: 52/52 across Chromium, mobile Chromium, Firefox, and WebKit;
- production dependency audit: no known vulnerabilities; and
- final added-line credential scan: zero potential credential additions.

No application deployment occurred during this follow-up. The only production
mutation was the separately approved deletion of the two retired Planner
composite indexes documented above.
