# OWASP Top 10:2025 Route, API, Form, and Login Audit — 2026-08-24

## Executive result

No Critical or High-severity defect was confirmed in the audited scope. Two
Medium authorization defects and one Low local-secret hygiene gap were confirmed
and remediated in the local release candidate:

1. a Firebase-authenticated account without an active ARES authorization record
   could render the dashboard shell, even though APIs and Firestore still denied
   protected data;
2. two legacy owner-scoped Firestore paths accepted any Firebase-authenticated
   account instead of requiring an active ARES authorization record; and
3. Firebase's conventional local emulator secret file was not explicitly
   ignored by Git.

The release candidate now fails closed at the dashboard layout, restricts those
legacy rule paths to active ARES users, ignores emulator-only secret overrides,
and adds a TypeScript-AST CI invariant over every Cloud Functions mutation route.
The scanner found **97 mutation routes**: **92 require explicit Firebase role or
identity middleware** and **5 intentional exceptions have separate, asserted
controls**. The complete disposable attack suite passed **47/47**, and the
low-rate read-only production subset passed **23/23**.

This is a dated, evidence-bounded review against the current official
[OWASP Top 10:2025](https://owasp.org/Top10/2025/), not a claim that the site is
perfectly secure or a substitute for an independent penetration test.

## Scope and repository state

- Baseline commit: `87050968d4eca08f30b57914028d9bf4517c356c`
- Branch: `master`
- Baseline worktree: clean and synchronized with `origin/master`
- Audit date/time zone: 2026-08-24, America/New_York
- Runtime: Node `v24.19.0`, pnpm `11.21.0`, OpenJDK `21.0.12`
- Reviewed surfaces:
  - all React routes in `src/App.tsx`, including every nested `/dashboard` route;
  - all non-test Cloud Functions route modules under `functions/src/routes/`;
  - the five split API applications and their middleware ordering;
  - Google/Firebase login, authorization-record linking, role checks, and logout;
  - public join, sponsor, and outreach forms;
  - Firestore and Storage rules;
  - uploads, webhook integrations, outbound service clients, public DTOs,
    sanitization, error handling, logging, CSP/CORS, dependencies, and CI.
- Production probes were unauthenticated, low-rate, read-only, and
  non-destructive. Authenticated mutations, credential spraying, CAPTCHA
  bypass, load/DoS testing, and third-party service penetration were excluded.
- Full-strength attacks used disposable local Firebase Auth, Firestore, and
  Functions emulator identities. Local-only dummy secrets were deleted after
  the run and never represented production credentials.

## Route and trust-boundary result

### Browser routes and login

- `src/App.tsx:148` nests every administrative page below `DashboardLayout`.
- `src/app/dashboard/layout.tsx:188-223` now requires both a Firebase user and an
  active ARES authorization record before rendering dashboard children.
- The denied state exposes only sign-out and retry actions and explicitly does
  not render the sidebar or private child route.
- Server authorization remains authoritative: bearer tokens are verified in
  `functions/src/middleware/auth.ts:36-46`, and live `authorized_users/{uid}`
  records, archived state, and normalized roles are checked before protected
  route handlers (`functions/src/middleware/auth.ts:64-95`).
- Mock login remains limited to development/E2E mode; the production UI does
  not expose it.

### APIs and mutations

- `functions/src/apiApp.ts:35-76` disables `X-Powered-By`, applies an explicit
  CORS allowlist, a global API rate limit, App Check observation/enforcement,
  bounded parsers, authentication before large-body allocation, a clean 404,
  and the generic global error handler.
- `scripts/check-route-security.mjs` parses route modules with the TypeScript AST,
  recognizes direct and chained Express router declarations, rejects dynamic
  mutation paths, and fails CI when a mutation lacks an approved identity
  boundary.
- The five non-Firebase exceptions are exact allowlist entries, not broad
  filename exclusions:
  - App Check canary: global valid App Check token;
  - public inquiry submission: App Check, request/IP limits, schema validation,
    and encrypted storage;
  - profile synchronization: Secret Manager shared secret with timing-safe
    comparison;
  - Zulip webhook: Secret Manager token, strict schema, timing-safe comparison;
  - Onshape webhook: dedicated Secret Manager token, rate limit, strict schema,
    and timing-safe comparison.
- Public GET endpoints intentionally remain unauthenticated but return bounded,
  publication-aware DTOs. Administrative GETs require member/admin middleware.

### Forms, Firestore, and Storage

- Join, sponsor, and outreach submissions all reach `/api/inquiries`; App Check
  headers are now asserted in each form's tests. The server applies the same
  encryption, validation, and rate-limit boundary regardless of which form sent
  the request.
- `firestore.rules:325-330` and `:353-360` now require `isAuthorized()` for
  legacy owner-scoped chat/layout access. Direct profile documents remain
  server-only because they include encrypted youth and safety fields.
- `storage.rules:1-45` denies direct browser reads and writes for all known media
  namespaces. Public and authorized media are streamed through same-origin,
  publication-aware API gateways.

## OWASP Top 10:2025 mapping

| Category | Result | Evidence and conclusion |
| --- | --- | --- |
| **A01 Broken Access Control** | Remediated | Dashboard organization authorization and two legacy owner-scoped Firestore paths were too broad. Both now fail closed. Role escalation, IDOR, unauthenticated admin access, and Firestore rule probes passed. |
| **A02 Security Misconfiguration** | Pass after Low fix | Explicit CORS, CSP, frame denial, MIME sniffing prevention, bounded parsers, generic API 404s, least-secret split Functions, deny-by-default Storage rules, and no production mock auth. Added `functions/.secret.local` to `.gitignore`. |
| **A03 Software Supply Chain Failures** | Pass in scope | Frozen pnpm lockfile policy passed; production audit found no known High vulnerabilities; GitHub had zero open Dependabot, code-scanning, or secret-scanning alerts at audit time; CI actions and WIF deployment controls were reviewed. |
| **A04 Cryptographic Failures** | Pass in scope | Inquiry PII uses random salt/IV, PBKDF2-SHA-256, and AES-256-GCM (`functions/src/lib/crypto.ts:31-65`). Secrets are runtime Secret Manager bindings. Storage is not publicly readable. No tracked credential was found. |
| **A05 Injection** | Pass in scope | API inputs use schemas and bounded identifiers; public DTOs are explicit; user HTML is sanitized; Mermaid uses strict mode; simulation code runs in an opaque-origin sandbox; attack probes covered malformed JSON, traversal, prototype-shaped input, SVG/MIME confusion, and OG markup. |
| **A06 Insecure Design** | Pass after remediation | App Check supplements rather than replaces authorization; large uploads authenticate before parsing; quotas are distributed; private records use DTO APIs; service identities and secrets are split by function; failures stay explicit. The new route invariant prevents silent auth drift. |
| **A07 Authentication Failures** | Remediated | Firebase token verification was already sound, but the dashboard shell treated authentication as authorization. It now also requires the active ARES record. Unknown, malformed-token, Firebase-only, member, and admin identities were tested separately. |
| **A08 Software or Data Integrity Failures** | Pass in scope | Frozen dependencies, lockfile policy, protected WIF deploy workflow, strict schemas, authenticated webhooks, sanitized rich content, no `allow-same-origin` simulation sandbox, and CI security invariants reduce untrusted update/data paths. |
| **A09 Security Logging and Alerting Failures** | Pass with operational limitation | Shared loggers redact sensitive fields, API errors log route groups rather than raw IDs/query strings, App Check status is observed, audit records are server-written, and unexpected 5xx responses are generic. This audit did not independently exercise production paging/delivery for every alert. |
| **A10 Mishandling of Exceptional Conditions** | Pass in scope | Async handlers and the global error handler return bounded errors; malformed JSON, unavailable dependencies, invalid tokens, denied rules, failed App Check, and failed uploads are explicit and fail closed. Emulator and UI tests assert failure states rather than converting them to empty success. |

## Findings and remediation

### OWASP-01 — Dashboard shell accepted Firebase authentication without ARES authorization

- **Severity:** Medium
- **Confidence:** High
- **Category:** A01, A07
- **Evidence:** Before remediation, `src/app/dashboard/layout.tsx` gated children
  only on `user`; the authorization context already exposed `authorizedUser`.
  The nested route boundary is `src/App.tsx:148`.
- **Impact:** A signed-in Google/Firebase account not present in the active team
  authorization collection could render administrative navigation and child
  components. APIs and Firestore rules still denied protected records, so no
  protected-data disclosure was demonstrated, but the UI boundary was not
  fail-closed and could increase attack surface or leak feature metadata.
- **Remediation:** Require `authorizedUser` before any dashboard child/sidebar is
  rendered and expose only sign-out/retry controls on failure.
- **Acceptance test:** `src/test/DashboardMobileNavigation.test.tsx:50-77`
  supplies a Firebase-only identity and verifies the private child and sidebar
  do not render.
- **Status:** Fixed locally.

### OWASP-02 — Legacy owner-scoped Firestore paths allowed Firebase-only users

- **Severity:** Medium
- **Confidence:** High
- **Category:** A01, A06
- **Evidence:** `chat_sessions` and `user_profiles/{uid}/layouts` used
  `isAuthenticated()` plus ownership but did not require an active
  `authorized_users` record.
- **Impact:** Any Firebase-authenticated account could create/read its own legacy
  records, expanding persistence and billing/abuse surface outside team
  membership. No current production source reference to these legacy paths was
  found, which limits demonstrated impact.
- **Remediation:** Replace `isAuthenticated()` with `isAuthorized()` while
  retaining owner checks (`firestore.rules:325-330`, `:353-360`).
- **Acceptance test:** `tests/rules/security.rules.test.ts:468-502` denies a
  Firebase-only identity and allows an active member.
- **Status:** Fixed locally.

### OWASP-03 — Emulator local-secret file was not explicitly ignored

- **Severity:** Low
- **Confidence:** High
- **Category:** A02, A04
- **Evidence:** Firebase Functions recognizes `functions/.secret.local`, but the
  repository ignore list did not name it.
- **Impact:** A developer could accidentally stage an emulator override file
  containing sensitive values. No such tracked file or leaked secret was found.
- **Remediation:** Added `functions/.secret.local` to `.gitignore:36`.
- **Acceptance test:** `git check-ignore -v functions/.secret.local` resolves to
  the new ignore rule; the temporary audit file was deleted after the emulator
  run.
- **Status:** Fixed locally.

### OWASP-04 — Mutation authorization depended on review rather than a complete invariant

- **Severity:** Informational control gap
- **Confidence:** High
- **Category:** A01, A06, A08
- **Evidence:** Existing route tests were strong but there was no CI check that a
  newly added mutation registered an identity control or an exact approved
  exception.
- **Impact:** Future routes could regress silently if their feature tests mocked
  authorization or omitted an adversarial case.
- **Remediation:** Added `scripts/check-route-security.mjs`, package/CI wiring at
  `.github/workflows/ci.yml:54-56`, and the command to `AGENTS.md:53`.
- **Acceptance test:** Current scanner output is `97 mutation routes (92
  Firebase-authorized, 5 explicitly controlled exceptions)` and exits nonzero
  for an unknown unauthenticated mutation, dynamic route path, stale exception,
  or removed global App Check/rate-limit middleware.
- **Status:** Control added locally.

## Accepted residual risk

The previously documented Low Onshape constraint remains: its webhook shared
secret is carried in the callback URL query because the vendor does not provide
a signature header. The value is dedicated to that integration, compared with a
timing-safe helper, stored in Secret Manager, omitted from application logs, rate
limited, and followed by strict payload validation. Rotate it if any upstream
access log may retain query strings, and move to a signed header/body if Onshape
adds that capability.

## Verification evidence

Passed:

- `pnpm install --frozen-lockfile` — lockfile policy passed; already up to date.
- `pnpm run validate:agents` — 6 shared skills plus Gemini, Antigravity, and
  Copilot discovery validated.
- `pnpm run check:route-security` — 97/97 mutation routes classified.
- Root lint, Functions lint, TypeScript `--noEmit`, and Functions build.
- Frontend coverage — **137 files, 755 tests**; 81.66% lines, 77.02% functions.
- Functions coverage — **61 files, 759 tests**; 95.17% lines, 98.04% functions.
- Firestore/Storage emulator rules — **28/28**.
- Production build and 25-route prerender.
- Bundle budgets — all configured budgets passed.
- Playwright — **106/106** across Chromium, Firefox, WebKit, mobile Chromium,
  mobile WebKit, and PWA Chromium.
- `pnpm audit --prod --audit-level=high` — no known vulnerabilities.
- Safe production attack suite — **23/23**.
- Full disposable emulator plus production-safe attack suite — **47/47**.
- GitHub at audit time — zero open Dependabot, CodeQL/code-scanning, and
  secret-scanning alerts; latest baseline CI run succeeded.
- `git diff --check` — passed.

The first local attack attempt returned four fail-closed 503 responses because
the emulator lacked local-only secret values and therefore did not reach the
intended upload/admin branches. It was not counted as application acceptance.
The suite was rerun with ignored dummy values, reached the intended validation
paths, and passed 47/47. The dummy file was then deleted.

## Limitations and next actions

- The fixes in this report are local and uncommitted at report creation. They
  are not deployed until the owner separately authorizes push/merge/deploy.
- This review did not perform destructive production mutations, load/DoS tests,
  credential stuffing, social engineering, browser-extension compromise,
  cloud-IAM privilege escalation, or penetration of Google, Firebase, Zulip,
  GitHub, Buffer, Bluesky, Onshape, or other third parties.
- Production monitoring configuration was reviewed from repository evidence and
  prior operations records, but end-to-end paging for every alert channel was
  not triggered.
- Continue rotating the Onshape token on the documented schedule and review
  production App Check/authorization metrics after this release.
