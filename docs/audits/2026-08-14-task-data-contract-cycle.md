# Task data contract and command-center audit

Date: 2026-08-14

Baseline: `f12dd97bea2ec5d6740f311866d22791ecbaa19e` (`origin/master`)

Worktree at audit: dirty only with the remediation documented below

Scope: authenticated Kanban reads/writes, task comments, command-center task/content summaries, and user-facing service status copy

## Evidence and findings

### TASK-01 — MEDIUM — High confidence — Task writes accepted arbitrary shapes

- Evidence: the baseline `firestore.rules` granted every authorized account unrestricted `read, write` access to each task document. The client trusts task enums and arrays when rendering the board.
- Impact: a compromised or malfunctioning authorized client could persist unknown fields, invalid enum values, oversized lists, mutable creation metadata, or hard-delete a task. Firestore's document limit prevents an unbounded document, but it does not enforce the application's contract.
- Remediation: `firestore.rules:52-119,196-217` now permits canonical, bounded creates; validates only changed fields on legacy updates; makes identifiers and creation timestamps immutable; and requires soft deletion. Comment creates bind the document identifier and author, reject unknown fields, and bound user strings.
- Acceptance: Firebase Emulator Suite must accept canonical creates and edits to otherwise-invalid legacy records, while rejecting invalid enums, oversized lists/titles, unknown fields, forged comment metadata, and hard deletes. Covered in `tests/rules/security.rules.test.ts`.

### TASK-02 — MEDIUM — High confidence — Live legacy task values violated the current client type

- Evidence: the authenticated production board exposed task priorities such as `normal` and subteams such as `Mechanical`, while `src/types/task.ts` permits only `low|medium|high` and lowercase canonical subteams. The baseline board cast raw Firestore values directly to `TaskItem`.
- Impact: filters, sorting, styling, select controls, and save behavior could disagree for legacy records. Invalid timestamps or arrays could also make ordering unstable or increase rendering work.
- Remediation: `src/app/dashboard/tasks/taskRecord.ts:1-122` is now the bounded read boundary for task enums, dates, assignees, subtasks, deletion state, and counts. Both the board (`src/app/dashboard/tasks/page.tsx:147`) and command center (`src/app/dashboard/page.tsx:85`) use it. No production records are rewritten.
- Acceptance: utility tests must cover legacy aliases, malformed data, Firestore-style timestamps, stable fallbacks, size caps, deletion filtering, priority ordering, and trusted document IDs. The focused utility has 100% line/function/branch coverage.

### TASK-03 — MEDIUM — High confidence — Command-center task summary contradicted the live board

- Evidence: production displayed `26 / 27` active tasks and "No active tasks in progress" while the live board displayed 15 To Do cards. The baseline listener required `archived == false`, excluding legacy records without that field, then sorted only an arbitrary ten-record query sample.
- Impact: the team's landing dashboard concealed current work and presented inflated counts that included soft-deleted or archived records.
- Remediation: `src/app/dashboard/page.tsx:81-89` uses one bounded 500-record snapshot, normalizes legacy records, excludes soft-deleted tasks, derives the active/total summary from the same snapshot, and selects visible priority work deterministically.
- Acceptance: `src/test/DashboardTaskSummary.test.tsx` proves a legacy active record appears, a deleted record does not, and the count is derived from the same visible set.

### TASK-04 — LOW — High confidence — Content counts and service labels overstated their evidence

- Evidence: "Published Blogs" counted every post; "Academy Lessons" counted every non-deleted document; Gemini and Storage were labeled "Online" based only on the user's role or presence of a Firebase user.
- Impact: operators could interpret configuration or authorization as proof that an external service was healthy.
- Remediation: published-blog and Academy counts now use the same publication/display predicates as their live content surfaces. The status section is renamed "Portal Service Configuration"; it reports observed Firestore synchronization, role eligibility, reCAPTCHA configuration, and authentication state without claiming untested upstream availability.
- Acceptance: the command-center test asserts the filtered counts and truthful configuration labels. A Firestore listener error must render `Unavailable`, not remain in a perpetual connecting state.

## Verification completed before review

- Supported runtime: Node 22.22.2, pnpm 11.21.0, Microsoft OpenJDK 21.0.12.
- Frozen install, shared-agent validation, root/Functions ESLint, root TypeScript, and Functions build: passed.
- Focused frontend: 3 files, 12 tests passed.
- Task-record utility coverage: 100% statements, branches, functions, and lines.
- Full frontend coverage: 87 files, 492 tests; 76.24% lines and 72.24% functions.
- Full Functions coverage: 45 files, 568 tests; 94.75% lines and 98.31% functions.
- Firestore/Storage emulator rules: 1 file, 20 tests passed on Java 21.
- Production build and 22-route prerender: passed; PWA precache remained 17 entries / 874.22 KiB.
- All six bundle budgets: passed; initial JavaScript 714,494 raw / 225,157 gzip bytes.
- Playwright: 52 tests passed across Chromium, mobile Chromium, Firefox, and WebKit.
- Production dependency audit: no known vulnerabilities.
- Diff check: clean apart from platform line-ending notices.

The protected pull request, independent CI, deployment, and post-deployment production verification remain release steps. No production data was written during this audit.
