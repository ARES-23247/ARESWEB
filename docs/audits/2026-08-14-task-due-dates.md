# Task Due Dates Feature and Data-Contract Review

- Date: 2026-08-14
- Baseline: `c677b8d7875097df1cfc794a2c71e6d713ed04ac` (`origin/master`)
- Branch: `codex/task-due-dates`
- Scope: authenticated task read/write contract, editor, Kanban cards, command-center feed, sorting, and Firebase rules
- Production data mutation: none

## Outcome

The task board now supports optional `YYYY-MM-DD` due dates. Members can set or
clear the date in the existing task editor, sort each status column by the
earliest deadline, and see consistent upcoming, due-today, or overdue labels on
both Kanban cards and the command center. Existing tasks remain valid and do not
require a backfill.

## Data and security contract

- `src/app/dashboard/tasks/taskRecord.ts` validates due dates with the shared
  local-calendar parser. Malformed or impossible values become `null` at the
  client read boundary instead of being rendered or sorted as trustworthy data.
- `firestore.rules` permits only `null` or the bounded `YYYY-MM-DD` shape on
  task create/update. Unknown fields, malformed date strings, and hard deletes
  remain denied. Rule validation continues to inspect only changed fields so a
  canonical due date can be added to otherwise-legacy records.
- The task editor stores `null` when a due date is cleared. No timezone or time
  of day is inferred, avoiding the UTC-midnight date shift previously found in
  tournament surfaces.

## User experience

- Cards label overdue work with the readable red-on-dark design token, work due
  today with gold, and future dates neutrally.
- Completed tasks may retain their recorded due date but are never labeled
  overdue.
- The new `Due Date (Soonest)` sort puts dated tasks first, breaks equal dates
  by priority, and leaves undated tasks at the end without mutating the source
  list.
- The command center uses the same formatter and urgency calculation as the
  board, preventing contradictory labels between the two views.
- Task create and status notifications include a validated due date in Zulip
  when one is set; impossible dates are rejected by the strict Functions DTO.

## Verification evidence

- Supported runtime: Node 22.22.2, pnpm 11.21.0, Microsoft OpenJDK 21.0.12.
- Frozen install and shared-agent validation: passed.
- Root and Functions ESLint: passed with zero warnings.
- Root TypeScript and Functions build: passed.
- Frontend coverage: 87 files, 497 tests passed; `taskRecord.ts` measured 100%
  lines/functions and 96.61% branches.
- Functions coverage: 45 files, 569 tests passed; 94.75% lines and 98.31%
  functions.
- Firestore/Storage emulator rules: 20 tests passed, including valid set/clear
  and malformed due-date rejection.
- Production build and 22-route prerender: passed; PWA precache remained 17
  entries / 874.62 KiB.
- Bundle budgets: all six passed; initial JavaScript was 714,863 raw / 225,289
  gzip bytes.
- Playwright: 52 tests passed across Chromium, mobile Chromium, Firefox, and
  WebKit.
- Production dependency audit: no known vulnerabilities.
- Diff check: clean apart from platform line-ending notices.

Protected pull-request review, independent CI, deployment, and read-only live
validation remain release steps. This scoped feature does not establish general
security or accessibility conformance.
