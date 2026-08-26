# ARES Academy Phase 2

Status: deployed and verified; Phase 3 content launch completed 2026-08-25 EDT
Baseline commit: `a9e01f7b72c9ce2ef415b9c1fa38688f1eea57b3`  
Baseline date: 2026-08-25

The starting-point notes below describe the state before Phase 2 implementation.
The implemented-result and verification sections record the delivered state.

## Verified starting point

- Public Academy and ARESLib records are read through bounded DTO routes under
  `/api/content/docs`; direct public Firestore reads remain disabled.
- Six learning-path identifiers, ordered path memberships, prerequisites,
  subject, level, content type, platform, duration, source provenance, and safety
  scope already exist in the public metadata contract.
- The Academy landing page already supports local title/topic search and basic
  subject, level, content-type, and path filters.
- Detail-page previous/next links currently follow the overall API array order,
  not the learner's selected path. The current route does not preserve path
  context.
- The browser does not currently store lesson completion. Existing public copy
  accurately says completion is not collected or stored.
- The editor has edit and revision tabs plus local crash-recovery drafts. It has
  no complete draft preview tab. The existing client approval helper can publish
  a previously loaded object without binding approval to the exact current
  Firestore content.
- Checked-in curriculum sources are pinned to released ARESLib 9.10.0 and exact
  Git commits. The current local and tagged ARESLib release is 9.12.0 at commit
  `7515aee5c8817c56d047a7c05beb3720027b968d`; older reviewed lessons must remain
  labeled with their actual version until separately reviewed.
- Current authoritative FTC season code is clean on `master` at
  `631682a167ba58d1d56ab2b31e982ccbf46ae0bf`. New robot-code tutorials must cite
  exact public commits and remain drafts pending human review.

## Delivery slices

### 1. Learner navigation and local progress

- Make filters URL-backed and validate every query parameter against an
  allowlist.
- Add platform, topic, and estimated-duration filtering without exposing content
  bodies in the list DTO.
- Render selected paths as explicit ordered sequences with a clear starting
  lesson, prerequisites, position, and completion summary.
- Compute previous, next, and related lessons from published metadata. Preserve
  selected path context in links and never cross the Academy/ARESLib boundary.
- Store only a versioned set of completed public slugs in local browser storage.
  Store no name, account identifier, timestamps, free text, or analytics event.
  Explain that progress is device/browser-local, provide a reset control, and
  degrade cleanly when storage is blocked.

Acceptance evidence:

- Pure navigation/filter/progress utilities meet the new-code coverage gate.
- Component tests cover malformed URLs, unavailable storage, schema upgrades,
  prerequisites, path ordering, and no-result/error states.
- Playwright covers keyboard use and 320 px reflow for selecting a path, marking
  completion, continuing to the next lesson, clearing filters, and resetting
  local progress.

### 2. Editor preview and exact approval

- Add an accessible preview tab that renders the unsaved draft with the same
  Markdown/Tiptap and learning-metadata components used publicly.
- Saving reviewed collections creates or returns them to pending approval when
  reviewable fields change.
- Add a protected approval endpoint for `docs`. It authenticates and authorizes
  admin/coach/mentor roles, enforces App Check, validates the slug and exact
  review digest, and commits publication plus a redacted audit event in one
  transaction.
- Reject stale digests, archived documents, malformed metadata, unknown roles,
  and cross-library requests. Never return raw documents or private identity.
- Prevent direct client rules from transitioning a pending document to approved;
  the Admin SDK endpoint is the sole publication boundary.

Acceptance evidence:

- Route tests exercise missing authentication, invalid/archived authorization,
  missing App Check, member denial, malformed digest, stale content, success,
  replay, and transaction failure.
- Emulator tests prove members can update only their own pending drafts,
  publishers can edit reviewable content only by returning it to pending, and no
  browser client can approve a document directly.
- Preview keyboard, focus, long-content, Markdown, and Tiptap cases pass on mobile
  and desktop.

### 3. Provenance drift and new tutorials

- Maintain a reviewed source-authority manifest containing the current released
  version and exact approved commit for each curriculum repository.
- Keep historical version pins valid, but label them as older than the current
  release. Remote CI verification fails when the declared current ARESLib release
  no longer matches the authoritative repository release metadata.
- Continue verifying immutable GitHub blob URLs and recomputed Git blob hashes;
  reject mutable branch URLs, unapproved repositories, missing files, invalid
  hashes, broken prerequisite references, and duplicate path ordering.
- Draft additional tutorials only from current authoritative source. Each draft
  includes scope, prerequisites, objectives, safety boundary, exact commit,
  source path, blob hash, and version. Draft generation never publishes.

Acceptance evidence:

- Local validation is deterministic without network access; the stronger remote
  check verifies source files and current release metadata.
- Validator tests cover current, historical, stale-policy, broken-link, mutable
  reference, unknown-repository, and duplicate-order cases.
- Generated import artifacts remain pending drafts. Production publication still
  requires a fresh backup, exact-content human approval, dry run, explicit
  production-write confirmation, and post-write re-read.

## Production boundary used during implementation

Phase 2 kept code implementation, local tests, emulators, and draft preparation
separate from production changes. Production publication occurred only after a
fresh protected Firestore export, emulator rehearsal, exact-content Lead Coach
approval, explicit write authorization, and post-write verification.

## Implemented result

- Academy filters are URL-backed and allowlisted across search, subject, level,
  type, path, platform, topic, and duration. Selected paths render as ordered
  sequences with a start/continue action, prerequisites, and path-aware
  previous/next navigation. Related lessons require a meaningful curriculum or
  subject relationship rather than a coincidental format match.
- Anonymous progress stores only a versioned, bounded list of public lesson
  slugs in the current browser. It contains no identity, timestamps, free text,
  or analytics events; blocked storage degrades to the current page session.
- The documentation editor previews the unsaved draft using the same Markdown,
  Tiptap, and learning-metadata renderers used by public pages.
- Every documentation save returns the record to pending review. Admin, coach,
  and mentor approval uses an authenticated, App-Check-protected server
  transaction bound to a SHA-256 digest of the exact reviewable document. The
  same transaction writes a redacted audit record; Firestore rules prevent any
  browser client from performing the pending-to-published transition.
- `source-authorities.json` preserves reviewed historical sources while naming
  ARESLib v10.0.0 at commit
  `6401a295e57aef31ab3ad0f445e6a95516607d27` as current. The current-robot
  tutorials remain accurately labeled with the ARESLib version used by their
  pinned ARES-FTC source. Remote CI recomputes immutable Git blob hashes and
  fails if the declared current ARESLib release is stale.
- Three current-code tutorials cover season composition and failure latching,
  driver-input shaping and coordinate frames, and intake I/O neutral-first
  fault recovery. They were staged and published as the bounded Phase 3 launch
  after review of digest
  `c4d912d91cf442de36084ad278ae25900f44a54fb62939b38eafa3f391c700c4`.

## Verification evidence

- Source verification: 18 source-controlled documents, 16 unique source blobs
  recomputed, and current ARESLib v10.0.0/tag commit verified. Historical pins
  remain valid and retain their actual version labels.
- Frontend coverage: 145 files and 802 tests pass; all Phase 2 utilities and the
  preview component meet 85% line and 100% function thresholds.
- Functions coverage: 63 files and 768 tests pass; the approval route has 94.59%
  line and 100% function coverage.
- Firebase rules: 30 emulator tests pass, including direct-publication denial,
  pending edits, lifecycle-only archival, and client audit-write denial.
- Browser evidence: all 111 Playwright cases pass across desktop Chromium,
  Firefox, and WebKit; Pixel and iPhone profiles; and the production PWA worker.
  The keyboard-operated path/filter/progress/next-step flow passes at 320 px
  without horizontal overflow.
