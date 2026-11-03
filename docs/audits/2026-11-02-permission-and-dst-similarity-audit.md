# Permission Boundary & Timezone/DST Similarity Audit

- **Date:** 2026-11-02
- **Audited Base Commit:** `055b18c0` (`fix/calendar-dst-and-student-blog-edits`)
- **Scope:**
  1. **Category A — Frontend UI vs. Backend / Firestore Rule Permission Mismatches:** Every dashboard surface (`src/app/dashboard/**`, `src/components/dashboard/**`, `src/hooks/dashboard/**`, `src/hooks/useDocumentSync.ts`), Express API route (`functions/src/routes/**`, `functions/src/middleware/auth.ts`), and Firestore/Storage security rule (`firestore.rules`, `storage.rules`) where non-publisher team members (`student` / `member`) are presented with edit/mutation controls or vice versa.
  2. **Category B — Timezone, Daylight Saving Time (DST), and Date-Only Math:** All recurring event expansion, iCalendar (`RRULE` / `EXDATE` / `RECURRENCE-ID`) serialization, `YYYY-MM-DD` date-only parsing, local `datetime-local` input conversion, and `86_400_000` ms day-step calculations across `src/**` and `functions/src/**`.

---

## Executive Summary

Following the fixes for recurring calendar Daylight Saving Time shifts and student (`member`) pending-approval edits on published blog posts (`posts/{postSlug}`), a repository-wide similarity audit identified **four confirmed defects** where UI controls and Firestore/API permission boundaries diverged or malformed JSX attributes left role-gated controls active, plus **four npm production dependency advisories** that surfaced in CI. All confirmed defects have been remediated and covered by automated unit and Firebase Emulator Suite tests.

---

## Confirmed Defects & Remediations

### Finding 1 — Collaborative Member Edits on Published `docs` and `documents` Rejected by Firestore Rules & Missing `documents` Approval Control

- **Severity:** High
- **Confidence:** Confirmed Defect
- **Evidence:**
  - [`src/app/dashboard/academy/page.tsx`](../../src/app/dashboard/academy/page.tsx#L121-L148), [`src/app/dashboard/areslib/page.tsx`](../../src/app/dashboard/areslib/page.tsx#L118-L145), and [`src/app/dashboard/documents/page.tsx`](../../src/app/dashboard/documents/page.tsx#L93-L112) pass `canEdit` (`authorizedUser.role !== "unverified"`) to [`DocListGrid`](../../src/components/dashboard/DocListGrid.tsx), rendering the `Edit` (`Pencil`) button for `student`/`member` users on published Academy lessons (`docs`), ARESLib articles (`docs`), and Cloud Resources (`documents`).
  - [`src/hooks/useDocumentSync.ts`](../../src/hooks/useDocumentSync.ts#L335-L341) previously stamped `lastEditedByUid: user.uid` only when `collectionName === "posts"`, and [`firestore.rules`](../../firestore.rules#L102-L163) (`canUpdateContent`, `canUpdatePendingDoc`, `canCreateRevision`) restricted non-publisher updates on `docs/{docSlug}` and `documents/{docId}` to `isPendingContent(resource.data)` and `isContentOwner(...)`.
  - Additionally, [`src/app/dashboard/documents/page.tsx`](../../src/app/dashboard/documents/page.tsx#L93-L112) did not pass `isApprover`, `onApprove={handleApproveAndPublish}`, or `approvingSlug` to `DocListGrid`, leaving approvers without an inline `Approve` button when a student created or edited a Cloud Resource document (`status: "pending_approval"`).
- **Impact:** Students clicking `Edit` on any published Academy lesson, ARESLib guide, or Cloud Resource document encountered `Missing or insufficient permissions` from Firestore when saving their pending-approval draft, and pending Cloud Resource documents had no one-click approval action in `/dashboard/documents`.
- **Remediation:**
  1. Generalized [`src/hooks/useDocumentSync.ts`](../../src/hooks/useDocumentSync.ts#L326-L342) to stamp `lastEditedByUid: user.uid` on pending-approval updates (`!options.isCreate && user?.uid`) and clear `lastEditedByUid: deleteField()` on approved publish saves across `posts`, `docs`, and `documents`.
  2. Updated [`firestore.rules`](../../firestore.rules#L102-L163) (`canUpdateContent`, `canUpdatePendingDoc`, `canCreateRevision`) so authorized team members can submit pending-approval updates and revision entries on active `posts`, `docs`, and `documents` while preserving `preservesServerDriveFields()` on `documents` and the server-only approval transaction gate on `docs`.
  3. Updated [`src/app/dashboard/documents/page.tsx`](../../src/app/dashboard/documents/page.tsx#L85-L140) and [`src/components/dashboard/DocListGrid.tsx`](../../src/components/dashboard/DocListGrid.tsx#L212-L216) to display a `Pending Approval` badge and expose the `Approve` action (`handleApproveAndPublish`) to approvers (`admin`, `coach`, `mentor`).
- **Acceptance Tests:**
  - `tests/rules/security.rules.test.ts` — `"allows members to submit pending-approval edits on published docs and documents while blocking member archival"`
  - `src/test/useDocumentSync.test.tsx` — `"records the active editor on pending updates across docs and documents collections"`

---

### Finding 2 — Publisher-Only `Archive` and `Restore` Buttons Exposed to Non-Approver Members in `DocListGrid`

- **Severity:** High
- **Confidence:** Confirmed Defect
- **Evidence:**
  - [`src/components/dashboard/DocListGrid.tsx`](../../src/components/dashboard/DocListGrid.tsx#L363-L390) rendered the `Restore` button (`onRestore`) and `Archive` button (`onDelete`) whenever `canEdit` was `true`.
  - [`src/hooks/dashboard/useDashboardDocController.ts`](../../src/hooks/dashboard/useDashboardDocController.ts#L367-L398) guarded `handleDelete`, `handleConfirmArchive`, and `handleRestore` only with `if (!canEdit) return;`.
  - However, [`firestore.rules`](../../firestore.rules#L105-L146) requires `isContentPublisher()` (`admin`, `coach`, `mentor`) for `isDeleted` archival/restoration transitions across `posts`, `docs`, and `documents`.
- **Impact:** Students (`student` / `member`) were shown `Archive` and `Restore` buttons in `/dashboard/blog`, `/dashboard/academy`, `/dashboard/areslib`, and `/dashboard/documents` that always failed with `Missing or insufficient permissions` when confirmed.
- **Remediation:**
  - Gated `Archive` (`onDelete`) and `Restore` (`onRestore`) in [`src/components/dashboard/DocListGrid.tsx`](../../src/components/dashboard/DocListGrid.tsx#L363-L396) and [`src/hooks/dashboard/useDashboardDocController.ts`](../../src/hooks/dashboard/useDashboardDocController.ts#L367-L398) on `isApprover` (`admin`, `coach`, `mentor`), while keeping `Edit` (`Pencil`) available to all authorized editors (`canEdit`) on active records.
- **Acceptance Tests:**
  - `src/test/DocListGrid.test.tsx` — `"hides publisher-only archive and restore actions from non-approver members while keeping edit enabled"`
  - `src/test/useDashboardDocController.test.tsx` — `"prevents non-approver members from triggering archive or restore mutations"`

---

### Finding 3 — Calendar Event Editor Enabled Forbidden Schedule, Occurrence, and Location Edits for Non-Publisher Members

- **Severity:** Medium
- **Confidence:** Confirmed Defect
- **Evidence:**
  - [`functions/src/routes/calendarManageRoutes.ts`](../../functions/src/routes/calendarManageRoutes.ts#L128-L130) rejects `PUT /api/calendar/manage/:id` with HTTP 403 when `!canPublish(req.authorizationRole) && currentData.status === "published"`.
  - [`functions/src/routes/calendarOccurrenceRoutes.ts`](../../functions/src/routes/calendarOccurrenceRoutes.ts#L49-L150) and [`functions/src/routes/calendarLocationRoutes.ts`](../../functions/src/routes/calendarLocationRoutes.ts#L44-L120) require `ensureCalendarPublisher` (`admin`, `coach`, `mentor`) for all single-occurrence overrides, skipped-date mutations, and venue/location writes.
  - In [`src/app/dashboard/events/hooks/useEventEditor.ts`](../../src/app/dashboard/events/hooks/useEventEditor.ts#L155-L173), [`src/app/dashboard/events/components/EventEditorDrawer.tsx`](../../src/app/dashboard/events/components/EventEditorDrawer.tsx#L323-L434), and [`src/app/dashboard/events/components/ShiftScheduleEditor.tsx`](../../src/app/dashboard/events/components/ShiftScheduleEditor.tsx#L151), when a student opened a published event (to RSVP or upload gallery photos), the `✏️ Edit Event` tab left all schedule inputs, the `Save Series`/`Save This Session` button, the `Skip this date` controls, and the `+ Manage Locations` button enabled.
- **Impact:** Students inspecting a published event in `/dashboard/events` saw editable schedule fields, occurrence skip buttons, and location manager triggers that returned HTTP 403 upon submission.
- **Remediation:**
  - Introduced `canEditEventDetails` in [`src/app/dashboard/events/hooks/useEventEditor.ts`](../../src/app/dashboard/events/hooks/useEventEditor.ts#L174-L180) (`true` for publishers, new event creation, or non-published draft events; `false` when a non-publisher views an already-published event or single occurrence).
  - Guarded `handleSaveEvent`, `handleRevertToRevision`, `handleCancelOccurrence`, and `handleRestoreOccurrence` in `useEventEditor.ts`, disabled schedule form controls and showed a read-only status banner on the `edit` tab in [`EventEditorDrawer.tsx`](../../src/app/dashboard/events/components/EventEditorDrawer.tsx#L271-L280) when `!canEditEventDetails` (while keeping `Roster & RSVPs` and `Gallery` photo uploads active), and gated `+ Manage Locations` in [`ShiftScheduleEditor.tsx`](../../src/app/dashboard/events/components/ShiftScheduleEditor.tsx#L151) on `canEdit && canPublishDirectly`.
- **Acceptance Tests:**
  - `src/test/useEventEditor.test.tsx` — `"prevents non-publisher students from editing published events or skipping occurrences while allowing draft creation"`

---

### Finding 4 — Malformed `<button>` Opening Tag in `EventFormRoster.tsx` Rendered `aria-label` and `disabled` as Literal Text

- **Severity:** Medium
- **Confidence:** Confirmed Defect
- **Evidence:**
  - In [`src/app/dashboard/events/components/EventFormRoster.tsx`](../../src/app/dashboard/events/components/EventFormRoster.tsx#L183-L198), the closing `>` of the attendance toggle `<button>` appeared on line 194 before `aria-label={...}` (line 196) and `disabled={!isAdmin}` (line 197).
- **Impact:** The attendance button rendered literal `aria-label=... disabled=...` text inside the button children, lacked an accessible name, and remained focusable/clickable for non-admins.
- **Remediation:**
  - Moved `aria-label` and `disabled={!isAdmin}` inside the `<button>` opening tag attributes in [`src/app/dashboard/events/components/EventFormRoster.tsx`](../../src/app/dashboard/events/components/EventFormRoster.tsx#L183-L198).
- **Acceptance Tests:**
  - Verified by `pnpm run typecheck`, `pnpm run lint`, and `pnpm run test:coverage`.

---

## Verified Healthy Surfaces (No Defects Found)

1. **Timezone, DST, and Date-Only Math (`Category B`):**
   - [`functions/src/routes/calendarHelpers.ts`](../../functions/src/routes/calendarHelpers.ts): `expandRecurringEvent` anchors series time-of-day in `EVENT_RECURRENCE_TIME_ZONE` (`America/Chicago`) via `zonedLocalDateTimeToEpochMs`, preserving local wall-clock time across spring-forward and fall-back DST transitions while keeping explicit non-midnight UTC test timestamps stable.
   - [`functions/src/routes/calendarFeedRoutes.ts`](../../functions/src/routes/calendarFeedRoutes.ts): Emits `EXDATE` and `RECURRENCE-ID` timestamps using DST-aware `resolveBaseOccurrenceWindow` rather than fixed `86_400_000` ms offsets.
   - [`src/lib/dateOnly.ts`](../../src/lib/dateOnly.ts) and [`src/lib/localDateTime.ts`](../../src/lib/localDateTime.ts): Parse `YYYY-MM-DD` strings at local calendar midnight (`new Date(year, month - 1, day)`) and construct `datetime-local` values using local `getFullYear()` / `getMonth()` / `getDate()` / `getHours()` / `getMinutes()`, avoiding UTC midnight day shifts.
   - Remaining `86_400_000` / `86400000` usages in `functions/src/apps/biobuzz.ts`, `functions/src/biobuzzServer.ts`, and `functions/src/middleware/distributedQuota.ts` are rolling UTC duration windows (24h rate limits and 7-day TTLs), which are intentionally elapsed-time durations rather than wall-clock calendar schedules.
2. **Other Dashboard Role Boundaries (`Category A`):**
   - `/dashboard/tasks`: Matches `firestore.rules` (`match /tasks/{taskId}`), allowing all authorized team members to create/update tasks and own comments.
   - `/dashboard/announcements`, `/dashboard/seasons`, `/dashboard/finance`, `/dashboard/inquiries`, `/dashboard/sponsors`, `/dashboard/tournaments`, `/dashboard/users`: Properly gate mutations to `admin` / `coach` (or `admin` only for `/dashboard/users`) in both UI and backend/rules.
   - `/dashboard/outreach`, `/dashboard/photos`, `/dashboard/videos`, `/dashboard/simulations`: Properly distinguish member draft/upload actions from publisher/admin approval and archival actions.
