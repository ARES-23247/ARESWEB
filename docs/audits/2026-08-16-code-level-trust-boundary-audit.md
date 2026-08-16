# Code-Level Trust-Boundary Audit — 2026-08-16

## Scope and method

- Commit: `d97b3a01fb430dedafbb43f2065933e48fb65806` (merge #122), worktree clean except
  this report. Node v24.19.0, pnpm 11.21.0.
- Unlike the 2026-08-15 gate-based audit, this pass reviewed code paths line-by-line:
  `functions/src/lib/{crypto,logger}.ts`, `routes/{inquiries,profileSelf,profileAdmin,
  profileSync,photosUpload,tasks,zulip,og,simulations}.ts`, `middleware/*`, the client
  auth/API layer (`src/lib/{api,security}.ts`, `src/context/AuthContext.tsx`), and the
  simulation sandbox pipeline (`src/components/editor/SimPreviewFrame.tsx`).
- This is inspection evidence only; no new automated checks were run beyond those already
  green at this commit (full gate passed 2026-08-16, see prior report addendum).

## Positive findings (verified strong patterns)

- **Crypto** (`functions/src/lib/crypto.ts`): AES-256-GCM via PBKDF2 (100k iterations,
  SHA-256) with a fresh random 16-byte salt and 12-byte IV per encryption; secret
  strength-validated at read time including known-test-secret rejection.
- **OG image generation** (`functions/src/routes/og.ts:24-41,149`): query text is
  control-character *and bidi-directional-mark* stripped, XML-escaped, length-bounded,
  ETag-cached, rate-limited, and served with `X-Content-Type-Options: nosniff`. This is a
  textbook public-text-to-image endpoint.
- **Simulation sandbox** (`src/components/editor/SimPreviewFrame.tsx:94-107`): parent
  postMessage handler authenticates the sender by `event.source === iframe.contentWindow`
  (correct for opaque origins) *and* structurally validates message payloads before use.
  iframe is `sandbox="allow-scripts"` + `referrerPolicy="no-referrer"`.
- **Photo upload** (`functions/src/routes/photosUpload.ts`): the 12 MB body parses only
  after auth and distributed quota; magic-byte validation must match the declared MIME
  type; 8 MB cap; SHA-256 dedupe; storage writes rolled back if the Firestore batch fails.
- **Client-side HMAC in `src/lib/security.ts`** is prominently documented as tamper
  detection only, not security — correct threat model for tutorial progress.
- **Markdown rendering**: `rehype-raw` runs before `rehype-sanitize` with a custom schema
  (`DocsMarkdownRenderer.tsx:61-62`); TOC extraction uses `DOMPurify` with empty tag
  allow-list. No tokens in browser storage (mock user in sessionStorage is dev/E2E only).

## Findings

### C1. Pre-authorization may be keyed to an ID no auth user will ever have — Medium / High-confidence code path, needs operational confirmation

- **Evidence**:
  - `functions/src/routes/inquiries.ts:333-360` — `POST /:id/approve-account` looks up
    `adminAuth.getUserByEmail(cleanEmail)`; when no auth user exists it sets
    `targetId = crypto.randomUUID()` and writes `authorized_users/{targetId}`.
  - `functions/src/routes/profileAdmin.ts:414-423` — `POST /admin/users/invite` writes
    `authorized_users/{doc()}` (random Firestore id) with no auth-user creation.
  - The only real (non-mock) signup path is Google `signInWithPopup`
    (`src/context/AuthContext.tsx:181`), which mints a Google-provider UID that will not
    equal either pre-generated ID.
  - Every authorization check keys by auth UID: Firestore `isAuthorized()`
    (`firestore.rules:22-28`) and `ensureTeamMember` (`functions/src/middleware/auth.ts:86`).
- **Impact**: a user approved/invited before they have ever signed in stays unauthorized
  after signing in — the pre-created `authorized_users` doc is orphaned and the user gets
  403s. The join page (`src/app/join/page.tsx`) gives no "sign in first" instruction, so
  the natural applicant flow (submit → wait → first sign-in after approval) hits this.
  The flow only works if the applicant has signed in at least once *before* approval.
- **Why not Confirmed**: an undocumented operational step (e.g., coaches telling
  applicants to sign in first, or the external roster sync at `profileSync.ts:104-131`
  re-keying by verified email) may bridge the gap in practice.
- **Remediation**: on first sign-in, link by verified email — e.g., an `onUserCreate`
  auth trigger that finds a pending `authorized_users` doc by email and re-keys it to the
  new UID (or a callable invoked after Google sign-in). Alternatively require an existing
  auth user at approval time and return actionable guidance otherwise.
- **Acceptance test**: E2E (emulator): invite a fresh email, complete first sign-in with
  that account, assert dashboard access succeeds and exactly one `authorized_users` doc
  exists for the email, keyed by the auth UID.
- **Status**: **Remediated 2026-08-16 (post-report).** Added
  `functions/src/lib/linkAuthorizedUser.ts` and hooked it into both `ensureAdmin` and
  `ensureTeamMember` via `loadAuthorizationDoc` (`functions/src/middleware/auth.ts`):
  when no `authorized_users/{uid}` document exists, the middleware links by the
  email claim in a **verified** ID token (re-keying the pre-authorized doc to the auth
  UID in one batch; archived pre-authorizations are dropped, not inherited) and retries
  the load once. This runs at the exact failure point, requires no new deployed
  trigger, and cannot be claimed with an unverified email. Unit tests:
  `linkAuthorizedUser.test.ts` (5 cases incl. archived-orphan and already-keyed) and a
  middleware retry test in `auth.test.ts`. New utility held to 85/100 coverage floor
  (reports 100/100/100/100). Deployment note: takes effect on the next functions
  deploy.

### C2. Zulip applicant alert forwards 80 chars of raw message text — Low / Confirmed (policy question)

- **Evidence**: `functions/src/routes/inquiries.ts:129-137` — name and email are masked
  (`maskName`/`maskEmail`) before the Zulip alert, but `metadata.message` is forwarded
  verbatim (first 80 characters) into the team Zulip stream.
- **Impact**: an applicant may type phone numbers, addresses, or other PII into the free
  text message; unlike the stored record (encrypted at rest), the alert copy leaves the
  encrypted store and lands in Zulip retention.
- **Remediation**: either omit the message body from alerts (link to the Command Center
  only), or redact digit runs / apply the same PII scrubbing the logger uses.
- **Acceptance test**: unit test asserting the Zulip payload for a message containing a
  10-digit phone number contains no digit runs ≥ 7.
- **Status**: **Remediated 2026-08-16 (post-report).** The alert no longer contains the
  applicant message at all (stronger than the proposed redaction): masked name, masked
  email, type, and a Command Center link only. `inquiries.test.ts` asserts the Zulip
  payload excludes the stored message and the `**Message:**` field.

### C3. `decrypt()` silently passes malformed "ciphertext" through as plaintext — Low / Confirmed

- **Evidence**: `functions/src/lib/crypto.ts:77-85` — non-2/3-part inputs and empty
  hex segments are returned unchanged; `inquiries.ts:188-201` only gates on
  `value.includes(":")`.
- **Impact**: a value that *looks* encrypted but is malformed is surfaced to admins as if
  it were the decrypted plaintext. No attacker path identified (inquiry writes always
  encrypt), but it weakens the fail-closed posture elsewhere enforced (contrast
  `profileSelf.ts:134-143`, which pattern-checks and throws).
- **Remediation**: in `decrypt()`, throw on structurally invalid input instead of
  returning it; keep the `[Decryption Failed]` sentinel only for genuine AEAD failures.
- **Acceptance test**: `crypto.test.ts` asserts `decrypt("::::", secret)` throws or
  returns the sentinel rather than the input.
- **Status**: **Remediated 2026-08-16 (post-report).** `decrypt()` now returns the
  sentinel for structurally invalid input (wrong part count, non-hex or odd-length
  segments) with a server-side warning log, and `DECRYPTION_FAILED` is exported.
  `approve-account` treats the sentinel as a hard failure (500) so an account can never
  be pre-authorized from undecrypted values; `profileSelf` reuses the shared constant.
  Tests cover `::::`, `a:b:c:d`, non-hex segments, and the approve-account 500.

### C4. Album-reassign path updates counts non-atomically — Low / Confirmed

- **Evidence**: `functions/src/routes/photosUpload.ts:100-120` — the reassign branch
  commits the album move batch, then separately decrements the old album count and
  deletes the old subcollection doc. A failure between those steps desyncs `mediaCount`
  and leaves a duplicate photo doc in the old album.
- **Remediation**: fold the decrement and old-album subcollection delete into the same
  batch as the move.
- **Acceptance test**: unit test forcing the old-album delete to fail asserts counts
  remain consistent (or that the whole operation rolled back).
- **Status**: **Remediated 2026-08-16 (post-report).** The photo move, new-album copy,
  both album count adjustments, and the old-album subcollection delete now commit in a
  single Firestore batch (`photosUpload.ts` reassign branch).
  `photosUpload.test.ts` asserts one batch with 3 updates / 1 set / 1 delete and zero
  writes outside the batch.

### C5. Logger does not scrub phone numbers from free text — Info / Confirmed

- **Evidence**: `functions/src/lib/logger.ts:21-27` — `redactText` handles bearer tokens,
  emails, GitHub PATs, and Google API keys, but not phone-number digit runs; phone digits
  only redact when logged under a `phone`-ish key.
- **Impact**: an error message interpolating a user-supplied string containing a phone
  number would log it. Current call sites log structured fields, so no live leak found.
- **Remediation**: extend `redactText` with a conservative digit-run pattern
  (e.g., 10–15 digits with optional separators).
- **Status**: **Remediated 2026-08-16 (post-report).** `redactText` now replaces
  separator-formatted digit runs containing 9+ digits with `[REDACTED]`; shorter digit
  groups such as ISO dates (8 digits) are preserved. `logger.test.ts` asserts
  `555-867-5309` and `+1 (304) 555-0100` are redacted while `2026-08-16` survives.

## Post-report remediation verification (2026-08-16)

All five findings were remediated after this report was published. Verification at the
remediation commit (working tree of `d97b3a01` plus the remediation changes):

- `pnpm --filter functions lint`, `tsc`, and `build` — pass.
- `pnpm --filter functions test:coverage` — 48 files / 613 tests pass; thresholds met
  including the new `src/lib/linkAuthorizedUser.ts` floor (reports 100% lines /
  100% functions) and the `simulations.ts` floor (100/100).
- Root `tsc --noEmit` and `lint` — pass (no frontend files changed).
- `pnpm run test:rules` — pass (rules untouched by these fixes).
- `pnpm run test:e2e` — 80/80 across all browser projects, confirming the auth
  middleware change regresses no dashboard or access-control flow.
- `pnpm run test:functions-emulator` (new) — 3/3 against the Firestore emulator:
  invite re-keyed to the signed-in UID with role preserved and the generated-ID doc
  removed; second link attempt is a no-op (one authorization per email); unverified
  email cannot claim another person's pre-authorization; archived pre-authorizations
  are dropped, not inherited. This delivers the C1 acceptance test against real
  Admin SDK query/batch semantics.

Repo-hygiene note: the 2026-08-15 B1 simulations test expansion had been stranded on
the unmerged `codex/simulation-coverage-ratchet` branch and was absent from `master`.
It was restored verbatim from `47f37d8c` during this remediation pass so the 08-15
report's remediation status is truthful on this branch.

Deployment note: C1's linking takes effect on the next Cloud Functions deploy; no
Firestore rules or data changes are required (the Admin SDK writes bypass rules, and
re-keying preserves role data).

## Non-claims

- C1 is a code-path analysis, not a reproduced production failure. Its acceptance
  requirement is now satisfied by the emulator-backed integration suite
  (`linkAuthorizedUser.emulator.test.ts` via `pnpm run test:functions-emulator`),
  which exercises the real Firestore re-key semantics; the browser-level Playwright
  suite runs on mock sessions and cannot exercise Functions middleware.
- No claim of complete security; this pass covered the listed files only.

## Audited by

Automated agent audit per `aresweb-comprehensive-audit` protocol, extended code-level
review requested by the repository owner.
