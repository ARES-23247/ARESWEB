# Post-deployment hardening audit

- Date: August 12, 2026
- Deployed baseline: `eb6a565bf73028ee91d386106b885699e30766b0`
- Audited branch: `codex/post-deploy-hardening`
- Scope: security, privacy, API correctness, accessibility, performance,
  crawler behavior, tests, CI, documentation, skills, and orphaned code
- Method: source/config/import tracing, an independent second pass, and the
  complete `AGENTS.md` gate on Node 22.22.2, pnpm 11.21.0, and Java 21.0.8

This report describes the hardening branch after the first audited release was
successfully deployed. It is evidence of the stated scope, not a claim that the
site is completely secure or WCAG conformant.

## Result

No confirmed critical or high-severity automated release blocker remains. The
fresh independent pass found four medium and two low issues that were corrected
before handoff. Two architectural items and manual accessibility verification
remain explicit follow-up work.

## Confirmed findings and disposition

| ID | Severity | Confirmed issue | Disposition and acceptance evidence |
| --- | --- | --- | --- |
| PH-01 | Medium privacy | Public calendar DTOs returned a legacy free-text `location`, bypassing the new venue-address opt-in. | Fixed in `functions/src/routes/calendarHelpers.ts`: public DTOs omit both legacy location fields; authenticated lifecycle DTOs retain them. Tests prove a private address is absent and only `publicVenue` with `isAddressPublic: 1` is exposed. |
| PH-02 | Medium availability/cost | Google Photos bulk import could download and transform up to 100 images without a cross-instance limit. | Fixed with the transactional `photo-import` quota after `ensureAdmin`, before the handler, plus a 20-second download timeout. Middleware-order and request-option tests cover the boundary. |
| PH-03 | Medium correctness | Two frontend copilots fabricated offline AI copy and grammar edits after upstream failure. | Fixed: drafts remain unchanged, AI output/edit state stays empty, and an explicit alert is shown. New component tests cover grammar and generation failures. Server Gemini helpers also validate model JSON and fail explicitly with generic 502 responses. |
| PH-04 | Medium resilience | Media work lacked explicit function-level memory, timeout, and concurrency bounds. | Fixed with 1 GiB memory, 300-second timeout, concurrency 10, max instances 10; endpoint metadata is regression-tested. Image decode is limited to 20 MP and 8 MB, imports process four at a time, outbound fetches time out, and writes settle before cleanup. Cross-service hard-kill orphan reconciliation remains an architectural follow-up. |
| PH-06 | Low SEO | Event `PostalAddress` used a generic `name` field. | Fixed to `streetAddress` with focused JSON-LD tests. Structured address components remain preferable future data modeling. |
| PH-07 | Low crawl | Indexable `/store` and `/leaderboard` pages were absent from the sitemap. | Fixed and asserted in sitemap tests. |
| DEBT-01 | Medium maintainability | An `untitled` simulator duplicated the Great Bee simulator; registry output embedded timestamps and drifted on every run. | Duplicate removed, Great Bee metadata corrected, registry generation made deterministic, and filesystem accessibility tests ignore non-simulator directories. |
| DOC-01 | Medium correctness | Retired Hono/Cloudflare/D1, social-manager, orchestration, and old audit documents contradicted the live Vite/Firebase application. | Obsolete documents removed; README, PROJECT, accessibility, PWA, conventions index, and audit protocol now describe the source-derived architecture. |
| CI-01 | Medium quality | Frontend lint tolerated 125 warnings and Functions lint still contained warnings. | Both lint commands now enforce zero warnings. Production and test code were typed or corrected without rule suppressions or lowered coverage. |
| PERF-01 | Medium efficiency/privacy | Gallery cards served full originals and new originals could retain camera metadata. | New ingestion stores metadata-stripped full, 480 px WebP thumbnail, and 1280 px WebP medium assets. DTOs support legacy fallback; the bounded dry-run-first backfill is deliberately separate from deployment. |
| A11Y-01 | High accessibility | Nested focus surfaces, mobile navigation, pointer-only simulations, and red-on-dark tokens had keyboard/focus/contrast defects. | Automated fixes and regression tests cover stacked focus traps, route focus, tabs, dialogs, keyboard alternatives, and token contrast. The dated manual checklist remains pending and therefore no WCAG-conformance claim is made. |
| SEC-01 | Medium defense in depth | An inline redirect required `script-src 'unsafe-inline'`; high-cost limits were process-local. | Redirect moved to the module entry, executable inline permission removed, CSP tightened, and cross-instance quotas added for AI, upload/import, Drive, and YouTube. |

## Verified strengths

- Public APIs use bounded explicit DTOs; public calendar, sitemap, gallery, and
  media paths do not return raw Firestore documents.
- Membership checks deny deleted, archived, unknown, missing, and unverified
  authorization records in API middleware and Firebase rules.
- Inquiry PII is encrypted before persistence and restricted to admin/coach.
- Image ingestion verifies MIME/magic/decoded format, strips metadata, creates
  bounded variants, cleans partial writes, and keeps Firestore metadata atomic.
- Transactional quotas store opaque HMAC identifiers rather than raw UIDs/IPs,
  fail closed on malformed state, and return `Retry-After` on HTTP 429.
- Production deployment remains keyless and gated by pinned Actions, Workload
  Identity Federation, rules tests, coverage, browser tests, and immutable build
  artifacts.
- PWA precache is 17 entries / about 935 KB, reduced from 162 entries / about
  5.19 MB in the earlier audit.

## Remaining accepted work

### Manual accessibility evidence

Complete `docs/audits/2026-08-12-manual-accessibility-checklist.md` with NVDA
and VoiceOver, 200%/400% reflow, forced colors, touch, and nested-dialog keyboard
checks. Until recorded, do not claim WCAG 2.2 AA conformance.

### Monolithic secret blast radius

The `/api/**` Express function still receives 12 secrets. No code-execution
defect was found, but a future compromise in one route would inherit the
process's full credential reach. The safe split criteria are recorded in
`docs/audits/2026-08-12-release-readiness.md`; a superficial export split would
not isolate modules or secret-dependent initialization.

### SSR and HTTP status architecture

The Vite SPA still emits final route metadata only after JavaScript and Hosting
rewrites unknown paths to the shell with HTTP 200. Genuine raw-HTML metadata and
404/410 responses require a reviewed SSR/prerender architecture, not a standalone
`404.html` or a duplicated manual route allowlist.

### Production operations after deployment

1. Enable Firestore TTL on `internal_api_quotas.expiresAt`.
2. Smoke-test one new image upload and verify sanitized full/thumbnail/medium
   objects plus card/lightbox fallback behavior.
3. Run the legacy derivative backfill only after separate production-write
   approval, following `docs/MEDIA_DERIVATIVE_BACKFILL.md` one bounded page at a
   time.
4. Monitor App Check, quota 429s, image failures, and generic upstream 502s.

## Skills decision

The previous reduction to six repository skills is appropriate. Each remaining
skill maps to a live protected boundary: API contracts, AST content migration,
CI/release gates, comprehensive auditing, accessibility/UI, and zero-trust
security. Further deletion would collapse materially different safety guidance.
All six now include validated `agents/openai.yaml` metadata, and obsolete GSD,
Cloudflare, and framework assumptions are absent. Future pruning should remain
evidence-based: remove a skill only when its protected boundary no longer exists
in live source/configuration.

## Verification record

The final record is updated only from completed commands:

- Frozen install: passed with pnpm 11.21.0
- Frontend and Functions ESLint: passed, zero warnings
- Frontend and Functions TypeScript: passed
- Frontend coverage: 71 files / 388 tests passed; 71.98% lines, 67.53% functions
- Functions coverage: 37 files / 495 tests passed; 93.78% lines, 98.63% functions
- Firebase Firestore/Storage rules: 17 passed on Java 21
- Production build and bundle budgets: passed
- Production dependency audit: no known vulnerabilities
- Playwright: 52 passed across Chromium, mobile Chromium, Firefox, and WebKit

The supported-runtime gate was repeated after the independent-audit corrections.
