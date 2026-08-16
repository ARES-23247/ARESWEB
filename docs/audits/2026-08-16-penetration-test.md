# Penetration Test — 2026-08-16

## Authorization and scope

- Explicitly authorized by the repository owner against their own production
  system (project `aresfirst-portal`, https://aresfirst.org).
- **Local scope (full strength):** auth bypass, privilege escalation, IDOR,
  injection, upload abuse, webhook forgery, rate-limit and CORS abuse, and
  error-hygiene attacks against emulated Cloud Functions, Firestore, Auth, and
  Storage (`firebase emulators:start`, test secrets bound in-process).
- **Production scope (safe subset):** unauthenticated, read-only, low-rate
  checks only — header/CORS posture, auth enforcement, public DTO field
  hygiene, injection-surface responses, error leakage, 404 behavior — against
  both `aresfirst.org` and the direct `*.run.app` function URLs. No load
  testing, no authenticated requests, no data mutation, no third-party systems.
- Audited commit: `6227c360` (plus the `Referrer-Policy` remediation described
  below), worktree clean at suite run time.

## Method

A reusable adversarial suite was written and committed at
`scripts/pentest/attack-suite.mjs` (run `node scripts/pentest/attack-suite.mjs
--target=local` with emulators up, or `--target=prod` for the safe subset).
Local identities (unknown sign-up, member, admin) were provisioned through the
Auth emulator and seeded into `authorized_users` via the Firestore emulator's
admin bypass. Final executed result: **46/47 local+production checks passed;
after remediation the production subset passes 23/23.**

## Findings

### P1. Missing `Referrer-Policy` header on production responses — Low / Confirmed, Remediated

- **Evidence:** response headers of `https://aresfirst.org/` contained CSP,
  `X-Frame-Options: DENY`, and `X-Content-Type-Options: nosniff`, but no
  `Referrer-Policy` (suite check "prod: Referrer-Policy header present").
- **Impact:** cross-origin navigations to third-party sites could leak full
  URLs (which contain query parameters) as referrers. No exploit path involving
  private data was identified; this is defense-in-depth.
- **Remediation (applied):** added
  `"Referrer-Policy: strict-origin-when-cross-origin"` to the hosting header
  block in `firebase.json` and deployed (`firebase deploy --only hosting`).
- **Acceptance test:** suite re-run passes "prod: Referrer-Policy header
  present"; `curl -I https://aresfirst.org` shows the header (verified).

### Observations (verified safe, no action required)

1. **Secret-dependent paths fail closed.** With `ENCRYPTION_SECRET` unbound
   (emulator), uploads return 503 `QUOTA_UNAVAILABLE` and inquiry reads return
   500 — never an authz bypass or silent data exposure.
2. **Emulator-only deviations are not production behavior.** The local
   functions framework echoes arbitrary CORS origins and renders body-parser
   errors as dev HTML — production (verified on both the site and direct
   `run.app` URLs) does neither.
3. **The Firestore emulator enforces rules on its REST API.** Seeding
   `authorized_users` was denied (`allow write: if false`) until the documented
   `Authorization: Bearer owner` admin bypass was used — rules are genuinely in
   the write path.
4. **Public finance API is intentional and DTO-bounded.** Unauthenticated
   `/api/finance` is the public transparency page's data source; the response
   is field-allow-listed (id/amount/type/category/date/description/seasonId)
   and carries none of the internal document fields (receipts, uploaders).
5. **Prototype-pollution payloads are contained.** `__proto__`/`constructor`
   bodies to `/api/inquiries` either store as inert encrypted data or fail
   closed; no authorization data was reachable in either project namespace.

## Attacks executed without success (local, authenticated where noted)

Forged/empty/misplaced bearer tokens; basic-auth confusion; signed-up-but-
unauthorized access; member→admin escalation on inquiries, status change,
user invite, and Zulip config; IDOR via admin profile view; simulation path
traversal (`github:../..`); gist ID format abuse; Zulip webhook forgery;
oversized inquiry metadata; magic-byte/mime-mismatched uploads; SVG-with-
script uploads; >8 MB uploads; unauthenticated uploads; inquiry rate-limit
evasion (429 fires); and stack-trace leakage probes.

## Non-claims

- This is automated adversarial testing by an AI agent, not a certified
  red-team engagement; it covers the executed scenarios only — no social
  engineering, no credential stuffing, no load/DoS testing, no client-side
  browser exploitation attempts.
- A passing suite is evidence for the tested scenarios on the tested date, not
  proof of immunity.
