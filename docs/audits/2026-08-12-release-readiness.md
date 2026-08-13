# Release Readiness Audit

- Date: August 12, 2026
- Auditor: Codex
- Scope: the consolidated audit-remediation branch across the frontend, API, Firebase rules, tests, CI, and docs
- Baseline: deployed `master` commit `430cb836`
- Result: ready for pull-request review and the protected production pipeline

This audit covers the current release branch. It does not prove that every old
file has no defect. No critical or high-risk release blocker remains open.

## Post-deployment crawl hardening

The follow-up `codex/post-deploy-hardening` branch adds crawl controls that fit
the existing Vite/Firebase architecture. These changes are source changes only
until they pass review and the protected deployment workflow:

- `/sitemap.xml` receives an exact Hosting `Cache-Control` rule after the broad
  app-shell rule. Firebase applies matching header definitions in declaration
  order, so the sitemap keeps the function's one-hour shared-cache policy while
  retaining the shared security headers.
- Sitemap collection reads use stable document-ID ordering, 250-document cursor
  pages, and a 5,000-document cap per collection. The five collection caps plus
  static entries remain below the sitemap protocol's 50,000-URL limit. A cap hit
  is logged for operator action instead of silently selecting an arbitrary first
  page.
- Saved venue addresses remain private by default. Admins, coaches, and mentors
  must explicitly enable **Publish this address**. Only then can the public event
  detail DTO return the venue name and full address. Event JSON-LD is emitted
  only for an outreach event with that public venue and represents the address
  as a `PostalAddress`; private/internal events receive ordinary page metadata,
  not ineligible Event rich-result markup.

This follows Firebase's documented dynamic-content caching and query-cursor
behavior and Google's requirement that physical Event markup contain a named
place and detailed postal address:

- <https://firebase.google.com/docs/hosting/manage-cache>
- <https://firebase.google.com/docs/hosting/full-config#headers>
- <https://firebase.google.com/docs/firestore/query-data/query-cursors>
- <https://developers.google.com/search/docs/appearance/structured-data/event>

### SSR, prerendering, and HTTP 404 decision

No crawler rendering migration is included in this hardening branch. The active
build has no server-render entry point or hydration boundary, and Firebase's
catch-all rewrite serves `index.html` before a custom Hosting 404 can run. A
static prerender also needs a reviewed build-time source for every published
Firestore route; introducing production database reads into CI would create a
new data-access boundary and could publish stale or non-approved records.

Consequently, adding a `404.html` alone would not fix unknown routes, and routing
only a manually duplicated allowlist of React paths would be brittle. Missing
dynamic records would still return the app shell with HTTP 200. The safe backlog
item is a deliberate architecture change: either a Vite SSR entry behind a
server runtime or a generated static-route manifest and prerender artifact.
Acceptance requires raw, JavaScript-disabled GET responses with final metadata
and primary content, HTTP 404/410 for unknown and missing records, hydration
without mismatch, no user-agent-specific rendering, and CI coverage for route
manifest drift.

## Distributed abuse controls and secret isolation

The process-local Express limits remain useful burst protection, but they no
longer provide the only allowance for the highest-cost authenticated work. A
Firestore transaction now enforces a shared fixed-window quota across Cloud
Functions instances for:

| Operation | Shared allowance | Expensive work protected |
| --- | --- | --- |
| AI grammar, assistant, and simulation generation combined | 30 per verified admin/coach per 15 minutes | Gemini/Vertex model calls |
| Unified photo upload | 30 per verified team member per 15 minutes | image decoding/derivatives, Storage, optional AI and Google upload |
| Google Photos bulk import | 4 per verified admin/coach per hour | up to 100 downloads, image transformations, Storage objects, and metadata writes per request |
| Google Drive folder sync | 10 per verified admin/coach per hour | Google API scan and Firestore batch |
| YouTube playlist sync | 6 per verified admin/coach per hour | up to 20 YouTube pages and Firestore batches |

Quota documents live in the server-only `internal_api_quotas` collection. Their
IDs are HMAC-derived from a domain-separated scope, the verified Firebase UID,
and the fixed window; neither a raw UID nor an IP address is stored. Each accepted
attempt is counted atomically before upstream work begins, malformed counters
fail closed, and a limit rejection returns HTTP 429
with `Retry-After`. Correctness does not depend on prompt deletion because each
window has a new document ID. Firestore TTL is enabled on
`internal_api_quotas.expiresAt` so expired operational records are removed; TTL
deletion delay does not grant extra requests. The production policy reached
`ACTIVE` on 2026-08-12 and was verified with `gcloud firestore fields ttls
list`.

The API remains one function and currently binds 12 secrets. The formerly bound
`GCP_PROJECT_ID` was removed because no runtime code reads it and Firebase already
supplies the project identity through `GCLOUD_PROJECT`. A low-risk function split
is not included: Hosting sends all `/api/**` traffic to `api`, Express owns route
dispatch, and `index.ts` validates `ENCRYPTION_SECRET` at module initialization.
Exporting a nominal no-secret sitemap function from the same module would still
load that secret-dependent module, while splitting route prefixes without shared
composition tests risks changing CORS, App Check, body limits, auth order, and
error handling.

The safe split acceptance criteria are:

1. extract reusable app construction with identical middleware-order tests;
2. define non-overlapping Hosting rewrites for public/core, media/AI, and external
   integration groups, with direct and Hosting-emulator path tests;
3. bind only the secrets proven by a source-derived route-to-secret inventory;
4. replace the quota HMAC dependency on `ENCRYPTION_SECRET` with a dedicated,
   least-privilege quota key before placing quotas in otherwise no-secret groups;
5. verify App Check exemptions, upload-before-parser authentication, CORS,
   generic 5xx handling, and scheduled exports for every resulting function;
6. canary the split with independent health checks and rollback-ready rewrites.

## Summary scorecard

| Pillar | Grade | Main result |
| --- | --- | --- |
| Security | A- | Webhooks, iframes, API routes, secrets, and deployment trust fail closed. |
| Privacy and youth protection | A | The email roster stays private, admin-only, bounded, and uncached. |
| Web accessibility | A- | Core flows pass four browser projects. Manual assistive-tech review remains useful. |
| Style and brand | A- | Changed UI uses the ARES system and keeps clear error states. |
| Code efficiency | B+ | Queries and roster reads are bounded. Large editor chunks remain lazy. |
| Refactoring | B | Several large screens still need smaller components. |
| Portability | A- | CI pins Node 22.13.1, pnpm 11.21.0, and Java 21. |
| Functionality | A | Public and admin failures stay visible and actionable. |
| Testing | A | All required local gates pass, including 52 browser tests. |
| Architecture | A- | Authorization and DTO boundaries stay on the server. |
| DevOps and hygiene | A | Keyless deployment and fail-closed build settings are in place. |
| Scalability and resilience | B+ | Work is bounded, but instance-local rate limits remain. |

Overall grade: **A-** within the documented automated scope. The branch still
requires the protected merge process and the manual accessibility checks linked
below; this grade is not a complete-security or WCAG-conformance claim.
App Check now fails closed by default for production browser mutations. Continue
reviewing observation metrics, and use `ENFORCE_APP_CHECK=false` only as a
time-limited incident override while a supported client path is repaired.

This is release-readiness evidence, not a claim of complete security or WCAG
conformance. Remaining architectural and manual-review items are listed below.

## 1. Security

### Strengths

- Firebase verifies identity and roles on the server.
- Firestore and Storage rules have emulator tests.
- The Zulip webhook checks its token before parsing the full payload.
- The webhook now validates sizes, fields, and current Zulip trigger names.
- The Google media proxy accepts IDs, not a client-provided URL.
- Google Drive requests use strict IDs and a fixed Google API origin.
- The static API reference iframe receives no sandbox capabilities.
- CI uses Workload Identity Federation instead of a stored cloud key.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| SEC-01 | Medium | The API reference iframe allowed same-origin scripts and forms. | Fixed |
| SEC-02 | Medium | The Zulip webhook accepted an unbounded body shape and missed `direct_message`. | Fixed |
| SEC-03 | Medium | App Check enforcement needs 72 hours of clean production data. | Operational watch |
| SEC-04 | Medium | The Hosting CSP still permits some inline content. | Backlog |
| SEC-05 | Critical | The Google media proxy URL depended on client input. | Fixed |
| SEC-06 | Critical | Google Drive metadata requests used loosely extracted client input in the request URL. | Fixed |
| SEC-07 | High | Drive buttons trusted URLs containing the Google hostname as a substring. | Fixed |

## 2. Privacy and youth protection

### Strengths

- Only admins can create an email roster.
- The endpoint excludes archived and unverified profiles.
- Student legal names do not appear in the export.
- The response now uses private, no-store browser headers.
- Logs record counts and filters, not email addresses.
- The page hides addresses until an admin copies or downloads them.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| PRIV-01 | Medium | Private roster responses did not set explicit no-store headers. | Fixed |

## 3. Web accessibility

### Strengths

- Forms expose labels and keyboard controls.
- Status and error messages use live regions.
- Navigation tests cover skip links and focus return.
- Browser tests cover desktop and mobile layouts.

### Findings

No release-blocking finding remains in the automated scope. Repository-wide
contrast review, stack-aware nested focus-trap migration, and a manual
keyboard/NVDA/VoiceOver/reflow pass remain required before any conformance claim.

## 4. Style and brand

### Strengths

- New controls use approved ARES color tokens.
- Private actions use clear warning text and user acknowledgment.
- Errors do not look like valid empty results.

### Findings

No release-blocking finding remains.

## 5. Code efficiency

### Strengths

- The roster query caps work at 500 records.
- Profile reads run in chunks of 25.
- Initial JavaScript is 220,875 gzip bytes.
- Initial CSS is 21,568 gzip bytes.
- Every measured bundle stays within its budget.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| EFF-01 | Medium | The roster could start up to 500 profile reads at once. | Fixed |
| EFF-02 | Low | Monaco is a 717,900-byte gzip lazy chunk. | Backlog |

## 6. Refactoring

### Strengths

- Shared API, error, auth, and data helpers reduce repeated code.
- Complex dashboard areas already use focused components and hooks.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| REF-01 | Low | Several page and modal files exceed 500 lines. | Backlog |

## 7. Code portability

### Strengths

- Local verification used Node 22.13.1 and Java 21.0.9.
- CI pins the same Node and pnpm release lines.
- Browser API routes use same-origin paths.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| PORT-01 | Low | Vite warns about ESM syntax in CommonJS config loading. | Backlog |

## 8. Functionality

### Strengths

- Google, Zulip, roster, and public data failures remain explicit.
- The roster supports Gmail and Outlook formats.
- Current Zulip direct messages can create task comments.
- PWA updates keep the user in control and avoid reload loops.

### Findings

No release-blocking finding remains.

## 9. Testing

### Strengths

- Frontend: 67 files and 372 tests passed with coverage.
- Cloud Functions: 35 files and 463 tests passed with coverage.
- Firebase rules: 17 emulator-backed tests passed.
- Playwright: all 52 scenarios passed across four browser projects after the route-status locator was made explicit.
- The Firefox roster test now waits for the API response, not a timing guess.

### Findings

No release-blocking finding remains.

## 10. Architecture

### Strengths

- Routes use shared auth, rate limits, validation, and error handling.
- Public APIs return narrow response objects.
- Private Firestore data stays behind server routes.
- User simulation code keeps an opaque iframe origin.

### Findings

No release-blocking finding remains.

## 11. DevOps and hygiene

### Strengths

- Pull requests receive no production cloud credential.
- Production deploys only from protected `master`.
- The release uses a tested, immutable build artifact.
- The build stops when either public browser security key is missing.
- Production dependencies have no known vulnerabilities.
- Retired MCP and Cloudflare-era code is no longer part of the release surface.
- Git whitespace checks pass.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| DEVOPS-01 | High | CI could build without the required browser security keys. | Fixed |
| DEVOPS-02 | High | Retired MCP and Cloudflare-era artifacts remained executable and outside current verification. | Fixed |

## 12. Scalability and resilience

### Strengths

- Queries, cleanup jobs, uploads, and roster work have limits.
- Hashed assets use immutable caching.
- HTML and sensitive roster responses avoid caching.
- The service worker has a tested recovery path.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| SCALE-01 | Medium | Express rate limits apply per Functions instance. | Fixed for the highest-cost authenticated routes with transactional shared quotas; lower-cost routes retain burst limits |

## Release roadmap

### Before merge

1. Push this branch and open a pull request.
2. Require CI and CodeQL to pass.
3. Merge through GitHub. Do not deploy an unreviewed local build.

### After deployment

1. Check the home page and public API health probes. Completed by the deployment
   workflow for commit `847070fe75fc78113aa4b8ec1db2e01a94d07d15`.
2. Test one Google photo flow and one YouTube sync.
3. Test one Zulip task comment and bot action.
4. Watch App Check results for at least 72 hours.
5. Confirm App Check remains enforced; use the documented explicit false override only during a time-limited incident.

The direct portal upload path was separately smoke-tested on 2026-08-12. A
synthetic 1600 by 900 JPEG produced a metadata-stripped full image, 1280 by 720
medium WebP, and 480 by 270 thumbnail WebP. The active card selected the
thumbnail, the details dialog selected the medium image, and the synthetic
record was archived afterward. This did not exercise the optional Google Photos
copy path, so item 2 remains open.

### Backlog

1. Tighten the Hosting CSP with hashes or nonces.
2. Split the largest page and modal components.
3. Reduce large editor chunks when the budget starts to tighten.
4. Run the separately approved, bounded legacy gallery derivative backfill in
   `docs/MEDIA_DERIVATIVE_BACKFILL.md`; new uploads already create derivatives.
5. Design and deliver the reviewed SSR/static-prerender migration described in
   the crawl-hardening decision above; client-side `noindex` is only an interim
   mitigation for the existing raw-HTML and HTTP-status limitation.
6. Split the monolithic Functions API when the acceptance criteria in the
   secret-isolation section can be delivered and canaried as one reviewed change.

## Verification record

- Frozen install: passed
- ESLint: passed
- TypeScript: passed
- Frontend coverage: 71 files / 388 tests passed (71.98% lines, 67.53% functions)
- Cloud Functions build: passed
- Cloud Functions coverage: 37 files / 495 tests passed (93.78% lines, 98.63% functions)
- Firebase rules tests: 17 passed
- Production frontend build: passed
- Bundle budgets: passed
- Playwright: 52 passed across Chromium, mobile Chromium, Firefox, and WebKit
- Production dependency audit: no known vulnerabilities
