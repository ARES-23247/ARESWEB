# Comprehensive Website Audit — 2026-08-20

**Audited commit:** `a20d754f52999bd76b19ba285c4cfee689305d06` (`master`)

**Starting state:** clean worktree. This was a read-only source, configuration,
test, build, and bounded production-observation audit. The only repository change
made by the audit is this report. No production data was mutated, no secret was
read or rotated, and nothing was pushed or deployed.

**Scope:** React/Vite application, Firebase Functions and middleware, Firestore
and Storage rules, public DTOs, youth/privacy boundaries, accessibility and
mobile interaction, PWA behavior, SEO/404s, bundle efficiency, tests, CI/CD,
documentation truthfulness, and current/historical repository debt.

**Limitations:** the audit did not enumerate private production documents, inspect
Secret Manager values, perform destructive security testing, or claim WCAG 2.2
conformance. Bounded public API checks inspected schemas/counts without printing
record contents. Manual assistive-technology testing remains necessary.

---

## Executive summary

The site has a strong baseline: split function groups and service identities,
explicit DTOs, encrypted inquiry PII, production App Check, distributed quotas,
authenticated large-upload parsing, WIF deployment, real page/API 404s, small PWA
precache, broad cross-browser/mobile tests, clean dependency audit, and high
Functions coverage all verified.

The fresh audit nevertheless found **12 actionable items: 2 High, 6 Medium, and
4 Low**. The two High findings are authorization/integrity problems in Firestore
rules: active members can demote or replace published content, and any active
member can directly publish or archive event-photo metadata that is later exposed
by the public Calendar API. No confirmed live leak of email, phone, legal student
name, or inquiry PII was found in the bounded public probes.

The team has explicitly decided that students/members should have AI access.
Accordingly, AI access below is treated as a broken permission contract—not as a
recommendation to remove the controls. Active-member access should be enabled on
the server while retaining App Check, quotas, content limits, and logging hygiene.

---

## Findings

### ARES-2026-08-20-01 — HIGH — Members can overwrite or unpublish approved content

- **Confidence:** High; confirmed from rule predicates and direct-write client path.
- **Evidence:** `firestore.rules:143-158`, `firestore.rules:199-213`,
  `firestore.rules:345-361`, and `firestore.rules:369-386` authorize an active
  member whenever the _new_ status is not `published`. They do not constrain the
  old status, ownership, attribution, or changed fields. `src/hooks/useDocumentSync.ts:217-262`
  directly writes full content payloads and revisions from the browser.
- **Impact:** a member can change a published post/document/season/award to draft
  or pending while also replacing its content or attribution. This removes it
  from public view and bypasses the intended approval/revision workflow.
- **Remediation:** separate create and update rules. Members may create their own
  bounded pending drafts and update only their own unpublished drafts. Only
  admin/coach/mentor roles should change a published record or its lifecycle
  fields. Bind author identity to `request.auth.uid` or move publication through
  an audited server endpoint. Apply equivalent controls to revision subcollections.
- **Acceptance test:** Firestore emulator tests prove a member cannot perform
  published→draft, published-content replacement, author reassignment, or edits
  to another member's draft; privileged publication and an owner's pending-draft
  edit still succeed.

### ARES-2026-08-20-02 — HIGH — Event-photo publication lacks ownership and approval controls

- **Confidence:** High; confirmed end to end.
- **Evidence:** `firestore.rules:52-56` and `firestore.rules:174-178` allow any
  active member to write any event photo document and validate only the optional
  occurrence date. The existing rule test at `tests/rules/security.rules.test.ts:328-364`
  intentionally accepts an arbitrary URL. `src/app/dashboard/events/hooks/useEventEditor.ts:440-499`
  writes and archives associations directly. `functions/src/routes/calendarHelpers.ts:443-455`
  accepts any HTTPS URL, and `functions/src/routes/calendar.ts:244-269` returns it
  from the public event-photo endpoint.
- **Impact:** a member can attach an arbitrary external image URL to any event,
  replace metadata, or archive another member's image. For a youth team, direct
  public media publication without a reviewed consent/approval boundary is both
  an integrity and privacy risk.
- **Remediation:** replace direct client writes with a server-side association
  endpoint that verifies the authenticated imported-photo identifier, event,
  uploader/role, occurrence, allowed Storage object, and explicit publication or
  media-consent state. Make client writes to the subcollection server-only and
  expose only approved records through the public DTO.
- **Acceptance test:** rules reject every direct client write. API tests reject
  foreign URLs, unapproved media, cross-event IDs, and unauthorized archive; an
  approved imported image appears only on its intended event/occurrence.

### ARES-2026-08-20-03 — MEDIUM — Public seasons and awards endpoints include drafts

- **Confidence:** High; source-confirmed. Bounded production data currently had
  no draft record, so this is a latent exposure rather than a confirmed live leak.
- **Evidence:** public comments at `functions/src/routes/seasons.ts:144-151` say
  “published,” but `listDtos()` at `functions/src/routes/seasons.ts:125-141`
  filters only `isDeleted`. The Admin SDK bypasses Firestore read rules, and
  `statusValue()` maps missing/unknown values to `published` (`:36-38`).
- **Impact:** saving a non-archived draft through the admin API makes it publicly
  retrievable before publication approval.
- **Remediation:** require `status == "published"` and `isDeleted == 0` in the
  public query/DTO path; fail closed on unknown status.
- **Acceptance test:** route tests seed published, draft, missing-status, and
  archived records and return only the published active record.

### ARES-2026-08-20-04 — MEDIUM — Internal team roster can retain archived/former users

- **Confidence:** High; source-confirmed.
- **Evidence:** `functions/src/routes/profileRoster.ts:134-164` scans up to 300
  `user_profiles` and returns UID, nickname, and avatar without filtering
  `isDeleted`, `archived`, or joining current `authorized_users`. The public
  about-roster path has an archive filter, but this authenticated picker does not.
- **Impact:** former/archived people can remain selectable and their stable
  internal UID remains exposed to every active member longer than necessary.
- **Remediation:** return only profiles with a current, active authorization
  record and exclude archived/deleted profiles. Prefer a purpose-specific opaque
  picker ID if consumers do not require the Firebase UID.
- **Acceptance test:** an archived or deauthorized fixture never appears; an
  active member appears once with only the documented fields.

### ARES-2026-08-20-05 — MEDIUM — Intended member AI access is blocked and inconsistent

- **Confidence:** High; source-confirmed and product intent confirmed by the team.
- **Evidence:** every AI route uses `ensureAdmin` at
  `functions/src/routes/ai.ts:25-65`. The document editor exposes its copilot to
  all authorized users (`src/components/dashboard/DocFormDrawer.tsx:441-503`),
  while the event editor gates it to `isAdmin`
  (`src/app/dashboard/events/components/EventEditorDrawer.tsx:197-210` and
  `:399-409`). `src/app/dashboard/events/components/EventEditorAiCopilot.tsx:59-65`
  invents “MARS Building” when no venue is selected, and
  `ShiftScheduleEditor.tsx:160-186` visually defaults or labels the same venue.
- **Impact:** students/members see a feature that fails with 403 in one editor and
  is hidden in another. AI prompts can also be given a fabricated event location.
- **Remediation:** add an explicit active-member AI authorization middleware and
  use the same `canUseAi` contract across both UIs. Retain App Check, distributed
  per-user quotas, body limits, prompt/output bounds, and generic errors. Pass
  “venue not selected” rather than inventing a location.
- **Acceptance test:** active student/member, mentor, coach, and admin succeed
  within quota; unverified/archived users fail; quota returns 429; both editors
  render consistently; a missing venue remains missing in the prompt.

### ARES-2026-08-20-06 — MEDIUM — Publishing hides social syndication failure

- **Confidence:** High; source-confirmed.
- **Evidence:** `src/hooks/dashboard/useDashboardDocController.ts:133-146`
  saves the post first, calls `/api/webhooks/syndicate-post`, then catches every
  failure and only logs a warning.
- **Impact:** the UI can report a successful publication while Buffer/Bluesky or
  another downstream channel failed. There is no durable user-visible partial
  failure, retry action, or delivery status.
- **Remediation:** persist per-channel delivery receipts/status and show
  “Published; cross-post failed” with a privileged retry. Keep content publication
  independent so a social outage does not roll back the website post.
- **Acceptance test:** a simulated upstream failure leaves the post published,
  displays a visible failed-channel state, and a retry changes it to delivered
  without duplicating successful channels.

### ARES-2026-08-20-07 — MEDIUM — Documentation components fabricate successful tools and assets

- **Confidence:** High; source-confirmed.
- **Evidence:** `src/components/docs/DocsMarkdownRenderer.tsx:11-15` and
  `:99-105` expose the tags. `CodePlayground.tsx:16-22` uses timers to print
  “BUILD SUCCESSFUL” and “Deploying” without compilation. `ConfigVisualizer.tsx:19-23`
  labels itself “Live” and “DEPLOY,” but only toggles local state.
  `ScreenshotGallery.tsx:7-13` starts with three DiceBear robots and
  `:62-66` labels every image “Telemetry Dashboard,” even when the later API data
  is an unrelated gallery photo.
- **Impact:** public documentation makes false success, deployment, and artifact
  claims and masks empty/upstream-error states, conflicting with the repository's
  anti-fabrication boundary.
- **Remediation:** either remove these tags or make them explicitly labelled,
  non-operational demos with truthful output. Gallery content must come from an
  explicit screenshot DTO and show honest loading, empty, and error states with
  per-image descriptions.
- **Acceptance test:** no user action reports compilation/deployment unless a real
  backend operation succeeds; API failure shows an error, empty data shows an
  empty state, and every screenshot has source-specific alternative text.

### ARES-2026-08-20-08 — MEDIUM — Lazy/editor bundles have almost exhausted their budgets

- **Confidence:** High; measured from a clean production build.
- **Evidence:** the build passed, but aggregate route JS was 7.97 MB raw / 2.28 MB
  gzip against 8.30/2.35 MB budgets. Editor runtime was 13.95/3.31 MB against
  14.25/3.45 MB; its TypeScript worker was 6.89/1.48 MB against 7.00/1.55 MB.
  Vite still warns about chunks over 500 KB. Initial JS (723/227 KB) and the PWA
  precache (22 entries, 962 KB) are substantially healthier.
- **Impact:** a small editor or route feature can breach CI, and opening an editor
  remains expensive on constrained mobile devices even though first load is good.
- **Remediation:** load Monaco languages/workers on demand, remove duplicated
  language payloads, split Mermaid/editor adapters, and measure cold interaction
  on a throttled mid-range phone before ratcheting the budgets downward.
- **Acceptance test:** editor cold-open metrics are recorded on a defined mobile
  profile; all budgets retain at least 10% headroom with no initial-load regression.

### ARES-2026-08-20-09 — LOW — New-event time defaults use UTC in a local-time input

- **Confidence:** High; source-confirmed.
- **Evidence:** `src/app/dashboard/events/hooks/useEventEditor.ts:187-192` sets
  `datetime-local` strings with `new Date().toISOString().slice(0, 16)`.
- **Impact:** in America/New_York, the default start/end shown to the editor is
  four or five hours ahead of local time, depending on DST.
- **Remediation:** format the current local date/time explicitly for
  `datetime-local`, then convert only at the API boundary.
- **Acceptance test:** timezone-parametrized tests cover EST, EDT, and a DST
  transition without shifting the wall-clock value.

### ARES-2026-08-20-10 — LOW — Frontend test assurance is broad but not end-to-end authenticated

- **Confidence:** High; configuration-confirmed.
- **Evidence:** `vite.config.ts:150-192` measures an explicit production-file
  subset and the global floors remain 56% lines / 42% functions (`:193-197`).
  E2E injects `ares_mock_user` in `e2e/fixtures.ts:41`; `AuthContext.tsx:44`,
  `:76`, and `:239` enables/bypasses real Firebase auth in E2E mode.
- **Impact:** the 90-browser suite is excellent for UI, reflow, and navigation,
  but it cannot catch Firebase token, App Check, rule, and middleware composition
  failures in a real sign-in path. New unlisted frontend files may contribute no
  coverage.
- **Remediation:** keep the fast mocked matrix, add at least one emulator-backed
  authenticated browser flow, and fail CI when a new critical production module
  is not included in coverage.
- **Acceptance test:** an emulator E2E proves sign-in → token/App Check headers →
  authorized API/rule access and an archived/unverified denial.

### ARES-2026-08-20-11 — LOW — Historical Git objects remain unusually large

- **Confidence:** High; measured.
- **Evidence:** the current tracked tree contains no file over 1 MB, but
  `git count-objects -vH` reports 883.52 MiB of packed history.
- **Impact:** fresh clones, CI fetches, and repository maintenance remain heavier
  than the current source tree warrants.
- **Remediation:** separately inventory historical blobs and coordinate a backed-up
  history rewrite/LFS migration with every collaborator. Do not rewrite history
  as routine cleanup.
- **Acceptance test:** fresh-clone packed size and checkout time fall to agreed
  targets, all active work is rebased, and protected deployment references remain valid.

### ARES-2026-08-20-12 — LOW / accepted vendor constraint — Onshape secret is in the callback URL

- **Confidence:** High; documented design.
- **Evidence:** `functions/src/routes/webhooks.ts:309-333` reads
  `?token=<secret>` and compares it timing-safely. `docs/SECURITY_OPERATIONS.md:59-64`
  records that Onshape supplies no signature header.
- **Impact:** query strings can be retained by vendor, proxy, or access logs even
  though the application does not log it. This conflicts with the preferred
  “no credentials in URLs” posture but may be unavoidable at the vendor boundary.
- **Remediation:** retain a single-purpose high-entropy token, guarantee query
  redaction in every edge/log sink, rotate it periodically, and add an IP/source
  allowlist if Onshape publishes stable ranges. Prefer signed headers if the vendor
  adds them.
- **Acceptance test:** automated log tests prove no raw query/token reaches logs;
  invalid tokens fail before body interpretation; documented rotation succeeds.

---

## Remediation status

The implementation pass following this audit closed the confirmed application
defects without changing production data or deploying:

| Finding | Status                       | Implemented control                                                                                                                                                                                                                      |
| ------- | ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 01      | Remediated                   | Private, immutable ownership records now bind member drafts to a Firebase UID; members can edit only their own pending content, while publishers control lifecycle changes and published records. Seasons and awards are publisher-only. |
| 02      | Remediated                   | Event-photo writes are server-only. Associations copy trusted imported-photo metadata, member submissions require publisher approval, duplicate attachment is transactional, and archive is uploader-or-publisher only.                  |
| 03      | Remediated                   | Public seasons/awards queries and DTO filtering both require explicit `published` state and fail closed for absent/unknown status.                                                                                                       |
| 04      | Remediated                   | The internal picker joins active authorization records and excludes archived/deleted profiles. Firebase UID remains necessary because task/event assignment records use it.                                                              |
| 05      | Remediated                   | Backend AI routes and every corresponding UI now use the same active-member allowlist. App Check, quotas, content bounds, and generic failures remain. Fabricated venue fallbacks were removed.                                          |
| 06      | Remediated                   | Existing durable per-channel backend receipts remain authoritative; the publisher UI now reports partial failure and offers an idempotent retry without re-saving the post.                                                              |
| 07      | Remediated                   | The three documentation widgets are explicitly non-operational examples or truthful empty states; fabricated build/deploy output and robot/gallery assets were removed.                                                                  |
| 08      | Open architecture item       | Production budgets still pass, but Monaco/TypeScript workers remain large and do not yet have the required 10% headroom. This is not safe to disguise by loosening the budget.                                                           |
| 09      | Remediated                   | New defaults and stored values are converted at the local-control/API boundary; edited or new values are saved in canonical UTC ISO form while legacy naïve values retain their wall-clock meaning.                                      |
| 10      | Partially remediated         | Critical calendar API modules were added to coverage ratchets and CI now runs real Firestore-backed authorization middleware tests for active and archived users. A full Firebase Auth + App Check browser flow remains open.            |
| 11      | Deferred operational project | No history rewrite was attempted; it requires a coordinated backup, collaborator migration, and explicit destructive authorization.                                                                                                      |
| 12      | Accepted vendor constraint   | No weaker alternate credential transport exists today. Existing timing-safe validation and no-query logging posture remain required.                                                                                                     |

Deployment notes: existing event-photo associations without an explicit approval
state will appear as pending in the editor and remain absent from the public API
until a publisher reviews them. Existing pending content without a private
ownership record remains editable by publishers, not automatically claimed by a
member. These fail-closed transitions intentionally avoid guessing ownership or
media consent.

---

## Verification evidence

All of the following passed on the final post-remediation worktree unless noted:

- Node 24.19.0 and pnpm 11.21.0; Java 21 available for emulators. The wrapper's
  sandboxed runtime-discovery check could not see global pnpm/Java, but direct
  gate execution used the installed versions.
- Frozen install and lockfile/supply-chain policy checks.
- Root and Functions ESLint: zero warnings.
- Root TypeScript and Functions build.
- Frontend: 122 files / 674 tests; measured included-surface coverage 79.81%
  lines, 74.83% functions, 71.91% branches. The newly ratcheted Calendar API
  finished at 92.23% lines and 100% functions.
- Functions: 57 files / 716 tests; 95.34% lines, 97.89% functions, 83.88%
  branches.
- Firestore/Storage emulator rules: 24 tests. Real Firestore-backed middleware
  authorization integration: 5 tests covering active and archived accounts.
- Production build, 25 prerender shells, PWA generation, and bundle-budget gate.
- Bundle measurements: initial JS 723,027 raw / 227,363 gzip; aggregate route JS
  7,970,805 / 2,278,634; editor runtime 13,949,385 / 3,308,728. All current
  budgets pass, while finding 08's headroom concern remains open.
- Playwright: 90/90 on desktop Chromium/Firefox/WebKit, Pixel 7 Chromium, and
  iPhone 15 WebKit, including 320 px homepage reflow and mobile navigation/dialogs.
- Baseline production health at the audited commit: 13/13 on the Firebase-hosted site, including security
  headers, prerendered metadata, public APIs, sitemap/RSS, and genuine page/API 404s.
- `pnpm audit --prod --audit-level=high`: no known vulnerabilities.
- Agent-skill validation: canonical skills discovered by Codex, Gemini, and
  Antigravity.

A live browser session observed one transient stale lazy-chunk error that recovered
automatically and did not recur. Because recovery worked and the existing PWA
update suite passed, this is recorded as an observation rather than a defect.

## Verified strengths

- Active roles use an explicit allowlist and archived users are denied at the API
  middleware boundary.
- Inquiry PII is encrypted before first write; public DTOs do not return those fields.
- Large uploads authenticate and consume distributed quota before parsing bodies.
- Production mutation routes enforce App Check; external webhook exemptions use
  dedicated secrets and bounded schemas.
- Function groups, runtime service identities, and secret bindings are separated;
  deployment uses repository-restricted Workload Identity Federation.
- Public member data is minimized; student public profiles expose nickname and
  approved avatar rather than legal/contact identity.
- Security headers, real 404 handling, prerendered metadata, and cache contracts
  are protected by tests and production verification.

## Recommended order

1. Close findings 01 and 02 together with rules/API emulator coverage.
2. Fix public draft filtering and roster lifecycle filtering (03–04).
3. Implement the intended active-member AI policy and remove fabricated venue
   defaults (05).
4. Add durable syndication status/retry and retire or relabel fabricated docs
   widgets (06–07).
5. Correct local event defaults, add emulator-authenticated E2E, and continue the
   measured editor split (08–10).
6. Treat Git history rewriting and the Onshape constraint as separate coordinated
   operational projects (11–12).

This report does not claim complete security, privacy, or WCAG conformance. It is
a dated audit of the commit and evidence above.
