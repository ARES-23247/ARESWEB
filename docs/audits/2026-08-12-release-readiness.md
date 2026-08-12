# Release Readiness Audit

- Date: August 12, 2026
- Auditor: Codex
- Scope: 263 changed files across the frontend, API, Firebase rules, tests, CI, and docs
- Baseline: deployed `master` commit `430cb836`
- Result: ready for pull-request review and the protected production pipeline

This audit covers the current release branch. It does not prove that every old
file has no defect. No critical or high-risk release blocker remains open.

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

Overall grade: **A-**. The branch is ready for the protected merge process.
App Check must remain in observation mode during the 72-hour review period.

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

No release-blocking finding remains. Canvas and editor flows still benefit from
periodic manual screen-reader and zoom checks.

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

- Frontend: 62 files and 357 tests passed.
- Cloud Functions: 37 files and 465 tests passed.
- Firebase rules: 15 tests passed.
- Playwright: 52 tests passed across four browser projects.
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
- CI audits and builds the standalone MCP server lockfile.
- Git whitespace checks pass.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| DEVOPS-01 | High | CI could build without the required browser security keys. | Fixed |
| DEVOPS-02 | High | The MCP server npm lockfile was outside the pnpm audit gate. | Fixed |

## 12. Scalability and resilience

### Strengths

- Queries, cleanup jobs, uploads, and roster work have limits.
- Hashed assets use immutable caching.
- HTML and sensitive roster responses avoid caching.
- The service worker has a tested recovery path.

### Findings

| ID | Severity | Finding | Status |
| --- | --- | --- | --- |
| SCALE-01 | Medium | Express rate limits apply per Functions instance. | Backlog |

## Release roadmap

### Before merge

1. Push this branch and open a pull request.
2. Require CI and CodeQL to pass.
3. Merge through GitHub. Do not deploy an unreviewed local build.

### After deployment

1. Check the home page and public API health probes.
2. Test one Google photo flow and one YouTube sync.
3. Test one Zulip task comment and bot action.
4. Watch App Check results for at least 72 hours.
5. Keep enforcement off until verified traffic reaches the required level.

### Backlog

1. Tighten the Hosting CSP with hashes or nonces.
2. Split the largest page and modal components.
3. Plan distributed quotas for expensive API routes.
4. Reduce large editor chunks when the budget starts to tighten.

## Verification record

- Frozen install: passed
- ESLint: passed
- TypeScript: passed
- Frontend coverage: passed
- Cloud Functions build: passed
- Cloud Functions coverage: passed
- Firebase rules tests: passed
- Production frontend build: passed
- Bundle budgets: passed
- Playwright: 52 passed
- Production dependency audit: no known vulnerabilities
- MCP server dependency audit: no known vulnerabilities
