# Red-Team Penetration Test — 2026-08-24

## Executive result

No Critical or High-severity exploit was identified in the tested scope. The
application resisted the executed authentication, authorization, traversal,
upload, injection, webhook, CORS, App Check, rate-limit, and error-disclosure
attacks.

Two source-confirmed Medium findings were identified and remediated in the
local release candidate:

1. the global API error logger records concrete request paths, which can place
   Firebase user IDs and other record identifiers into Cloud Logging; and
2. legacy public Firestore rules return complete documents instead of explicit
   public DTOs, including operational metadata that public pages do not need.

The Low response-hardening finding was also remediated locally. One previously
documented accepted residual risk remains. The fixes have not been pushed or
deployed as part of this audit. This result is evidence for the stated scope on
the stated date, not a claim of complete security or a certified penetration
test.

## Authorization, scope, and state

- Explicitly authorized by the repository and site owner against the first-party
  ARESWEB system: `https://aresfirst.org`, its Firebase-hosted aliases, its split
  Cloud Functions APIs, and local Firebase emulators.
- Local repository commit: `6ed52c22affd348690d476c17b1c59b10274dea2`
  on `codex/storage-app-check-observation`.
- Deployed and `origin/master` commit at test start:
  `ad2a40f055809a8cecea0e15106b3bb3bb6e36bc`.
- The tracked worktree was clean at test start. The local branch is one
  observation-tooling commit ahead of the deployed commit; its diff is limited
  to Storage App Check observation scripts and documentation.
- Production testing was low-rate and non-destructive. It did not submit
  inquiries, upload media, alter records, post to integrations, spray
  credentials, solve CAPTCHAs, or perform load/DoS testing.
- Full-strength attacks used Firebase Auth, Firestore, Functions, and Storage
  emulators with disposable identities and local test values. No real secret was
  written to source or a test configuration file.
- After the owner completed the trusted-session handoff, a production browser
  check verified the active administrator identity and traversed `/dashboard`,
  `/dashboard/inquiries`, `/dashboard/users`, `/dashboard/documents`,
  `/dashboard/photos`, `/dashboard/finance`, `/dashboard/zulip`,
  `/dashboard/tasks`, `/dashboard/events`, and `/dashboard/blog`. These checks
  were read-only: no production record, upload, inquiry, integration, or setting
  was created or changed.

## Methodology and evidence

- Re-ran `node scripts/pentest/attack-suite.mjs --target=prod`: **23 passed,
  0 failed**.
- Re-ran the complete emulator command through `firebase emulators:exec`:
  **47 passed, 0 failed** (24 local full-strength checks plus the 23 production
  checks).
- Tested malformed and missing bearer credentials, token-header confusion,
  signed-up-but-unauthorized identities, member-to-admin escalation, profile
  IDOR, simulation traversal, forged webhook authentication, oversized inquiry
  metadata, prototype-pollution-shaped input, MIME/magic-byte mismatch, SVG
  upload rejection, upload size enforcement, unauthenticated upload, inquiry
  throttling, malformed JSON, clean 404s, and public DTO key hygiene.
- Sent low-rate production probes to the same-origin API and direct function
  routes for authentication, App Check, CORS, malformed input, traversal, and
  unexpected error disclosure. No stack trace, hostile CORS reflection, or auth
  bypass was returned.
- Probed Firestore REST without App Check; Firestore rejected both document and
  structured-query access with `403`, consistent with enforcement. App Check is
  an abuse signal, not an authorization or field-projection boundary, so rules
  were also reviewed directly.
- Inspected rendered public pages, five live blog entries, the unauthenticated
  administrative gate, and the authenticated administrative routes listed
  above. No page error or console warning was observed during the authenticated
  traversal. The rendered blog content created no executable user-authored
  scripts; the observed YouTube frame retained a sandbox without
  `allow-same-origin`.
  A stale lazy chunk returned `404` once, after which the existing recovery path
  removed stale service-worker/cache state and restored the current application.
- Confirmed production headers on `/` and `/api/robots`; source maps returned
  `404`.
- Scanned the current tracked tree for common private-key, PAT, OAuth-secret,
  AWS-key, Slack-token, and Google API-key patterns. No tracked secret was found.
- GitHub reported no open CodeQL, Dependabot, or secret-scanning alerts at the
  audited revision, and the deployed revision's CI/code-quality checks were
  green.

## Findings

### RT-01 — Concrete request paths could log raw user and record identifiers

- **Severity:** Medium
- **Confidence:** High — source-confirmed and reproduced in the Functions
  emulator.
- **Status:** Remediated locally; pending review and deployment.
- **Evidence:** `functions/src/middleware/errorHandler.ts:23-29` logs
  `req.path` for every handled API error. `functions/src/lib/logger.ts:15-20`
  redacts values only when their object key is recognized as sensitive, while
  `path` is not sensitive and `redactText` does not recognize Firebase UIDs.
  During the test, a denied profile IDOR emitted a path shaped like
  `/api/profiles/admin/users/<firebase-uid>/profile` into the emulator log.
- **Impact:** Cloud Logging can retain stable member identifiers, task IDs, and
  other record identifiers embedded in routes. For a youth organization, this
  unnecessarily expands the systems and operators that can observe persistent
  identifiers and conflicts with the repository's stated no-raw-UID logging
  boundary. The client response remained generic; this is a server-side privacy
  exposure, not public response leakage.
- **Remediation applied:** `functions/src/middleware/errorHandler.ts:15-35`
  now derives and logs only a bounded route group such as `/api/profiles`, plus
  the method and redacted error. The regression test passes a representative
  Firebase UID in the path and asserts that neither the UID nor the concrete
  administrative path reaches captured logs.
- **Acceptance test:** Invoke `globalErrorHandler` with a path containing a
  representative Firebase UID and record ID. Assert that neither identifier is
  present in captured output while method, route group, status, and error type
  remain diagnosable.

### RT-02 — Legacy public Firestore reads exposed full records instead of DTOs

- **Severity:** Medium
- **Confidence:** High for the data-boundary defect; Medium for current impact
  because no live student PII value was enumerated.
- **Status:** Remediated locally; pending review and deployment.
- **Evidence:** Before remediation, anonymous reads returned entire published
  `posts`, `docs`, `documents`, `seasons`, and `awards` records. The server
  preserves operational Drive fields such as identifiers, hashes, and sync
  state on document records, making a raw-public boundary unsafe even when the
  current UI does not display those values.
- **Impact:** A normal public client with a valid App Check token can receive
  fields that the user interface does not display, including stable Drive file
  identifiers, hashes, sync state, timestamps, and any future field added to a
  published record. App Check reduces automated abuse but does not provide
  identity-based authorization or field projection. No current public response
  was observed leaking email, phone, or raw user-ID keys.
- **Remediation applied:** `functions/src/routes/content.ts:86-157` now serves
  allow-listed, bounded blog and Academy/ARESLib DTOs. The public blog and
  document views consume these endpoints, and seasons/awards reuse their
  existing DTO routes. `firestore.rules:205-258`, `:400`, `:420`, and `:427`
  now deny anonymous reads of the backing records. Emulator rule tests seed a
  future internal field and verify that anonymous document and collection reads
  fail while authorized team access remains intact.
- **Acceptance test:** Seed published records with public fields plus
  `driveFileId`, a checksum, an approver UID, and a future unknown field. Assert
  that an unauthenticated Firestore SDK read fails even with App Check present,
  while the public API succeeds and returns only the allow-listed DTO keys.

### RT-03 — Response hardening was incomplete and the API advertised Express

- **Severity:** Low
- **Confidence:** High — verified on production and in source.
- **Status:** Remediated locally; pending integration validation after deploy.
- **Evidence:** Production `/api/robots` returned `X-Powered-By: Express`.
  `functions/src/apiApp.ts:35-38` creates the app without disabling that header.
  Production responses did not include a `Permissions-Policy`; the hosting
  headers at `firebase.json:30-48` do not configure one. The CSP is substantial
  but retains broad Google wildcards, legacy direct-Storage image origins, and
  inline style allowances.
- **Impact:** The framework disclosure marginally improves attacker
  fingerprinting. Missing feature restrictions leave browser capabilities at
  their defaults, and broad CSP sources increase the effect of a future markup
  or script-injection defect. Existing `object-src 'none'`,
  `frame-ancestors 'none'`, `script-src-attr 'none'`, HSTS, nosniff, and strict
  referrer controls materially reduce risk.
- **Remediation applied:** `functions/src/apiApp.ts:37` disables
  `X-Powered-By`. `firebase.json:46-47` supplies a conservative
  `Permissions-Policy` that denies unused sensitive capabilities while retaining
  the explicit first-party credential and share exceptions. CSP tightening was
  deliberately not bundled into this remediation because OAuth, reCAPTCHA,
  Drive/Photos Picker, YouTube, Onshape, and opaque simulation frames need a
  deployed preview observation window before origins are removed.
- **Acceptance test:** Extend hosting/API header tests, deploy to a preview
  channel, exercise the named integrations, then verify production headers show
  no `X-Powered-By`, include the agreed `Permissions-Policy`, and produce no
  unexplained CSP violations.

### RT-04 — Onshape webhook authentication token is carried in the URL

- **Severity:** Low, accepted residual risk
- **Confidence:** High
- **Evidence:** `functions/src/routes/webhooks.ts:323-333` reads the Onshape
  token from `req.query.token` and compares it using a timing-safe helper.
  `docs/ONSHAPE_ZULIP_INTEGRATION.md:1-12` and `:65-86` explicitly document the
  vendor constraint and callback format.
- **Impact:** URL secrets can appear in browser, proxy, vendor, or access logs.
  The endpoint fails closed, uses a dedicated Secret Manager binding, validates
  event types, and does not accept the token as general site authorization.
- **Remediation:** Keep the documented short rotation process and ensure
  Cloudflare/Firebase log views do not retain query strings for this endpoint.
  Move to a signed header or body signature if Onshape adds that capability.
- **Acceptance test:** Confirm a missing/wrong token is denied, the correct token
  accepts only allow-listed event types, operational logs omit the query string,
  and rotation invalidates the prior token.

## Remediation validation

- Authorized attack suite after the fixes: **47 passed, 0 failed** across the
  disposable Auth/Firestore/Functions/Storage emulators and the low-rate,
  read-only production subset.
- Frontend unit/coverage suite: **137 files, 754 tests passed**. The new public
  content client achieved 100% line and function coverage.
- Functions unit/coverage suite: **61 files, 759 tests passed**. The new content
  route achieved 100% line and function coverage.
- Firestore and Storage rules suite: **27 tests passed**, including anonymous
  rejection of raw public-content records.
- Playwright production-preview suite: **106 tests passed** across desktop
  Chromium, Firefox, WebKit, mobile Chromium, mobile WebKit, and the PWA worker.
  The route smoke now explicitly includes blog, Academy, and ARESLib. This gate
  initially exposed missing preview API fixtures for the new DTO path; the
  fixtures were corrected and the complete suite then passed.
- Lint, TypeScript, Functions build, production frontend build, prerendering,
  bundle budgets, frozen-lockfile install, and shared-agent validation passed.
  `pnpm audit --prod --audit-level=high` reported no known vulnerability.

## Security controls that held

- Mutation App Check is enforced in production with narrow exemptions only for
  separately secret-authenticated server integrations
  (`functions/src/middleware/appCheck.ts:6-15` and `:106-130`).
- API CORS uses an explicit first-party allowlist; hostile origins were not
  reflected (`functions/src/apiApp.ts:20-32`).
- Authentication verifies Firebase ID tokens and then loads an active
  authorization record server-side (`functions/src/middleware/auth.ts:36-46`
  and `:76-122`). Signed-up but unauthorized users and member-to-admin
  escalation attempts were denied.
- The only 12 MB JSON parser is behind team authentication and a distributed
  quota; default JSON bodies are capped at 1 MB
  (`functions/src/apiApp.ts:49-69`).
- Unexpected 5xx responses remain generic and do not return stack traces
  (`functions/src/middleware/errorHandler.ts:31-47`).
- Direct Storage reads and writes are denied for event, blog, gallery, CAD,
  editor, public-media, and field paths; publication-aware same-origin gateways
  serve media (`storage.rules:5-43`).
- Function groups have separate secret bindings and runtime identities,
  limiting blast radius (`functions/src/functionConfig.ts:25-49`).
- Public DTO probes for calendar, photos, videos, tournaments, finance,
  outreach, sponsors, robots, and roster data contained no email, phone, raw UID,
  receipt URL, internal Storage path, or secret-shaped keys.

## Informational observations

1. `aresfirst-portal.web.app` and `aresfirst-portal.firebaseapp.com` serve the
   application directly, outside the Cloudflare hostname. Application-layer
   authentication, authorization, App Check, rate limiting, rules, and headers
   still apply. Do not treat Cloudflare-only controls as the sole security
   boundary; keep the Firebase alias needed for OAuth narrowly allow-listed.
2. The stale lazy-chunk failure recovered automatically and did not disclose
   data. Keep the existing recovery regression tests because this path has
   previously affected production usability.
3. Firebase emulator logs warn that `request.ip` is undefined under the emulator
   transport. The inquiry-specific rate-limit attack still reached `429`, and
   production returned valid rate-limit headers. Treat this as emulator noise
   unless the same validation appears in Cloud Logging.

## Limitations and non-claims

- No credential stuffing, social engineering, dependency zero-day research,
  sustained traffic, denial-of-service, destructive production action, or
  third-party penetration of Google, Zulip, Onshape, GitHub, Buffer, Bluesky, or
  Cloudflare was performed.
- Production authenticated write paths were validated by source review, unit and
  emulator tests, not by creating or modifying live records.
- Current tracked-secret and GitHub-alert results do not prove that every prior
  Git object, external log, local clipboard, or previously revoked credential is
  clean.
- Manual accessibility, business-logic abuse by multiple real roles, and a
  complete third-party cloud-configuration review are separate scopes.
