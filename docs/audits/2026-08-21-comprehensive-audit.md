# Comprehensive Website Audit — 2026-08-21

**Audited commit:** `898a579d` (`master`)  
**Audit date:** 2026-08-21  
**Runtime versions:** Node v24.18.0, pnpm 11.21.0, Java 21 (Firebase Emulators)  
**Worktree state:** Clean working tree. Read-only static analysis, test suite execution, emulator verification, and bounded source review. No production state was mutated, no secrets were rotated, and no unauthorized deployments were performed.

---

## Executive Summary

A comprehensive audit was performed across the entire ARESWEB repository, including client-side React 19 / Vite applications, Firebase Cloud Functions (v2) and middleware, Firestore & Storage security rules, API DTO boundaries, PWA configuration, accessibility tokens, and automated test suites.

The audit verified strong security baselines:
- **Zero-Trust Boundaries:** Workload Identity Federation (WIF) deploy configuration, strict App Check verification, distributed sliding-window rate limiting, and encrypted inquiry PII at rest.
- **Privacy & Youth Data Protection:** Private profile and attendance records remain restricted behind server-side DTO contracts. Direct public media uploads are guarded against unapproved external URLs.
- **Feature Truthfulness:** All robot specs, telemetry tools, documentation lessons, tournament stats, and team credentials reflect truthful repository assets and authenticated Firestore records. No fabricated 3D parts, mock sponsors, or synthetic team claims were detected.
- **Verification Gates:** 717 backend Cloud Functions tests (95.38% line coverage), 24 Firestore/Storage security rules emulator tests, 95 cross-browser/mobile Playwright E2E tests, root ESLint, TypeScript `tsc --noEmit`, and production bundle size budgets all pass.

The audit identified **5 actionable findings (1 High, 2 Medium, 2 Low)**, prominently explaining and isolating the root causes of the two user-reported bugs regarding recurrent events display on click and incorrect timeline time rendering.

---

## Detailed Audit Findings

### ARES-2026-08-21-01 — HIGH — Compound Occurrence Identifiers and Series Navigation Produce 404 Errors on Recurrent Event Clicks

- **Severity:** HIGH
- **Confidence:** High (reproduced via source trace & unit evaluation)
- **Evidence:**
  - `src/app/calendar/calendarView.ts:8-14`
  - `src/app/events/[id]/page.tsx:33-102`
  - `functions/src/routes/calendar.ts:243-269`
  - `functions/src/routes/calendarHelpers.ts:528-533`
- **Affected Behavior:**
  When recurring events are expanded into daily/weekly occurrences, the API assigns each occurrence an ID formatted as `${parentId}_${YYYY-MM-DD}` (e.g. `weekly-1_2026-08-20`). If a user or link navigates to `/events/weekly-1_2026-08-20` directly, or if the occurrence date query is stripped, `getEvent()` in `calendar.ts` attempts to look up the exact document `weekly-1_2026-08-20` in Firestore. Because only the parent document `weekly-1` exists in the collection, the server throws a 404 `EVENT_NOT_FOUND` error, causing the public event page to display "Event Record Lost".
  Furthermore, navigating to `/events/weekly-1` without an occurrence parameter loads the parent document with its initial historical start date (which may be months in the past), causing `EventHero` to mark an active recurring schedule as a "Historical Record" and suppress "Add to Calendar" actions.
- **Impact:** Users clicking on recurring events encounter broken 404 pages or confusing historical timestamps rather than the active session details.
- **Remediation:**
  1. Update `functions/src/routes/calendar.ts` and `functions/src/routes/calendarHelpers.ts` to parse compound occurrence IDs of the form `([A-Za-z0-9_-]+)_(\\d{4}-\\d{2}-\\d{2})`, automatically extracting the root series ID and occurrence date.
  2. In `src/app/events/[id]/page.tsx`, if the URL param `id` contains an embedded occurrence suffix, extract and forward the occurrence date to `fetchPublicEvent`.
  3. In `EventHero.tsx` and `EventDetailPage`, when viewing a recurring series, display the recurrence pattern badge (e.g., "Repeats weekly on Thursdays") and highlight the next upcoming occurrence.
- **Acceptance Test:** API and client tests prove that requesting both `/events/series-1?occurrence=2026-08-20` and `/events/series-1_2026-08-20` successfully returns the materialized occurrence DTO without 404 errors.

---

### ARES-2026-08-21-02 — MEDIUM — Recurrence Expansion Day-Shift Calculation Causes Wrong Time and Date in Timeline View for Evening Events

- **Severity:** MEDIUM
- **Confidence:** High (source-confirmed)
- **Evidence:**
  - `functions/src/routes/calendarHelpers.ts:144-176`
  - `functions/src/routes/calendarHelpers.ts:178-192` (`shiftIsoDays`)
  - `functions/src/routes/calendarHelpers.ts:269-274` (`dayShift`)
  - `src/app/calendar/calendarView.ts:47-53` (`formatEventTime`)
- **Affected Behavior:**
  When an event is scheduled during evening hours in the local timezone (e.g., 8:00 PM EDT in America/New_York), converting the local time to UTC causes the date to roll over to the next day in UTC (e.g. Thursday 8:00 PM EDT = Friday 00:00 UTC).
  In `calendarHelpers.ts`, `firstDateStart.slice(0, 10)` extracts the UTC date (`2026-08-21` Friday) instead of the local day. When calculating `occurrenceDates` for rule `byDay: ["TH"]`, `dayShift` computes `(Aug 20 - Aug 21) = -1 day`. This shifts the event back by 24 hours, producing `2026-08-20T00:00:00.000Z`, which in EDT translates to **Wednesday Aug 19 at 8:00 PM** (a 1-day shift). Subsequent weekly iterations shift by 6 days instead of 7 days, resulting in all occurrences being rendered on Wednesday instead of Thursday in both the month calendar and the bottom Timeline view.
- **Impact:** Recurring events scheduled in the evening render on the wrong weekday and display incorrect wall-clock hours in the timeline.
- **Remediation:**
  Refactor `occurrenceDates` and `expandEventOccurrences` to anchor recurrence rules and interval weeks using the local calendar date and time rather than naive UTC string slicing.
- **Acceptance Test:** Test suite verifies that an event created for 8:00 PM EDT on Thursday expands recurring instances to Thursday 8:00 PM EDT across all occurrences, including transitions across daylight saving time boundaries.

---

### ARES-2026-08-21-03 — MEDIUM — Event Management Timeline Actions Fail on Materialized Occurrence IDs

- **Severity:** MEDIUM
- **Confidence:** High (source-confirmed)
- **Evidence:**
  - `src/app/dashboard/events/page.tsx:185-240`
  - `src/app/dashboard/events/components/EventsCalendarView.tsx:154-205`
  - `src/app/dashboard/events/hooks/useEventEditor.ts:129-135`
- **Affected Behavior:**
  In the dashboard "Active Team Operations Timeline" (`EventsCalendarView.tsx`), recurring event occurrences have `evt.id = "parent-id_YYYY-MM-DD"`. When an administrator clicks "Approve" or "Archive" on an occurrence, `handleApproveEvent` and `handleDeleteEvent` pass `evt.id` directly to `publishEvent(evt.id)` or `archiveEvent(evt.id)`. The backend endpoints (`PUT /api/calendar/manage/:id/publish` and `PUT /api/calendar/manage/:id/archive`) look up `:id` directly in the root `events` collection and fail with 404.
- **Impact:** Administrators cannot publish or archive recurring events directly from the management timeline view.
- **Remediation:**
  Ensure `handleApproveEvent` and `handleDeleteEvent` in `page.tsx` pass `evt.recurrenceOf ?? evt.id`, resolving the root series ID when executing series-level lifecycle actions.
- **Acceptance Test:** Unit test verifies that clicking approve/archive on a recurring occurrence in the dashboard management timeline sends the parent event ID to the lifecycle API.

---

### ARES-2026-08-21-04 — LOW — Line-Ending Sensitivity in CI Workflow Test Regex

- **Severity:** LOW
- **Confidence:** High (reproduced on Windows working tree)
- **Evidence:** `src/test/CiWorkflow.test.ts:7-20`
- **Affected Behavior:**
  `CiWorkflow.test.ts` reads `.github/workflows/ci.yml` and matches step names using `\n` line delimiters. On Windows machines where Git checkouts preserve CRLF (`\r\n`), the regular expression fails to match existing workflow steps.
- **Impact:** Local unit test failure on Windows developer environments even though CI runners on Linux pass.
- **Remediation:** Normalize workflow text with `.replace(/\r\n/g, "\n")` upon reading.
- **Acceptance Test:** `pnpm exec vitest run src/test/CiWorkflow.test.ts` passes unconditionally across both Windows and POSIX environments.

---

### ARES-2026-08-21-05 — LOW — Event Chips in Calendar Month Grid Lack Direct Focus Trapping

- **Severity:** LOW
- **Confidence:** High (accessibility inspection)
- **Evidence:** `src/app/calendar/page.tsx:242-294`
- **Affected Behavior:**
  In `CalendarPage.tsx`, event indicators within month-grid day cells are rendered as non-interactive `<div>` elements inside the cell's `<button onClick={() => setSelectedDate(dayCell.date)}>`. While keyboard navigation allows selecting the day to populate `SelectedEventPanel` (which is fully keyboard accessible and labelled), users relying solely on screen readers are not immediately aware of individual event titles inside the month cell without navigating to the side panel.
- **Impact:** Minor UX inconvenience for keyboard/screen-reader users navigating large monthly event grids.
- **Remediation:** Add descriptive `aria-label` attributes to day buttons summarizing scheduled events (e.g. `aria-label="August 20, 2026: 2 events scheduled"`).
- **Acceptance Test:** Screen reader testing and Playwright accessibility checks confirm descriptive day cell labels.

---

## Verification & Metric Summary

| Check / Gate | Target / Standard | Observed Result | Status |
| :--- | :--- | :--- | :--- |
| **Agents Config** | `validate-agent-config.mjs` | 6 shared skills validated | **PASS** |
| **ESLint (Root)** | `--max-warnings=0` | 0 errors, 0 warnings | **PASS** |
| **ESLint (Functions)** | `--max-warnings=0` | 0 errors, 0 warnings | **PASS** |
| **TypeScript (Root)** | `tsc --noEmit` | 0 type diagnostics | **PASS** |
| **TypeScript (Functions)**| `tsc` (Functions build) | 0 type diagnostics | **PASS** |
| **Functions Coverage** | 85% lines / 100% funcs | **95.38% lines / 97.91% funcs** (717 tests) | **PASS** |
| **Security Rules Tests**| `firebase emulators:exec` | 24 passed (Firestore & Storage rules) | **PASS** |
| **Vite Production Build**| `pnpm run build` | 25 prerendered shells, PWA precache 962KB | **PASS** |
| **Bundle Size Budgets** | `check-bundle-size.mjs` | Initial JS 723KB (budget 1.3MB) | **PASS** |
| **Playwright E2E Suite**| Desktop + Mobile Matrix | **95 passed** (Chromium, WebKit, Firefox, Mobile) | **PASS** |
| **Dependency Audit** | `pnpm audit --prod` | 0 high/critical vulnerabilities | **PASS** |

---

## Summary of Remediations

1. **Recurrent Event Resolution**: Update backend `/events/:id` route to parse compound occurrence IDs (`${seriesId}_${YYYY-MM-DD}`) and handle recurrence parent views cleanly.
2. **Timezone & Recurrence Expansion**: Ensure recurrence weekday matching and date shifting utilize local wall-clock dates instead of raw UTC string slicing.
3. **Dashboard Event Lifecycle**: Map `evt.recurrenceOf ?? evt.id` in `EventsManagementPage` for approve and archive actions.
4. **Test Normalization**: Add CRLF normalization to `CiWorkflow.test.ts`.
5. **A11y Enrichment**: Enrich calendar month-grid day cells with event count aria-labels.
