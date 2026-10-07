# Fresh ARESWEB website audit — October 3, 2026

> Follow-up: all seven findings are remediated in source. See [the October 3 remediation record](2026-10-03-audit-remediation.md).

## Result

Seven confirmed findings: **three medium severity and four low severity**. No high-severity application defect was reproduced. All six findings from the [September 4 audit](2026-09-04-fresh-website-audit.md) are remediated in current source; A01 and A03 were also re-verified against the Firestore emulator.

Fix first: forgeable event revision history (B01), anonymous exhaustion of the shared game budget (B02), and the failing production dependency audit gate (B03). B03 blocks a release under the documented handoff gate.

This is a broad repository audit with targeted live checks. It is not a claim of complete security or WCAG conformance. No production data was read or changed, no forms were submitted, no authenticated production session was used, and nothing was deployed. Application source was left unchanged.

## Audited state and method

- Date: October 3, 2026, America/New_York.
- HEAD: `a49d1d975541a596ce4d550c7b382f7b79681cf4` on `codex/biobuzz-aim-lock-toggle`. The worktree was clean. HEAD is `origin/master` (`a7811f28`) plus one local commit that changes auto-toggle labels.
- Baseline: the previous audit commit `444959221b`. Since then, 490 files changed, including the Waggle Way community API, the BIOBUZZ Cloud Run simulator, BUZZHEX, Arcade routes, and game package extraction.
- Runtime: Node `24.18.0`, pnpm `11.21.0`, OpenJDK `21.0.12`.
- Evidence directory (ignored by Git): `scratch/audit-2026-10-03/`. It contains gate logs, `reproduce-rules.mjs`/`.log`, `reproduce-budget.cjs`/`.log`, `live-probe.log`, and `pnpm-audit.json`.
- Reviewed: Firestore rules end to end; API composition and App Check; auth middleware; distributed quotas; the Waggle Way router, domain, reads, and reports; the BIOBUZZ server, rooms, and admission app; content-visibility remediation; Hosting headers, rewrites, and sitemap; new route pages; navigation; workflow additions; and BIOBUZZ infrastructure contracts. Not every line under `packages/` was reviewed.
- Live checks: read-only `GET` requests to 13 public `https://aresfirst.org` paths, recording status, security headers, title, robots meta, and canonical. No `/api/waggle-way` or BIOBUZZ request was sent to production, so no shared quota was consumed.

## Confirmed findings

### B01 — Medium: Any active member can forge, rewrite, or delete event revision history

**Confidence:** high. Reproduced in the emulator.

**Evidence:** `firestore.rules:270–273` grants `allow write: if isAuthorized()` on `events/{eventId}/revisions/{revisionId}`. The parent event and its photos are API-only (`:256`, `:267`). Revisions are server-written with the full event payload and `editedBy` in `functions/src/routes/calendarManageRoutes.ts:68` and `:140`. The dashboard loads them as "Revision Audit History" (`src/app/dashboard/events/components/EventRevisionsTab.tsx:19`; `src/app/dashboard/events/hooks/useEventEditor.ts:266–289`). It offers a revert that copies a revision's title, dates, location, description, and cover image into the editor (`useEventEditor.ts:422–439`).

**Trigger and impact:** any member, including the student `member` role, can:

- create a revision with arbitrary content attributed to another user's UID;
- rewrite server-written entries;
- delete real history.

Revisions have no shape or size limits. An editor who trusts the history can revert to planted content and publish it with their own credentials. The audit trail can no longer show who changed an event.

**Reproduction:** `scratch/audit-2026-10-03/reproduce-rules.mjs`, run under `firebase emulators:exec --only firestore`. As a `member`, it created a forged revision (`editedBy: "audit-admin"`, 200 KB padding), updated a server revision, and deleted it. All three operations succeeded. The existing rules suite has no event-revision case.

**Remediation:** set revisions to `allow create, update, delete: if false` and keep them written by the Calendar API batch. If client reads remain, consider restricting them to the roles that can edit events. Treat `editedBy` as server-owned.

**Acceptance test:** emulator tests deny member, mentor, and admin client create/update/delete on event revisions while active members can still read them, if reads are kept. Calendar API tests still write one revision per create/update.

### B02 — Medium: Anonymous Waggle reads without App Check can exhaust the monthly budget shared by all online games

**Confidence:** high for configuration and arithmetic. Production traffic levels were not measured.

**Evidence:**

- Public `GET /gardens` and `GET /gardens/:id` charge `monthly(30)` against `GAME_MONTHLY_RESOURCE_SCOPE` (`functions/src/routes/waggleWay.ts:22–29`, `:59–63`, `:129–142`). The per-IP limit is 120/hour and the global limit is 10,000/day.
- That budget is 500,000 units per calendar month (`functions/src/lib/gameResourceBudget.ts:1`). BUZZLE and BUZZELLO match routes draw on the same budget (`functions/src/routes/buzzle.ts:70–86`; `functions/src/routes/buzzello.ts:91–118`).
- App Check covers only `POST/PUT/PATCH/DELETE` (`functions/src/middleware/appCheck.ts:7`, `:35–36`). These reads need no browser attestation.

**Trigger and impact:** `scratch/audit-2026-10-03/reproduce-budget.cjs` uses the compiled middleware and constants and shows:

- App Check is not required for either `GET`.
- 16,667 anonymous reads exhaust the month's budget.
- At the public-read global ceiling, reads consume 300,000 units/day (60% of the month), exhausting the budget in about 1.7 days.
- One scripted IP at its per-IP ceiling exhausts the budget in about 139 hours.

After exhaustion, BUZZLE and BUZZELLO online play and Waggle submissions and reviews fail with 429 until the next UTC month. The documented intent in `docs/waggle-way/COMMUNITY_PLAN.md:106–112` sets these weights, but nothing caps reads relative to the shared pool.

**Remediation:** remove anonymous reads from the shared game budget or give them a separate read budget. Alternatively, lower the read weight so that its global daily ceiling is a small fraction of the month. Consider cacheable public responses (`browse` is already a bounded, public DTO) and App Check on public read routes.

**Acceptance test:** a quota-configuration test asserts that public-read global daily ceiling × cost cannot exceed a documented fraction of `GAME_MONTHLY_RESOURCE_UNITS`. An HTTP test shows that exhausting the read budget does not return 429 on BUZZLE create or sync.

### B03 — Medium: The production dependency audit gate fails with eight high-severity advisories

**Confidence:** high (executed). Exploitability through ARESWEB code paths was not demonstrated.

**Evidence:** `pnpm audit --prod --audit-level=high` exited 1: 17 advisories (3 low, 6 moderate, 8 high). All are transitive:

- `@grpc/grpc-js` (GHSA-m9gg-hp2v-232j), through browser `firebase` and Functions `firebase-admin`
- `@fastify/busboy` (GHSA-xjh9-v7x6-24jw, GHSA-x8mw-p69m-v3mx), through `firebase-admin`
- `brace-expansion` (GHSA-qhr7-859c-m2p7, GHSA-6j4f-fj2g-mc7p), through the `google-gax` → `rimraf` chain
- `fast-uri` (GHSA-qw65-cvwx-89v3, GHSA-58mr-gqgx-xq4g), through `@google/genai` → MCP SDK → `ajv`
- moderate `ip-address` advisories, through `express-rate-limit`

The standalone Functions deployment lock (`functions/package-lock.json`, `npm audit --omit=dev`) independently reports 3 vulnerabilities (2 high).

**Impact:** the AGENTS.md handoff gate and CI fail, which blocks protected releases. Several packages run in the Functions/Cloud Run runtime that parses untrusted requests.

**Remediation:** update the parent packages, or add reviewed `pnpm.overrides` and npm `overrides` for the patched minimum versions. Regenerate both locks (`pnpm install`, `npm install --package-lock-only` in `functions/`). Rerun `validate:functions-deploy-lock`. Do not suppress advisories.

**Acceptance test:** `pnpm audit --prod --audit-level=high` and `npm audit --omit=dev --audit-level=high` (in `functions/`) both exit 0. The full gate passes.

### B04 — Low: One client can hold the only online BIOBUZZ room, and one IP can exhaust monthly admissions

**Confidence:** medium-high. This follows from source and configuration and was not exercised against production.

**Evidence:**

- Production admits one room globally on one instance (`infra/gcp/biobuzz-service.json:20`, `:27`).
- A private `create` takes that room, and a waiting room lives up to 180 seconds while a socket stays attached (`functions/src/lib/biobuzzRooms.ts:23–43`, `:113`). WebSocket admission checks only the `Origin` header, which non-browser clients control (`functions/src/biobuzzServer.ts:18`).
- Admission allows 60 requests/IP/hour against a 4,000/month project budget (`functions/src/apps/biobuzz.ts:10–13`).

**Trigger and impact:** a client with valid App Check tokens can re-create a private room about every three minutes. That is 20 requests/hour, within the per-IP limit, and keeps online BIOBUZZ unavailable to everyone. One IP at its limit exhausts the monthly admission budget in about 67 hours. Local practice, bots, and auto editing remain available. One room is a documented capacity decision (`docs/BIOBUZZ_SIMULATOR.md`), so the finding is the absence of fairness controls, not the room count.

**Remediation:** add a per-IP and per-App-Check-token cap on consecutive private-room creations and a shorter idle-lobby lifetime when only one seat is filled. Alternatively, prefer public matchmaking when capacity is one. Consider reserving part of the monthly admission budget per day.

**Acceptance test:** a room-service test shows that repeated `create` calls from one identity are rejected while another identity can still join the public queue. A quota test shows that one IP cannot consume more than the documented daily share.

### B05 — Low: Rules grant writes to collections with no live consumer

**Confidence:** high for rule behavior (reproduced). Medium for "no consumer": `git grep` found no references in `src/`, `functions/src/`, `packages/`, `scripts/`, or `tests/`.

**Evidence:**

- `team_layouts` gives any active member unvalidated read/write/delete (`firestore.rules:551–554`).
- `judge_access_codes` (`:529–533`), `orders` (`:523–527`), and `chat_sessions` (`:364–369`) are also declared without any consumer. `chat_sessions` appears only in the rules tests.
- Dynamic collection-name construction was not exhaustively excluded.

**Impact:** a member can store arbitrary data (500 KB in the reproduction) and delete other members' entries. This creates storage/cost abuse and a latent integrity problem if a feature later reuses the collection. Stale rules also widen the review surface.

**Remediation:** change unused collections to `allow read, write: if false`, or delete their rules so the default deny applies. Reintroduce rules only with a validated schema when a feature ships.

**Acceptance test:** emulator tests deny member writes to `team_layouts`, and the full rules suite still passes.

### B06 — Low: BIOBUZZ admission sends the Firebase ID token to a separate origin

**Confidence:** high (source).

**Evidence:** `src/lib/biobuzzOnline.ts:6` calls `authenticatedFetch` against `VITE_BIOBUZZ_ORIGIN` (the `*.run.app` service). `src/lib/api.ts:12–14` attaches `Authorization: Bearer <ID token>` to any URL. Admission is anonymous and never verifies the token (`functions/src/apps/biobuzz.ts`).

**Impact:** a bearer token valid for one hour against every ARES API reaches a service that does not need it. The service is first-party, so exposure is limited. Still, this violates least privilege, and `authenticatedFetch` has no origin allowlist to stop future cross-origin token leaks.

**Remediation:** send only the App Check header for BIOBUZZ admission. Make `authenticatedFetch` refuse to attach the ID token outside same-origin `/api/` URLs unless a destination is explicitly allowlisted.

**Acceptance test:** a unit test shows that BIOBUZZ `admit` sends no `Authorization` header but does send `X-Firebase-AppCheck`. `authenticatedFetch` drops the token for cross-origin URLs.

### B07 — Low: The sitemap omits seven indexable public routes

**Confidence:** high (source and live).

**Evidence:** `functions/src/routes/sitemap.ts:25–49` lists static URLs. The live sitemap (157 URLs) omits `/arcade`, `/buzzle`, `/buzzello`, `/buzzhex`, `/pollen`, `/buzzle/word-tools`, and `/biobuzz/simulator`. Each is prerendered, returns 200 live with a canonical URL, and has no `noindex`. `/waggle-way` and `/developer-api` are deliberately `noindex` and correctly absent.

**Impact:** search engines discover the Arcade only through links. Minor SEO loss.

**Remediation:** add the seven routes to `STATIC_URLS`. Consider deriving the list from the prerender route registry so new routes cannot drift.

**Acceptance test:** a sitemap test asserts that every prerendered route without `noindex` appears in the sitemap.

## Prior audit findings (September 4) — status

| ID | Status | Evidence |
| --- | --- | --- |
| A01 finance rules bypass | Fixed | `firestore.rules:518–521` denies all client access. The emulator reproduction denied a mentor read and delete. |
| A02 boolean-deleted content | Fixed | `functions/src/lib/contentVisibility.ts` is shared by content, feed, sitemap, photo, and web rendering. |
| A03 ownerless-draft claim | Fixed | `firestore.rules:231` requires that the content did not previously exist. The emulator reproduction denied the claim. |
| A04 partial robot updates | Fixed | `functions/src/routes/robots.ts:82–96` removes create defaults before `.partial()`. |
| A05 currency floating point | Fixed | `functions/src/routes/finance.ts:120–128` parses decimal text into integer cents. |
| A06 dropdown state | Fixed in source | `src/components/navigation/NavDropdown.tsx` uses a `hidden` attribute tied to `aria-expanded`, Escape with focus return, and close on blur. Not re-verified live. |

## Verification

| Check | Result |
| --- | --- |
| `pnpm install --frozen-lockfile` | Passed |
| `validate:agents`, `check:route-security`, `validate:functions-deploy-lock`, `test:release-tooling` | Passed |
| `lint`, `functions lint`, `typecheck` | Passed |
| `test:coverage -- --maxWorkers=4` | **Failed:** 1,996 / 2,001 passed. Five timeouts: BUZZHEX page ×3, BIOBUZZ worker, learning-migration CLI. All three files passed when rerun in isolation. |
| `functions build` | Passed |
| `functions test:coverage` | **Failed:** 1,028 / 1,029 passed. One timeout in the Waggle Way rate-limit chain. Passed when rerun alone, with and without coverage. |
| `test:rules` | Passed |
| `build`, `check-bundle-size` | Passed. Initial JS 235,835 B gzip, Academy interactive 92,003 / 95,000 B, largest editor chunk 6.91 / 7.0 MB raw (limited headroom). |
| `test:e2e -- --workers=3` | **Failed:** 643 / 648 passed. Failures: Firefox BIOBUZZ ×3, mobile WebKit Pollinator, WebKit BUZZHEX. All affected spec files passed with `--workers=1`. |
| `pnpm audit --prod --audit-level=high` | **Failed:** see B03 |
| New reproductions | B01 and B05 reproduced; A01 and A03 confirmed fixed (`reproduce-rules.log`). B02 arithmetic confirmed (`reproduce-budget.log`). |

All 12 timeout failures passed on focused reruns. They are recorded as intermittent behavior under parallel load, not product defects, and are not hidden. Repeated timeouts in BUZZHEX and BIOBUZZ suites under contention suggest those tests depend on wall-clock speed. Track them for reliability. The original full runs remain recorded as failed.

## Coverage, strengths, and limits

| Area | Evidence and conclusion |
| --- | --- |
| Live headers | All probed pages return HSTS (no `includeSubDomains`), `X-Frame-Options: DENY`, `nosniff`, strict referrer policy, a restrictive Permissions-Policy, and a 1.6 KB CSP. `/dashboard` sends `X-Robots-Tag: noindex`. The Pollinator frame is `SAMEORIGIN` with `connect-src 'none'`. Unknown routes return 404 with `noindex`. |
| Waggle Way community | Strong design: strict Zod DTOs, server-only verification proofs, consistent transaction reads, owner and moderator rechecks inside transactions, no PII in reports, bounded pages and cursors, and body parsing after auth and quotas. B02 concerns budget weighting only. |
| BIOBUZZ | Origin-checked sockets, hashed seat tokens with timing-safe comparison, input validation, token-bucket message limits, admission switch protected by a pinned deployer subject, and TTL on results. Rules deny client access to results and controls. See B04 and B06. |
| Authorization and privacy | Server middleware rechecks archived and role state. Public content uses DTOs. Inquiry and profile documents are denied to clients. Remaining direct-write paths are B01 and B05. Mentor/coach direct writes to robots, seasons, and awards bypass API validation, but public DTOs revalidate URLs (for example `functions/src/routes/robots.ts:133–150`). |
| Truthfulness | BIOBUZZ scoring cites an owner-supplied, hash-pinned Competition Manual V1 (`docs/BIOBUZZ_SIMULATOR.md:7`). Waggle cards avoid invented ratings. No fabricated sponsors, alumni, or parts were found on the reviewed paths. |
| Delivery | New workflows pin actions by SHA, use the production WIF provider, and are manual on `master`. Live GitHub protections, IAM, and Cloud Run state were not queried. |
| Not covered | Assistive-technology testing, contrast and zoom, Core Web Vitals, exhaustive `packages/` review, production prevalence of forged revisions, and live BIOBUZZ or Waggle behavior. |

## Reproduction

From the repository root, after `pnpm --filter functions build`:

```text
node scratch/audit-2026-10-03/reproduce-budget.cjs
pnpm exec firebase emulators:exec --project demo-aresweb-audit-1003 --only firestore "node scratch/audit-2026-10-03/reproduce-rules.mjs"
```

Both scripts use synthetic data only. Their passing assertions show the defective behavior; convert each acceptance test above into the maintained suites when fixing.
