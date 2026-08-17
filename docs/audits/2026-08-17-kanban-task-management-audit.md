# Kanban & Task Management Audit — 2026-08-17

## Scope and method

- Commit: current `master` (post-#146 merge, deployed). Reviewer: automated agent audit
  per `aresweb-comprehensive-audit` protocol; inspection evidence only, no new tests run.
- Reviewed: `src/app/dashboard/tasks/**` (board, card, details modal, comments section,
  filters, `taskRecord`, `taskSubtasks`, error handling), `functions/src/routes/tasks.ts`
  (outbound Zulip), `functions/src/routes/webhooks.ts` (inbound Zulip ingestion),
  `firestore.rules` (tasks + comments paths), `src/app/tasks/page.tsx`.
- Architecture in brief: members write tasks **directly to Firestore under strict
  canonical rules** (shape/size-bounded, hard-delete denied); Zulip integration is
  notification-out (`/api/tasks/notify`, `/api/tasks/comment`) and comment-in
  (`/api/webhooks/zulip`, timing-safe token) with one topic per task
  (`Task-{taskId}`).

## What already works well

- **Rules quality is high**: create/update validate exact field sets, enums, and sizes;
  deletes are denied (soft-delete only); comment writes pin `authorUid` to the caller
  and edits are limited to the author's own `content`.
- **Error UX is a model for the repo**: every board operation routes through
  `executeTaskOperation` with typed descriptions, retry actions, and honest
  "saved but Zulip notification failed" messaging — the board is explicitly the source
  of truth.
- **Subtask edits are transactional** (`runTransaction` + normalize-on-read), which
  tolerates legacy malformed data without corrupting it.
- **Live board** via `onSnapshot`, `aria-live` move announcements, duplicate-title
  detection, and a roster-backed assignee picker exist.

## Findings

### K1. Web comments can be echoed back by the Zulip webhook — High / High confidence

- **Evidence**: a web comment is written locally and forwarded to Zulip
  (`TaskCommentsSection.tsx:82-108`). Zulip delivers outgoing webhooks for stream
  messages **including the bot's own**, and the inbound handler stores any
  `Task-{id}`-topiced message with **no sender check and no idempotency key**
  (`webhooks.ts:214-258`).
- **Impact**: each web comment risks appearing twice (once `source: "web"`, once
  `source: "zulip"`) with `commentsCount` double-incremented. Whether the echo fires
  depends on the workspace's outgoing-webhook event filters, so it may manifest
  intermittently — the code permits it either way.
- **Remediation**: (a) ignore inbound messages whose `sender_email` equals the bot
  identity; (b) use a deterministic comment id derived from Zulip's message id so a
  redelivered webhook upserts instead of duplicating.
- **Acceptance test**: unit test posting a webhook payload with the bot's sender email
  asserts no comment is written; a redelivered payload with the same message id writes once.

### K2. Comment ids can collide — Medium / Confirmed

- **Evidence**: web ids are `comment_${Date.now()}` (`TaskCommentsSection.tsx:78`);
  two comments in the same millisecond (or a retry racing a slow commit) overwrite
  the earlier document and undercount. The webhook path already adds randomness
  (`webhooks.ts:241`).
- **Remediation**: `crypto.randomUUID()` like the subtask path already does
  (`page.tsx:303`).
- **Acceptance test**: two rapid comments in one millisecond persist as two documents.

### K3. `commentsCount` has two sources of truth — Medium / Confirmed

- **Evidence**: the stored counter is client/webhook-maintained
  (`TaskCommentsSection.tsx:85`, `webhooks.ts:252`), the details section renders
  `comments.length` (`TaskCommentsSection.tsx:125`), and the card badge shows the
  stored counter (`taskRecord.ts:249-267` clamps it but cannot correct it).
  Comment deletion is permitted by rules but nothing decrements the counter.
- **Impact**: badge drifts from reality; harmless but visibly wrong over time.
- **Remediation**: derive the badge from the comments snapshot (a per-task
  `onSnapshot` already exists when the modal is open), or decrement in the same
  batch as the delete.
- **Acceptance test**: delete a comment; the card badge matches the modal count.

### K4. No keyboard path for moving cards — WITHDRAWN 2026-08-17 (same day)

- **Correction**: `TaskCard.tsx:209-233` already renders a native, fully
  keyboard-operable status `<select>` on every editable card (shown when
  `canEdit`), and the e2e suite already drives it
  (`e2e/interactive.spec.ts:23-30` moves a card through the combobox). The
  auditor reviewed only the page-level drag handlers. No defect, no coverage
  gap — withdrawn in full.

### K5. Assignees are unvalidated strings — Low / Confirmed

- **Evidence**: rules allow any `assignees` list ≤50 strings; the picker suggests
  roster uids but nothing enforces them.
- **Impact**: typos or departed members render as ghosts; no notification can ever
  be keyed off assignment.
- **Remediation**: validate against the roster server-side on the task API, or at
  minimum resolve-or-drop unknown ids at render time with a visible "unassigned" state.
- **Acceptance test**: saving a task with a non-roster assignee is rejected or flagged.

### K6. Board truncates silently at 500 tasks; no per-task deep links — Low / Confirmed

- **Evidence**: `query(..., limit(500))` (`page.tsx:145`) with no overflow signal;
  Zulip notifications link only to the board (`tasks.ts:76`), and the board has no
  `?task=` routing, so "discuss this card" always costs a search.
- **Remediation**: count query for an overflow notice; open-task deep link
  (`/dashboard/tasks?task={id}`) included in every Zulip message.
- **Acceptance test**: Zulip message contains a URL that opens the exact card.

### K7. Zulip edits/deletions never propagate inbound — Info / Confirmed

- **Evidence**: the webhook handles `message` triggers only; a comment edited or
  deleted in Zulip diverges from Firestore silently.
- **Remediation options**: accept and document the divergence (cheapest), or add
  `message-edited`/`delete` handling with matching fingerprinted ids from K1.
- Non-blocking either way.

## Improvement suggestions (prioritized, not implemented)

1. **P1 — K1/K2/K3 comment integrity bundle** (echo guard, uuid ids,
   redelivery-idempotent webhook). Small, removes the only correctness bugs found.
2. ~~P1 — keyboard moves (K4)~~ withdrawn in full — the accessible select and
   its e2e coverage both already existed; the finding was an inspection miss.
3. **P2 — per-task deep links end to end (K6)**: route param + Zulip message links +
   card share button. Makes Zulip threads genuinely actionable.
4. **P2 — due-date digests**: a scheduled function (the repo already runs two) that
   posts a daily "due today/tomorrow/overdue" digest to the kanban stream. Turns the
   board into an actual operations tool rather than a passive list.
5. **P2 — activity trail**: a `revisions` subcollection per task (the events system
   already models this pattern) recording moves/edits with actor + timestamp; feed
   the details modal's History tab and give coaches an audit view.
6. **P3 — assignee validation (K5)** and assignment notifications (Zulip mention of
   the assignee on create/assign).
7. **P3 — WIP guardrail**: a soft "column over N cards" visual warning per subteam;
   purely presentational, no enforcement.
8. **P3 — overflow indicator (K6 first half).**

## Non-claims

- No load testing; the 500-doc realtime board is assumed adequate for a team-scale
  backlog without measurement.
- The echo in K1 depends on workspace webhook configuration; it is permitted by code,
  not observed in production logs from here.
