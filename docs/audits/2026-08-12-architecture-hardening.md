# Architecture Hardening Audit

- Date: August 12, 2026
- Auditor: Codex
- Baseline commit: `21a0c7510303977729605f18917a374816b5ae89`
- Branch: `codex/architecture-hardening`
- Scope: API process/secret isolation, public rendering and HTTP status behavior,
  Hosting CSP, service-worker navigation, editor bundles, deployment sequencing,
  focused tests, and related operations documentation
- Worktree: implementation changes present; no production deployment performed

## Outcome

No critical or high-severity defect remains in the audited change set. The
implementation is ready for pull-request review and the protected Node 22 / Java
21 CI gate. This is a scoped architecture result, not a claim that the complete
website is defect-free, completely secure, or WCAG conformant.

## Confirmed improvements

### API isolation

The former `api` process mounted every router and bound 12 secrets. Four
independently lazy-loaded route graphs now preserve the shared CORS, App Check,
rate-limit, parser, and error contract while limiting credentials:

| Function | Route domain | Secret count |
| --- | --- | ---: |
| `publicApi` | calendar, sponsors, outreach, tournaments, robots, store, finance, sitemap/reference | 0 |
| `coreApi` | inquiries and profiles | 3 |
| `mediaApi` | photos, AI, videos, and Drive | 6 |
| `communicationsApi` | tasks, webhooks, simulations, and Zulip | 4 |

The maximum per-process secret exposure falls from 12 to 6. Router modules are
loaded on first request to the owning function, so the split also avoids loading
the entire backend graph in each cold start. Tests protect route ownership,
secret counts, CORS, JSON 404 behavior, and upload authentication/quota/parser
order.

Production sequencing deploys the new functions first, switches Hosting second,
checks public health, and deletes the legacy function last. A failed health check
therefore does not silently delete the rollback process.

### Raw metadata and genuine status codes

Twenty-two known public paths receive build-time HTML shells containing a final
title, description, canonical URL, and social metadata. Public blog, Academy,
ARESLib, event, and robot detail routes use a no-secret Firestore-aware renderer.
The renderer checks published/non-deleted/indexable state and returns:

- 200 with escaped record metadata for visible content;
- 404 for invalid, missing, draft, deleted, or non-indexable records; and
- 503 for Firestore or shell-origin failures, avoiding false “not found” states.

The universal SPA rewrite is removed. Unknown routes use `404.html`, and the
service worker only falls back for explicit authenticated/noindex SPA areas, so
it cannot turn public-record 404 responses back into client-side soft 404s.
Hosting/Functions emulator evidence confirms an unknown route returns 404, a
known static route returns 200 with its prerendered title, and an unknown API
returns a bounded JSON 404.

This is metadata prerendering rather than full primary-content SSR. The React
application body still requires JavaScript; that limitation is explicitly
documented rather than represented as full SSR.

### CSP and editor cost

Executable policy remains free of `unsafe-inline` and `unsafe-eval` and now adds
`script-src-attr 'none'`, `frame-ancestors 'none'`, `worker-src`, `manifest-src`,
`media-src`, `upgrade-insecure-requests`, and `X-Frame-Options: DENY`. Inline
styles remain allowed for existing React/editor behavior; script execution did
not receive a compatibility exception.

Monaco now loads only the editor plus JavaScript/TypeScript languages and the
editor/TypeScript workers. The measured optional editor/compiler runtime falls
from the prior audit baseline of about 16.75 MB raw / 3.98 MB gzip to 14.84 MB /
3.52 MB. The largest individual editor asset is separately capped at 7.0 MB raw
/ 1.55 MB gzip, preventing a future aggregate budget from hiding worker growth.

## Residual risks and accepted follow-up

| ID | Severity | Confidence | Finding and impact | Remediation / acceptance |
| --- | --- | --- | --- | --- |
| ARCH-01 | Medium | High | Dynamic metadata rendering fetches the current static shell from the Firebase Hosting origin on each request. This adds one internal CDN request and makes shell-origin availability part of the render path, but avoids stale hashed assets across releases. | Monitor `web` latency and 503 counts. Only introduce caching after proving old hashed assets remain available across releases or bundling the verified shell atomically with the function. |
| ARCH-02 | Medium | High | The generated public shells contain final metadata but not server-rendered primary page content. No-script users and crawlers that require body content still see the React root until JavaScript runs. | Add full body SSR only if crawl/no-script evidence warrants the added server rendering and hydration boundary. Acceptance requires hydration parity, no user-agent branching, and public DTO-only data. |
| ARCH-03 | Low | High | CSP still permits inline style elements and attributes because current React/editor surfaces generate them. Script directives are strict, but style injection remains possible after an independent HTML injection defect. | Continue migrating stable inline styling to classes; remove each style exception only with production-browser tests for Monaco, Radix, simulations, and image cropping. |

The local runtime mismatch was resolved as a release concern by PR #38's
protected CI run: the Node 22.13.1 build, Java 21 Firebase rules emulator,
Playwright matrix, required test gate, and CodeQL analyses all passed. Production
deployment was correctly skipped because the branch was not `master`.

## Verification evidence

- frontend coverage: 71 files, 391 tests passed;
- Functions coverage: 41 files, 511 tests passed, 94.23% lines / 98.03%
  functions;
- Playwright: 52/52 passed across Chromium, mobile Chromium, Firefox, and WebKit;
- root and Functions ESLint: zero warnings;
- root and Functions TypeScript: passed;
- production dependency audit: no known vulnerabilities;
- Firebase Functions dry-run discovery: `web`, `publicApi`, `coreApi`,
  `mediaApi`, `communicationsApi`, and `cleanupOldInquiries` discovered;
- Hosting/Functions emulator route-status smoke test: passed;
- production build and prerender: 22 shells generated;
- bundle budgets: all passed, including 14.84 MB / 3.52 MB aggregate editor
  runtime and 6.89 MB / 1.48 MB largest editor worker;
- agent configuration validation: six canonical shared skills plus Gemini,
  Antigravity, and Copilot discovery passed;
- `git diff --check`: passed apart from Windows line-ending notices.
- protected PR CI on Node 22.13.1 / Java 21: passed, including the required test
  gate and CodeQL.

## Skill review

No additional pruning is justified by this architecture work. The six canonical
skills remain small and cover distinct live boundaries. Gemini and Antigravity
consume the same `.agents/skills/` source and validation is green; duplicating or
vendor-forking these instructions would increase drift rather than reduce it.
