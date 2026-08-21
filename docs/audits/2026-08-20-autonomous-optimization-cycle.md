# Autonomous optimization and operations cycle

**Date:** 2026-08-20

**Baseline:** `2058f0afd429787d1d03f0a8c977f511240b7c40` (`master`)

**Working branch:** `codex/autonomous-optimization-cycle-20260820`

**Starting state:** clean worktree

**Runtime:** Node 24.19.0, pnpm 11.21.0, Java 21

## Scope and safety boundary

This bounded cycle addressed the remaining editor-performance, mobile and
accessibility, legacy-photo, App Check, error-log, uptime, alerting, and billing
priorities. Cloud inspection was read-only. The photo derivative tool was run
without `--apply`. No secret, production record, Storage object, deployment,
alert policy, budget, or App Check mode was changed.

Manual NVDA, VoiceOver, forced-colors, zoom, and physical touch-device checks
cannot be performed truthfully by this automated environment. They remain
explicitly pending in
[`2026-08-12-manual-accessibility-checklist.md`](./2026-08-12-manual-accessibility-checklist.md).

## Changes and findings

### 1. Editor compiler and Monaco loading

- Replaced browser-side `@babel/standalone` with lazy-loaded Sucrase 3.35.1.
  The compiler still removes TypeScript/JSX and converts ESM imports to the
  CommonJS contract used by the opaque preview iframe. Tests execute compiled
  TSX and JavaScript inside a constrained `require/module/exports` wrapper and
  verify malformed source fails visibly.
- Consolidated the Monaco diff editor behind the same local-worker runtime as
  the normal editor. AI diff mode can no longer be the first path that bypasses
  worker configuration. Removed a redundant nested dynamic import while
  preserving the playground-level lazy boundary and Monaco loading skeleton.
- Fixed a browser runtime defect exposed by the new mobile check: the
  tree-shakeable Monaco API did not attach its TypeScript contribution to
  `monaco.languages`, so editor mount could throw while reading
  `javascriptDefaults`.
- Tightened the editor-runtime budget from 14.25 MB raw / 3.45 MB gzip to
  12.10 MB raw / 2.90 MB gzip.

Measured production bundle change:

| Metric | Before | After | Change |
| --- | ---: | ---: | ---: |
| Optional editor runtime, raw | 13,949,385 B | 11,848,540 B | -2,100,845 B (-15.1%) |
| Optional editor runtime, gzip | 3,308,728 B | 2,786,498 B | -522,230 B (-15.8%) |
| Compiler chunk, raw | 2,301,000 B Babel | 200,430 B Sucrase | about -91.3% |
| Compiler chunk, gzip | 574,000 B Babel | 45,630 B Sucrase | about -92.1% |
| Initial JavaScript, raw/gzip | 723,111 / 227,385 B | 723,111 / 227,375 B | effectively unchanged |

The 6.89 MB TypeScript worker remains the largest optional editor asset. It is
kept because it provides diagnostics and language services and is not part of
the initial route load.

### 2. Mobile and accessibility safeguards

- Simulation toolbar inputs and buttons now provide 44 by 44 CSS-pixel touch
  targets, and snapshot-history close now has an accessible name.
- Added a built-browser 320 CSS-pixel simulation-playground check for viewport
  containment, document reflow, accessible toolbar controls, and touch target
  size. Running it first exposed the Monaco defect above instead of masking the
  page error.
- The final browser matrix passed the new check in desktop Chromium, Firefox,
  and WebKit, Pixel 7 Chromium, and iPhone 15 WebKit.
- Updated the dated manual checklist with the automated evidence while keeping
  its manual status pending. No WCAG conformance claim is made.

### 3. Legacy photo derivative inspection

The documented production dry run used the exact project and bucket with no
write flag:

```text
node scripts/backfill-photo-derivatives.mjs --project aresfirst-portal --bucket aresfirst-portal.firebasestorage.app --limit 25
```

The first page scanned 10 records, found 0 eligible, updated 0, and failed 0.
The cursor follow-up scanned 0 additional records and returned `nextCursor:
null`. The current legacy set therefore needs no derivative write. New uploads
already generate optimized derivatives.

### 4. Production health and monitoring

- All 13 existing release health checks passed. Historical error logs showed
  eight HTTP 500 responses from `/api/tournaments/public/results` on
  2026-08-19. The live endpoint now returns HTTP 200, and no later severity
  `ERROR` entries were present in the audited 72-hour window.
- Added that endpoint to the release contract, producing 14 passing checks, so
  a recurrence blocks release rather than depending on a manual log review.
- Monitoring channel `ARESWEB operations alerts` is enabled for the approved
  `david.huss@gmail.com` recipient.
- Uptime check `ARESWEB canonical production` runs every 60 seconds against
  `aresfirst.org`. Policy `ARESWEB production availability and TLS` is enabled,
  has two conditions, and references the canonical channel.
- The last 1,000 uptime samples in the 24-hour query were passing, with zero
  failures.
- `$50 Monthly budget alert` (four thresholds) and `BigQuery` (three
  thresholds) both reference the canonical channel. Neither disables default
  Billing IAM recipients, so those default recipients remain active.

### 5. App Check evidence and limitation

The 72-hour redacted API observation set contained 55 mutation requests: 51
valid, 4 missing, and 0 invalid. The four missing requests were two analytics
posts, one inquiry post, and one GraphQL post. Matching request logs confirm all
four were rejected with HTTP 401; enforcement failed closed.

The raw verified percentage is 92.7%, below the documented 99% rollout target,
but every non-verified request was an enforced rejection rather than accepted
application traffic. Recent valid observations covered profiles, tasks, and
calendar. There was no recent Drive or media mutation traffic, so a future
authenticated production flow check is still required for those route groups.

The signed-in account could read Logging, Monitoring, and Billing but received
HTTP 403 from the Firebase App Check service-configuration API. This cycle does
not claim that Firestore, Storage, and Authentication console modes were
independently reverified. The API middleware's live enforcement was verified
through the redacted observations and matching HTTP 401 request logs.

## Verification

- frozen pnpm install: pass;
- runtime contract: pass on Node 24.19.0, pnpm 11.21.0, Java 21;
- shared agent configuration: pass;
- root and Functions lint: pass, zero warnings;
- root TypeScript and Functions build: pass;
- frontend coverage: 123 files / 678 tests, 79.91% lines, 74.96% functions;
- Functions coverage: 57 files / 717 tests, 95.38% lines, 97.91% functions;
- Firestore and Storage rules: 24 tests pass;
- production build and tightened bundle budget: pass;
- Playwright: 95 tests pass across all five configured browser/device projects;
- production dependency audit at high severity: no known vulnerabilities;
- live production contract: 14 checks pass.

## Remaining operator work

1. Complete and date the physical-device, NVDA, VoiceOver, forced-colors, and
   zoom checks in the manual accessibility checklist.
2. Exercise authenticated Drive and media mutations in production and confirm
   fresh `valid` App Check observations for both route groups.
3. Use an account with Firebase App Check configuration-read permission to
   confirm Firestore, Storage, and Authentication enforcement modes in the
   console/API. Do not change enforcement based only on this report.
4. Treat the TypeScript worker and formatting runtime as optional editor costs;
   continue reductions only when diagnostics and formatting behavior can be
   preserved with measured browser tests.
