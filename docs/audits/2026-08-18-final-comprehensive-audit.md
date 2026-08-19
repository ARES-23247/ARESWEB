# Final Comprehensive Audit — 2026-08-18

**Audited commit:** `a06bdb07` (master, synced with origin, clean worktree)
**Runtime at audit:** local Node 24.13.0 / CI Node 24.18.0 / production `nodejs24` runtime · pnpm 11.21.0 · deployed via CI at the same commit (Deploy Production green, 9 functions, 13 health checks)
**Method:** five staged read-only specialist scopes (backend security, frontend, SEO/performance/PWA, tests/CI/docs, feature gaps) reconciled by the lead, plus lead-run live production probes and independent re-verification of every High/P1 finding. One specialist reported a transient HEAD (`5ff3903f`) not present on master; all findings below were re-verified against `a06bdb07`. No files were modified and nothing was deployed as part of this audit.

**Live probe results (lead-executed):** security headers complete on canonical domain (CSP with no `unsafe-eval`, HSTS, nosniff, DENY, `strict-origin-when-cross-origin`) · genuine HTML/JSON 404s · unique prerendered titles across sampled routes · sitemap 80 URLs consistent with route inventory · RSS valid · OG endpoint 200 PNG · manifest complete for install · public APIs healthy. One probe found a live defect (S1 below).

---

## Executive summary

The site's core posture is strong: authorization, encryption, DTO discipline, deploy contract, CI least-privilege, and truthfulness controls all verified sound, and the operational feature set (kanban+Zulip, events, media pipeline, scouting, syndication) is unusually complete for an FTC team. This audit found **three findings that need action soon** — one HIGH security path (B1), one actively damaging SEO regression (S1), and one silently dead production feature (T1) — plus a tail of medium hardening items, documentation drift, and a clear set of missing features concentrated on the "money and credibility" surfaces (store, donations, finance write-path, awards admin, public results).

Counts: 3 High/P1 · 12 Medium · ~25 Low/Info confirmed defects · 18 risks needing reproduction or data checks · 6 high-value feature gaps.

---

## CONFIRMED DEFECTS — verified by lead

### B1. HIGH — Unverified-email takeover of pre-authorized roles via `POST /api/profiles/session`
- **Evidence:** `functions/src/routes/profileSync.ts` (legacy email-claim migration + `BOOTSTRAP_ADMIN_EMAIL` branch; lead-verified: `grep email_verified` over the file returns zero matches; contrast the correct guard in `functions/src/lib/linkAuthorizedUser.ts:20-22`).
- **Impact:** An attacker who registers a Firebase Auth account using an invited-but-unclaimed member/mentor email inherits that legacy `authorized_users` document's role without ever verifying the email. If `BOOTSTRAP_ADMIN_EMAIL` is set, this is full admin takeover.
- **Remediation:** Require `req.user.email_verified === true` before both the legacy lookup and the bootstrap branch.
- **Acceptance test:** Emulator test: token `{email: invited@team.org, email_verified: false}` + legacy role doc → 403, no write; same token with `email_verified: true` → migration succeeds.

### S1. P1 — Duplicate canonical tags on every prerendered shell; homepage canonical ships first
- **Evidence:** `index.html:7` bakes a root canonical; `scripts/prerender-static-routes.mjs:138-158` appends a second route canonical without removing the source one. Live-confirmed by lead: `/robotics-west-virginia` returns both, homepage first. Introduced by commit `d97ca8d8` (2026-08-16), after the soft-404 fix.
- **Impact:** Google may consolidate all 24 shells onto `/`, collapsing per-route indexing — directly harming the "WV robotics" ranking work.
- **Remediation:** Strip the source canonical in `renderStaticShell()` before injecting the route canonical; assert exactly one canonical per shell.
- **Acceptance test:** `grep -c 'rel="canonical"' dist/prerender/*.html` → 1 for all; live page shows a single self-canonical.

### T1. High — Google Analytics is dead in production: CSP blocks gtag
- **Evidence (lead-verified):** `src/App.tsx:102` mounts `AnalyticsTracker`; `.env.production:10` defines `G-0KKZT6G3TG`; live CSP `script-src` has no `googletagmanager.com` and `connect-src` no `google-analytics.com` (`firebase.json:47`).
- **Impact:** Zero GA data from production; the tracker and env var are dead weight; ops decisions are being made on absent telemetry.
- **Remediation:** Either extend the CSP (and the contract's health-header expectations) or remove the tracker and env var. Keep `hostingConfig.test.ts` in sync either way.
- **Acceptance test:** Production load emits no CSP violations for `googletagmanager.com`; a test asserts CSP and the GA loader stay in sync.

---

## CONFIRMED DEFECTS — Medium

| ID | Finding | Evidence | Remediation (acceptance test) |
|---|---|---|---|
| B2 | `taskDueDigest`: failed Zulip delivery returns "OK" (retry comment unimplemented), no `retryCount`, and the 400-doc query has no pagination — due tasks can be silently omitted | `functions/src/lib/taskDigest.ts:64-114`, `index.ts:153-175` | Throw on failed delivery, add `retryCount`, paginate by document id (failed delivery → retried execution; 500 seeded tasks all appear) |
| B3 | Firestore rules: `docs_feedback` create allows any *authenticated* (not authorized) user; `slug`/`createdAt` unbounded | `firestore.rules:394-405` | Switch to `isAuthorized()`, bound sizes (emulator test: unverified + archived users denied) |
| B4 | Zulip proxy: any member can read/post any stream/topic as the bot (no allowlist, no mention-stripping outbound) | `functions/src/routes/zulip.ts:167-242`, `routes/tasks.ts` | Allowlist streams, strip `@**…**` outbound (member request for `leadership` topic → 403) |
| S2 | All shells use the 37 KB favicon as `og:image`; no `twitter:image`/dimensions | `scripts/prerender-static-routes.mjs:9,154` | Route shell OG through `/api/og` or `social-post-default.jpg`; complete the twitter card block (Facebook debugger renders a branded card) |
| S3 | SW precache misses 4 entry-graph chunks (`preload-helper`, `logger`, `firebaseAppCheck`, `api`) → offline boot fails on SW-served routes | `vite.config.ts:53-62`, `dist/index.html:20-31`, `dist/sw.js` | Extend `globPatterns` (offline `/dashboard` boots from precache) |
| F1 | Auth failures (Google popup closed/network) are re-thrown into unhandled rejections at 7 call sites — no user feedback | `src/context/AuthContext.tsx:198,305` + call sites | Catch and surface `role="alert"` error state (blocked popup → inline error, no console rejection) |
| F2 | Icon-only attendance toggle has no accessible name/state | `src/components/events/EventRsvps.tsx:176-184` | `aria-label` + `aria-pressed` (screen reader announces purpose and state) |
| F3 | "WAVE AA Compliance 10.0" badge has no supporting evidence in repo/CI | `src/app/accessibility/page.tsx:60-68` | Wire a dated check or drop the numeric badge (claim matches evidence) |
| T2 | Security docs drift: "two" secret-authenticated endpoints (now three), secret counts ("six" vs seven), `taskDueDigest` missing from workload table, rotation list incomplete, phantom "drive quota secret" | `docs/API_AUTHENTICATION.md:39-42`, `docs/SECURITY_OPERATIONS.md:58-61,112-139`, `docs/SITE_OPERATIONS_CHECKLIST.md:92` vs `functionConfig.ts` + contract | Sync all inventories; add a test asserting docs match `FUNCTION_SECRET_BINDINGS` and the contract |
| T3 | `docs/conventions/02-api-reference.md` documents nonexistent routers (`blog.ts`, `events.ts`) and the wrong mounting point | `docs/conventions/02-api-reference.md:7,13-14` | Regenerate from `apps/*.ts` + `API_ROUTE_GROUPS` (each doc row matches a real file/mount) |
| T4 | `docs/conventions/09-ci-build.md`: npm/npx commands, incomplete gate list, wrong bundle-budget mechanism ("10% threshold") | `docs/conventions/09-ci-build.md:9-22,44-46` | Regenerate from `package.json` + `ci.yml` + `config/bundle-budgets.json` |
| T5 | Coverage floors (85/100) are opt-in lists — new files in `src/lib/**` / `functions/src/routes/**` get zero enforcement | `vite.config.ts:153-196`, `functions/vitest.config.mts:16-17` | Glob-based thresholds or a fail-when-unlisted test (untested new lib file fails CI) |

## CONFIRMED DEFECTS — Low / Info (abridged; full detail in specialist notes)

- **B5** Public `about-roster` query lacks `isDeleted` filter, no ordering, silent 100-cap, legacy avatar URLs pass read-side sanitization (`profileRoster.ts:62-113`).
- **B6** Sponsors/outreach admin writes: unvalidated doc ids (`a/b` nested-path risk), `http://` URLs, no length caps (`sponsors.ts:121-174`, `outreach.ts:120-182`).
- **B7** Simulations gist publish: unbounded name/files within 1 MB body published as a public team gist (`simulations.ts:200-239`).
- **B8** `web` function: no rate limit, uncached shell fetch per request (`web.ts:14-81`).
- **B9** Zulip webhook `commentsCount` increment has a check-then-act race (`webhooks.ts:275-295`).
- **B10** Logger allowlist misses `api_key`/`refreshtoken`-style keys (latent; no current call site logs them) (`logger.ts:15-19`).
- **B11** App Check staged-fallback branch in `inquiries.ts:69-75` is unreachable in prod — reconcile or delete.
- **B12** Publish/approval predicate inconsistent across feed/sitemap/rules vs syndication (`approvalStatus` missing from the first three).
- **B13** Webhook "Task card not found." reply discloses task existence to workspace users; return `""` instead (`webhooks.ts:252-262`).
- **B14** Policy: members can move photos into public albums without review (`photos.ts:300-348`) — document or gate.
- **B15** `robots.ts` DTO accepts any HTTPS `cadViewerUrl` while writes restrict to `cad.onshape.com` (legacy docs can iframe arbitrary hosts).
- **B16** Onshape webhook token rides in the URL query (Onshape has no signature headers) — accepted design with documented rotation; treat URL as secret-bearing, consider IP allowlisting if Onshape publishes ranges.
- **F4** Dashboard stat cards render `0` when counts fail (`dashboard/page.tsx:76-82,215-228`).
- **F5** Signups listener errors render as empty RSVP rosters (`events/[id]/page.tsx:141-154`, `useEventEditor.ts:210-225`).
- **F6** Task-overflow count failure converts to `0` (`dashboard/tasks/page.tsx:220-222`).
- **F7** Attendance toggle lacks in-flight guard (double-click double-write) (`events/[id]/page.tsx:278-289`).
- **F8** AuthContext 1.5s safety timeout flashes the sign-in gate on slow connections in production (`AuthContext.tsx:58-85`).
- **F9** `MOCK_TASKS` in production source file (e2e-gated) — move to test fixtures to match the anti-fabrication rule (`dashboard/tasks/page.tsx:26-64`).
- **S4** Deploy verifier has no canonical/meta assertions — the check that would have caught S1 (`verify-production-deployment.mjs`).
- **S5** No JSON-LD in prerendered shells; Helmet adds duplicate og/canonical after hydration.
- **S6** `/tournaments/**` lacks an X-Robots-Tag header (robots.txt + runtime noindex exist); `/__deployment-health` and `/prerender` not disallowed in robots.txt.
- **S7** PWA manifest lacks maskable icons/PNG sizes; Google Fonts CSS is render-blocking; no `srcset` anywhere; editor budget at 98.5% headroom.
- **T6** `profiles.test.ts` still imports phantom `createZulipUser` (removed feature).
- **T7** `photosUpload.ts:29` comment + `MEDIA_DERIVATIVE_BACKFILL.md` still describe the removed Google Photos upload sync.
- **T8** Unused production dependency `react-syntax-highlighter` + types.
- **T9** Dead exports `DEFAULT_coverImage` (points at nonexistent route) and `MOCK_LOCATIONS` in `src/utils/constants.ts`.
- **T10** Dependabot jsdom-ignore comment cites "pinned local Node 24.15"; `.nvmrc`/CI are both 24.18 — retry jsdom 30 or refresh the rationale.
- **T11** Uncovered branches: Zulip webhook missing-task + mention-only paths (`webhooks.ts:253-261`), taskDigest Zulip-rejected path (`taskDigest.ts:111`).
- **T12** `.env.example` missing five bound secret names; `test:rules:unit` script cannot run without emulators.
- **T13** e2e gaps: calendar, videos, robots, sponsors form, gallery, public events, outreach have no e2e; highest-value flows run on mocked auth/data (integration risk).
- **T14** `tournaments/page.tsx:74-89` computes `avgOpr` but never renders it (dead stat or unfinished card).

## RISKS NEEDING REPRODUCTION / DATA CHECKS

1. **Zulip bot subscriptions** define the real blast radius of B4 — enumerate streams the bot joins.
2. **Raw published docs via rules** (`posts`/`documents`/`seasons`/`awards`): verify no document contains internal uids/emails/PII in fields beyond the DTO set.
3. **`ENFORCE_APP_CHECK=false` must not be set** in production env (would silently drop inquiry protection to reCAPTCHA-only).
4. **taskDigest assignee identifiers**: confirm tasks store nicknames, not UIDs (else internal ids post to Zulip).
5. **Contrast**: ~160 usages of `text-marble`/`text-white` at opacity ≤ `/45`; computed ratios fail 4.5:1 at `/45` and below — needs rendered verification, then a lint floor at `/50`+.
6. **Trailing-slash 200s** (`/about/`) likely originate at the Cloudflare/Fastly fronting layer, not Hosting config.
7. **CodeQL**: docs require it pre-merge; no `codeql.yml` in-repo — confirm GitHub default setup is enabled (it ran on recent merges, suggesting yes).

---

## MISSING FEATURES (gap analysis)

**Present and strong:** roster/mentors/alumni profiles, blog with approval+syndication, calendar with recurrence/RSVP/iCal, gallery+videos, tiered sponsors + inquiry, join flow with auto account provisioning, Academy+ARESLib with mermaid/simulations/Zulip threads, outreach log + demo requests, public finance ledger, SEO landing pages, scouting vault, kanban+Zulip, Drive/Photos/YouTube/Onshape integrations — all verified wired end-to-end.

**High-value gaps (all CONFIRMED by code evidence):**
- **H1 Store has no commerce** — checkout hard-fails 503 by design; no catalog/payment (Effort M–L).
- **H2 Finance is read-only** — no dashboard CRUD, receipts, or budget rollups; bookkeeping is out-of-band (M).
- **H3 Awards & seasons have no admin UI** — client reads Firestore directly; updates require the console; will go stale (S–M).
- **H4 No donation path** — footer "Support ARES" routes to the sponsor form only (S — external payment link).
- **H5 No public competition results** — tournament data exists but is member-gated; no TOA/FIRST event integration (M–L).
- **H6 No general contact channel** — inquiries are typed-only; general/media traffic is mailto (S — machinery exists).

**Medium:** weekly-only recurrence; no site-wide search; no newsletter/email fallback (all notifications ride Zulip); leaderboard deliberately unranked (verified data exists to power it); no public engineering portfolio; no brand/press kit; alumni outcomes not aggregated; OpenAPI reference stubbed; Onshape registration is manual (documented); open-hardware hub is outbound-only after the fabrication cleanup.

**Deliberate empty states (not defects):** store checkout off, leaderboard unranked, Drive auto-publish 410 tombstone, Photos upload-sync removed — all correctly disclosed in the UI, consistent with the anti-fabrication policy.

---

## VERIFIED SOUND (coverage statement)

Authorization middleware chain, per-route role enforcement, per-function least-privilege service accounts, encryption-before-first-write for inquiry PII, fail-closed decryption, logger redaction across all call sites, webhook token handling (timing-safe, schema-bounded), SSRF controls (og/ai/photos/drive), rules server-only on all private collections, deploy contract + drift gate, WIF-only CI auth with SHA-pinned actions, immutable SHA-keyed artifacts, correct deploy ordering, sitemap/robots consistency, genuine 404 semantics, bundle budgets (55% initial-JS utilization), PWA update hygiene, truthfulness controls (fabricated-data grep clean; empty states honest), zero TODO/FIXME debt, `pnpm audit --prod` clean, engines coherent across local/CI/production.

## Recommended fix order

1. **B1** (verified-email guard) — small change, HIGH impact.
2. **S1** (canonical dedup) — small change, active ranking damage.
3. **T1** (GA: decide CSP vs removal) — restores or retires telemetry.
4. **B2/B3/B4** (digest retry, `docs_feedback` rule, Zulip allowlist).
5. **S2/S3** (OG images, SW precache) + **S4** (verifier meta assertions to prevent recurrence).
6. Docs sync pack (T2/T3/T4) + dead code pack (T6–T9).
7. Feature work by team priority from the gap list (H4 and H3 are the cheapest high-value wins).

*Findings requiring reproduction are marked as such and were not counted as confirmed defects. No claim of complete security or WCAG conformance is made; contrast and screen-reader items require rendered/manual verification per the evidence contract.*
