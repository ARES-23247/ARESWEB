# ARESWEB Fresh Comprehensive Website Audit — 2026-11-20

## 1. Scope, Environment & Release Identity
- **Repository:** `ARES-23247/ARESWEB`
- **Audited Commit / Branch:** `99dac979127898b183f258b90dc9df16e5f0ab12` (`master` / `origin/master`, includes PR #348 Nov 17 audit remediation and PR #351 Zulip site announcements)
- **Initial Worktree State:** Clean (fetched `origin`; confirmed `codex/site-announcements-zulip` `0cc2a8b7` had zero diff against `origin/master` `99dac979` via PR #351 merge; fast-forwarded local `master` to `99dac979`)
- **Audit Date:** `2026-11-20`
- **Runtime Versions:** Node `v24.19.0`, pnpm `11.21.0`, OpenJDK `21.0.12`, Windows
- **Latest Production Release Verified on `master`:** CI run [`44228730670`](https://github.com/ARES-23247/ARESWEB/actions/runs/44228730670) (`success`), CodeQL runs `44228730531` & `44228730403` (`success`)

### Verification Ledger (Executed vs. Live vs. Static Inspection)

| Check / Surface | Type | Command or Method | Outcome & Exact Scope |
| --- | --- | --- | --- |
| Runtime & lockfile | Executed Gate | `pnpm install --frozen-lockfile`, `pnpm run validate:runtime` | **PASS** — Node `24.19.0`, pnpm `11.21.0`, Java `21`. |
| Repo, security & deploy contracts | Executed Gate | `validate:agents`, `check:route-security`, `validate:security-observability`, `validate:game-deployment`, `validate:functions-deploy-lock` | **PASS** — 6 skills validated; 134 mutation routes (117 Firebase-authorized, 17 controlled exceptions); 5 redacted log metrics; game Cloud Run `$35` contract valid; `functions` npm deploy lock synced. |
| Static analysis & release tooling | Executed Gate | `pnpm run lint`, `pnpm --filter functions lint`, `pnpm run typecheck`, `pnpm run test:release-tooling` | **PASS** — 0 ESLint warnings/errors, 0 TS errors; release tooling `26/26` tests (`97.5%` lines, `100%` functions). |
| Unit & coverage suites | Executed Gate | `pnpm run test:coverage --maxWorkers=4`, `pnpm --filter functions test:coverage` | **PASS** — Root `313/313` files, `2,125` tests (`92.02%` lines, `88.85%` funcs); Functions `89/89` files, `1,101` tests (`95.54%` lines, `98.29%` funcs). |
| Firebase emulators | Executed Gate | `pnpm run test:rules`, `pnpm run test:functions-emulator` | **PASS** — `41/41` Firestore/Storage rules tests; `12/12` Functions emulator tests (including `siteAnnouncementDelivery.emulator.test.ts`). |
| Build & bundle budgets | Executed Gate | `pnpm --filter functions build`, `pnpm run build`, `node scripts/check-bundle-size.mjs` | **PASS** — 37 prerendered public route shells; all 8 budgets pass (`academyInteractiveJs` at `91,956 / 95,000` gzip, `96.8%` — see `AUD-32`). |
| Academy provenance & release | Executed Gate | `pnpm run content:verify`, `pnpm run content:release-validate` | **PARTIAL FAIL** — Local release validation passed (`68` docs, `242` source refs, `3` guarded batches at `1df7d080`), but remote `content:verify` **FAILED** on Studio drift (`catalog declares 7.0.79, main declares 7.0.80` — see `AUD-29`). |
| Production dependency audit | Executed Gate | `pnpm audit --prod --audit-level=low`, `pnpm audit --prod --audit-level=high`, GitHub Dependabot alerts API | **PASS** — `0` vulnerabilities at both `low` and `high`; `0` open Dependabot security alerts. |
| Live production health & HTTP | Read-Only Live | `node scripts/check-production-health.mjs --deployment-id 99dac979...`, direct GET probes on `https://aresfirst.org` + BIOBUZZ `/health` | **PARTIAL** — `17/17` health checks passed; HSTS/CSP/XCTO/Referrer/Permissions headers intact; `/biobuzz` returns `301 -> /biobuzz/simulator`; `/waggle-way/community`, `/academy/playground`, `/tournaments` emit 1 raw canonical each; **FAILED probes:** `/types/areslib.d.ts` returns `404` (`AUD-05`); cold BIOBUZZ `/health` returned `200 { accepting: false }` before warming to `accepting: true` (`AUD-07`). |
| Live read-only browser sweep | Browser (`1440×900` & `320×640`) | Host-verified `browser` subagent (`https://aresfirst.org`, `blocked_origins: none`, 18 public routes, zero mutations) | **PARTIAL** — All 18 routes HTTP `200`, `1 <main>`, `1` settled canonical, `0` page-level overflow, mobile nav focus/Escape passed. **Failures observed:** `/academy/playground` `about:srcdoc` inline scripts blocked by CSP leaving preview frozen on `"Loading Environment..."` + `/types/areslib.d.ts` `404` (`AUD-05`), announcement banner overlapped navbar mid-transition on `/arcade` (`AUD-18`), `/sponsors` lazy image abort/blank fallback risk (`AUD-22`), mobile `320×640` banners covered `61%` (`73.5%` w/ navbar), `/blog` lists test post `"Ball Transfer"` (`"Test"`). |
| GCP / Firebase read-only ops | Read-Only Live | `gcloud functions list`, `gcloud run services list`, `gcloud secrets list`, `appcheck:storage-observe`, `inventory-media-references.mjs` | **PASS** — 13 Gen 2 Functions active (including `deliverSiteAnnouncement`) with `ares-fp` labels; 19 secret names present (no values read); Storage App Check ready (`168.0h`, `0` direct calls); media inventory `0` unresolved across `815` docs / `95` objects (`public-media/` = 1 object, `11,848` B). |
| Open Dependabot PR triage | Read-Only Live | `gh pr list --state open`, `gh run view --log-failed` | **7 open PRs triaged** — 4 green (`#344`–`#347`), 3 red (`#343`, `#349`, `#350`; see Section 2). |
| 4-domain codebase inspection | Static + Programmatic | 4 non-overlapping `research` subagents + lead verification across all 4 domain checklists | **36 deduplicated findings confirmed** (`0 P0`, `11 P1`, `21 P2`, `4` grouped `P3`). |

---

## 2. Open Dependabot PR Triage (`2026-11-20`)

| PR | Update | CI Status | Root Cause / Recommendation |
| --- | --- | --- | --- |
| `#344` | `vite-plugin-pwa` `1.3.0 -> 2.0.0` (major, dev) | **GREEN** (All checks pass) | Mergeable after manual PWA/SW smoke review (`e2e/pwa.spec.ts` already passed in CI). |
| `#345` | `framer-motion` `13.2.0 -> 14.14.0` (major, prod) | **GREEN** (All checks pass) | Mergeable; keep separate from audit PR due to major motion-runtime version jump. |
| `#346` | `firebase` `12.18.0 -> 12.19.0` (minor, prod) | **GREEN** (All checks pass) | Safe routine minor bump; ready to merge independently. |
| `#347` | `jsdom` `30.0.1 -> 31.0.1` (major, dev) | **GREEN** (All checks pass) | Safe dev-only test runtime bump; ready to merge independently. |
| `#343` | `@google/genai` `2.21.0 -> 3.3.0` (major, prod) | **RED** (`Verify, Test & Build`) | Failed `validate:functions-deploy-lock` (`npm ci`) because Dependabot updated `functions/package.json` + `pnpm-lock.yaml` without regenerating `functions/package-lock.json` (plus major SDK breaking-change review needed). |
| `#349` | `development-dependencies` group (4 updates) | **RED** (`Playwright E2E 1/2 & 2/2`) | Bumps `@playwright/test` without updating the pinned `mcr.microsoft.com/playwright` container image in `.github/workflows/ci.yml` (`chromium_headless_shell-1255` missing). |
| `#350` | `production-dependencies` group (7 updates) | **RED** (`Verify, Test & Build`) | Failed `validate:functions-deploy-lock` (`npm ci`) because `functions/package-lock.json` was not regenerated alongside `functions/package.json`. |

---

## 3. Summary of Site Findings

| ID | Severity | Status | Domain | Summary |
| --- | --- | --- | --- | --- |
| **AUD-01** | **P1 High** | Confirmed Defect | Security / Rules | `firestore.rules` `publishedSnapshot` bypass lets any `member` exfiltrate private photos (`mediaPhotoIds`), mutate live metadata, promote forged fields on `discard-pending`, and unpublish live `posts`/`docs`/`documents`. |
| **AUD-02** | **P1 High** | Confirmed Defect | Security / Backend | Single-pass Zulip mention regex bypass (`@**@**x**all**`, `@*group*`, `@_**...**`) + `member` write access to `#announcements` on `POST /api/zulip/message` and `POST /api/tasks/comment`. |
| **AUD-03** | **P1 High** | Confirmed Defect | Security / Backend | Unescaped Zulip Markdown & `@**all**` wildcard-mention injection in `sendZulipApprovalQueueNotification` (`POST /api/content-admin/notify-pending`). |
| **AUD-04** | **P1 High** | Confirmed Defect | Security / Backend | `routes/videos.ts` calls `syndicatePublishedVideo()` inside `mediaApi`, which lacks Zulip/Bluesky secret bindings, permanently stamping `syndicatedAt` on silent failure. |
| **AUD-05** | **P1 High** | Confirmed Defect | Simulations / Live | Production CSP blocks both inline `<script>` blocks inside `SimPreviewFrame.tsx` `about:srcdoc`, freezing `/academy/playground` & `/dashboard/simulations` on `"Loading Environment..."`; `/types/areslib.d.ts` returns `404`. |
| **AUD-06** | **P1 High** | Confirmed Defect | Simulations / Security | Unvalidated cross-origin `postMessage` listener in `useSimulationTelemetry.ts` bypasses `SimPreviewFrame.tsx` origin/source/schema validation (React crash & unvalidated `imageUrl` forwarded to `/api/ai/sim-playground`). |
| **AUD-07** | **P1 High** | Confirmed Defect | Cloud Run / Live | BIOBUZZ cold-start `/health` & admission race (`rooms.drain()` + unawaited `readControl()` vs `server.listen()` and single-shot `--verify-live`), reproduced live (`accepting: false` -> `true`). |
| **AUD-08** | **P1 High** | Confirmed Defect | Public UX / A11y | Tailwind v4 `@layer components` vs `@layer utilities` breaks `.hover:bg-ares-bronze:hover` dark-text override across 25 public CTAs + `<Button variant="primary">` (`3.14:1` contrast fail). |
| **AUD-09** | **P1 High** | Confirmed Defect | Portal / Offline | Direct online saves in `TournamentPitCommand` and `TournamentScoutingHub` do not clear stale queued outbox entries (`pit_state`, `pit_scouting`), overwriting newer server data on flush. |
| **AUD-10** | **P1 High** | Confirmed Defect | Portal / Offline | `TournamentPitCommand` never hydrates pending offline `pit_state` on mount/reload and unconditionally overwrites local edits with server `pitState`. |
| **AUD-11** | **P1 High** | Confirmed Defect | Portal / Offline | `isPermanentOutboxError` treats HTTP `401 Unauthorized` as permanent and silently drops queued offline scouting reports after token expiry (>1h offline). |
| **AUD-12** | **P2 Medium** | Confirmed Defect | Backend / SSR | `functions/src/web.ts` hangs 20s on every `429` rate-limited request (concurrency-exhaustion DoS) and lacks `trust proxy: 1` (`X-Forwarded-For` bypass). |
| **AUD-13** | **P2 Medium** | Confirmed Defect | Backend / Portal | PR #351 site announcements: `deliverSiteAnnouncement` retries infinitely on persistent Zulip failure & re-pings `@**all**` on schedule-only edits; `/dashboard/announcements` misreports scheduled/expired state, omits delivery status & re-ping warning, and prematurely disables Remove. |
| **AUD-14** | **P2 Medium** | Confirmed Defect | Backend / API | `GET /api/photos/public` lacks bounded batch scanning over soft-deleted photos and can stall with `{ photos: [], hasMore: true, nextCursor: null }`. |
| **AUD-15** | **P2 Medium** | Confirmed Defect | Security / Privacy | `profileRoster.ts` omits `authData?.email` from `sanitizeAvatarUrl` on `/about-roster` and `/team-roster`, allowing email-seeded DiceBear URLs to leak member emails. |
| **AUD-16** | **P2 Medium** | Confirmed Defect | Public UX / A11y | Global cyan `*:focus-visible` (`#00E5FF`) and `SiteAnnouncementBanner` `focus-visible:ring-white` fail `3.0:1` non-text contrast on light (`marble`/`white`) and gold (`#FFB81C`) surfaces (`1.13:1`–`1.73:1`). |
| **AUD-17** | **P2 Medium** | Confirmed Defect | Public UX / A11y | Additional WCAG AA contrast failures: `/seasons:537` same-element `bg-white text-ares-red` (`2.78:1`), Footer/Blog hover icons (`1.54:1`–`2.6:1`), `OfflineIndicator` (`2.81:1`), `/tournaments` dark-red gradient (`2.35:1`), and sub-`4.5:1` muted text. |
| **AUD-18** | **P2 Medium** | Confirmed Defect | Public UX / Layout | `CommandPalette` trapped inside `Navbar` `z-50` stacking context; public modals sit under `SiteAnnouncementBanner` (`z-[70]`) and desktop `AnalyticsConsentBanner` (`z-[100]`); `OfflineIndicator` `z-50` collision; `Navbar` `transition-all duration-500` overlaps banner mid-slide on load. |
| **AUD-19** | **P2 Medium** | Confirmed Defect | Public UX / A11y | Keyboard/AT defects: `CommandPalette` missing `combobox`/`aria-activedescendant`, `EventGallery` sibling `.sr-only` input breaking `focus-within:`, `AcademySearchModal` missing Close button, `ErrorBoundary` using `<h2>` + missing `type="button"`. |
| **AUD-20** | **P2 Medium** | Confirmed Defect | Public UX / SEO | `/events/:id` passes raw serialized Tiptap JSON into `<SEO description>` and `Event` JSON-LD after client hydration. |
| **AUD-21** | **P2 Medium** | Confirmed Defect | Public UX / Truth | `/terms:85` falsely claims on-site Stripe payments, `/terms:112` fabricates today's date as legal revision date, and `/location-morgantown:220` states `Grades 7-12` instead of `/join`'s `6-12`. |
| **AUD-22** | **P2 Medium** | Confirmed Defect | Public UX / Print | `@media print` `visibility: hidden` + `inset: 0` inflates pagination & stretches/clips `/sponsors` and `/robots/:id` print sheets (`PwaUpdatePrompt` missing `print:hidden`); `SponsorsPage` imperative `onError` DOM mutation + unmeasured `loading="lazy"` risks blank partner cards on re-render. |
| **AUD-23** | **P2 Medium** | Confirmed Defect | Public UX / Motion | Calm UI & reduced-motion violations: `EventHero` `animate-pulse`, `DesktopUserMenu` & `VideoPickerModal` `animate-ping`, `AvatarEditor` unwrapped `framer-motion`, `AutonomousLogicDiagram` unconditional animated edges & missing label. |
| **AUD-24** | **P2 Medium** | Confirmed Defect | Portal / Offline | Cross-component outbox desynchronization & bypassed React Query cache between `TournamentPitCommand` and `TournamentScoutingHub`. |
| **AUD-25** | **P2 Medium** | Confirmed Defect | Portal / RBAC | `unverified` users see member sidebar links and `"Read tasks & documents: Granted"`, causing cascading `403` / `permission-denied` failures across `/dashboard/*`. |
| **AUD-26** | **P2 Medium** | Confirmed Defect | Portal / RBAC | Photo Manager UI exposes public albums and edit controls to `member`/`unverified` roles blocked by backend authorization. |
| **AUD-27** | **P2 Medium** | Confirmed Defect | Portal / Security | Incomplete CSV formula-injection escaping in `emailRoster.ts` and `inquiries/page.tsx` (leading whitespace/newline bypass); Portfolio CSV exports unverified raw `linkedArtifactIds.length` and evidence pickers hold stale hidden selections after filter change. |
| **AUD-28** | **P2 Medium** | Confirmed Defect | Portal / Showcase | Blog Share Kit 1080×1080 Canvas wraps by fixed character count (overflowing wide headlines & colliding long bylines with CTA pill); unguarded `encodeQrMatrix` on `/robots/:id` crashes render for valid robot IDs > 49 UTF-8 bytes. |
| **AUD-29** | **P2 Medium** | Confirmed Defect | Academy / Provenance | Upstream ARES Studio version drift (`7.0.79 -> 7.0.80`, failing `content:verify`) plus 4 stale `catalog.json` `appliesToVersion` entries (`FTC SDK 11.1.0`, `ARES-FRC 12.0.0`, `f3de343a`) & `LearningMetadataFields.tsx:81` (`Studio 7.0.75`) missed by validator. |
| **AUD-30** | **P2 Medium** | Confirmed Defect | Cloud Run / DoS | Unauthenticated BIOBUZZ WebSocket `/play` upgrades lack per-IP and unbound-handshake caps, allowing full saturation of the single Cloud Run instance (`concurrency: 128`). |
| **AUD-31** | **P2 Medium** | Confirmed Defect | Selective CI | `infra/verification-areas.json` misses transitive cross-area backend edges (`socialSyndication`/`bluesky`/`zulip`, `calendarHelpers`) and drops 12 unit tests on Linux due to case-sensitive globs. |
| **AUD-32** | **P2 Medium** | Confirmed Defect | Build / Budgets | Tight bundle headroom on `academyInteractiveJs` gzip (`91,956 / 95,000` bytes, `96.8%` used, `3,044 B` margin). |
| **AUD-33** | **P3 Low** | Confirmed Defect | Backend Hardening | Missing `Cache-Control: private, no-store` on PII `GET` routes (`inquiries`, `profileSelf`, `profileAdmin`); unsanitized `item.filename` & missing `redirect: "error"` in `photosImport.ts`; missing per-user quota/audit on `/api/simulations/gist`, outbound `fetch` timeouts, and pre-auth validation/hashing in `profileSync.ts` & `studioIntegrations.ts`. |
| **AUD-34** | **P3 Low** | Confirmed Defect | SEO / Portal | Residual `<SEO>` SPA state edges (`/academy/:bad-slug`, `/dashboard/*`, and `/dashboard/tournaments` missing `noindex`, `<h1>`, and accurate `mentor` copy). |
| **AUD-35** | **P3 Low** | Confirmed Defect | A11y / UX Polish | Heading-level skips (`/blog`, `/robots/:id`, `/sponsors`, `Footer`), off-brand Mermaid hexes, missing spinner `role="status"`, missing `role="group"`/`type="button"`, `BlogShareKitModal` `tabIndex={-1}`/clipboard error feedback, and `VideosManagementPage` hiding restored videos. |
| **AUD-36** | **P3 Low** | Confirmed Defect | Maintenance / Orphans | Duplicate `MotorIO.kt` in `robotics-curriculum-plan.json:85-86`, unbacked `"verified"` page toggle in Portfolio, `gamePackageBoundaries.test.ts` omitting `biobuzz`/dynamic `import()`/Firebase ban, BIOBUZZ finished-room 30s eviction delay under `maxRooms: 1`, tracked orphan `.tanstack/tmp/17d57fe7-...` (53 KiB), and 7 dead `vite.config.ts` coverage paths. |

*Severity scale:* **P0 Critical** (active compromise, data breach, or outage), **P1 High** (auth/PII boundary flaw, broken core flow, or major data loss), **P2 Medium** (bounded security hardening gap, role UI mismatch, a11y/SEO/CI bug), **P3 Low** (technical debt, orphan, test gap, minor UX/perf polish).

---

## 4. Detailed Findings

### AUD-01 — `firestore.rules` `publishedSnapshot` Bypass (Private-Photo Exfiltration, Live Defacement, `discard-pending` Promotion & Unpublishing)
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `firestore.rules:52-76,105-116,160-174,191-198`; `functions/src/lib/contentVisibility.ts:12-29`; `functions/src/routes/photos.ts:119-126,293-322`; `functions/src/routes/contentApproval.ts:269-277`.
- **Affected Behavior / Trigger:**
  1. `hasValidPublishedSnapshotOnPendingUpdate()` checks only 11 fields and never bounds `publishedSnapshot.keys()`. Because `resolvePublishedContentData()` merges `{ ...data, ...snapshotFields }`, a `member` staging an edit on a published `post`/`doc`/`document` can mutate unverified fields like `mediaPhotoIds` (exposing any private `imported_photos` record via unauthenticated `GET /api/photos/public/content/...`), `snippet`, `thumbnail`, `authorAvatar`, `date`, or `description`/`displayInAreslib`.
  2. `POST /api/content-admin/discard-pending` spreads `...restoredFields` from `data.publishedSnapshot` directly onto the approved document (`contentApproval.ts:269-277`), promoting any extra keys a `member` planted inside `publishedSnapshot`.
  3. `isSafeMemberPendingUpdateFields` (`firestore.rules:107`) and `canUpdatePendingDoc` (`:193`) permit `(isPendingContent(data) && !('publishedSnapshot' in data))` even when `resource.data.status == 'published'`, allowing any `member` to unpublish live content directly via Firestore.
- **Impact:** Private team photo exfiltration, unreviewed defacement of live public pages/RSS/OG cards, forged field promotion on discard, and unauthorized unpublishing of live site content.
- **Remediation:** Delegate `firestore.rules` hardening to `firestore-rules-author`: restrict the non-snapshot pending branch to `resource.data.status != 'published'`, lock `publishedSnapshot.keys().hasOnly(...)` and verify equality against `resource.data` for every public/media/learning field (`mediaPhotoIds`, `snippet`, `thumbnail`, `authorAvatar`, `date`, `description`, `sortOrder`, `displayIn*`, `sourceReferences`, `objectives`, `topics`, `reviewedByLabel`, `searchIndexable`, `isPortfolio`, `isExecutiveSummary`, `original_author*`), and replace `...restoredFields` in `contentApproval.ts:269-277` with an explicit allowlisted extractor.
- **Acceptance Test:** Emulator tests in `tests/rules/security.rules.test.ts` denying member unpublish of published content, member mutation of `mediaPhotoIds`/`snippet`/`description` without snapshot match, and extra keys in `publishedSnapshot`; unit test in `contentApproval.test.ts` verifying `discard-pending` strips non-allowlisted snapshot keys.

### AUD-02 — Single-Pass Zulip Mention Regex Bypass & `member` Write Access to `#announcements`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `functions/src/routes/zulip.ts:169-178,243-274`; `functions/src/routes/tasks.ts:48-66`; `functions/src/routes/webhooks.ts:286`.
- **Affected Behavior / Trigger:** `content.replace(/@\*\*[^*]+\*\*/g, "").replace(/@all|@everyone/gi, "")` is single-pass, so nested input `@**@**x**all**` reconstructs `@**all**` (and `@*group*` / `@_**...**` bypass entirely). Furthermore, `POST /api/zulip/message` only checks `ensureTeamMember`, permits `stream: "announcements"`, and posts unattributed under the bot identity.
- **Impact:** Any `member` can broadcast `@**all**` pings and spoof official announcements or phishing links in `#announcements` and `#kanban` as the workspace bot.
- **Remediation:** Require `ensureAdmin` to post to `"announcements"` via `POST /api/zulip/message` (keeping read access if needed), attribute caller nickname on member proxy posts, and neutralize every `@` via unconditional `.replace(/@/gu, "@\u200B")` (or shared `sanitizeZulipInlineText` / `escapeZulipMarkdown`) in `zulip.ts`, `tasks.ts`, and `webhooks.ts`.
- **Acceptance Test:** Unit tests in `zulip.test.ts` and `tasks.test.ts` verifying `member` gets `403` posting to `"announcements"` and nested/group mentions (`@**@**x**all**`, `@*mentors*`, `@_**all**`) have all `@` neutralized.

### AUD-03 — Unescaped Zulip Markdown & `@**all**` Injection in `sendZulipApprovalQueueNotification`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `functions/src/lib/zulip.ts:92-109`; `functions/src/routes/contentApproval.ts:192-244`.
- **Affected Behavior / Trigger:** Any `member` can save a pending draft with `title` or `author` containing `\n\n@**all** [link](https://evil.example)` and invoke `POST /api/content-admin/notify-pending`, which interpolates `input.title`, `actor`, `input.section`, and `input.contentId` raw into `#leadership`.
- **Impact:** Arbitrary `@**all**` pings and spoofed Markdown/links in the `#leadership` Zulip stream under the bot identity.
- **Remediation:** Normalize control/newline/bidi characters and apply `escapeZulipMarkdown` to `section`, `title`, `actor`, and `contentId` in `sendZulipApprovalQueueNotification`, validating `dashboardPath.startsWith("/")`.
- **Acceptance Test:** Unit tests in `contentApproval.test.ts` / `zulip.test.ts` asserting malicious `title` and `author` strings are single-lined and escaped (`@\u200B`, escaped brackets/parens) before `sendZulipMessage`.

### AUD-04 — `routes/videos.ts` Calls `syndicatePublishedVideo()` Inside `mediaApi` Without Zulip/Bluesky Secrets
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `functions/src/apps/media.ts:11`; `functions/src/routes/videos.ts:286-313,470,503-522`; `functions/src/functionConfig.ts:64-70`; `infra/gcp/production-deployment.json:110-126`.
- **Affected Behavior / Trigger:** `videos.ts` runs inside `mediaApi`, which binds `YOUTUBE_API_KEY` etc. but intentionally omits `ZULIP_BOT_EMAIL`, `ZULIP_API_KEY`, and `BLUESKY_APP_PASSWORD` (bound on `communicationsApi`). `announceNewlyPublishedVideo()` stamps `syndicatedAt` first, then silently fails both Zulip and Bluesky calls in production.
- **Impact:** Published and synced YouTube videos never syndicate to Zulip or Bluesky and have no retry path.
- **Remediation:** Preserve `mediaApi` least-privilege isolation by routing video syndication through `communicationsApi` (`POST /api/webhooks/syndicate-video`, mirroring `POST /api/webhooks/syndicate-post` with per-channel delivery receipts and retryable status) invoked from the Video Manager UI upon publish/sync, and remove the dead unsecret-backed `syndicatePublishedVideo` call from `mediaApi` (stamping `syndicatedAt` only when channels succeed). Add a contract test in `functions/src/__tests__/index.test.ts` preventing secret-unbacked syndication imports on `mediaApi`.
- **Acceptance Test:** Unit tests for `POST /api/webhooks/syndicate-video` (verifying `ensureAdmin`, per-channel receipts, retry on failure) + `videos.test.ts` + `index.test.ts` secret-binding contract assertion + dashboard `VideosManagementPage` test.

### AUD-05 — Production CSP Blocks `SimPreviewFrame` Inline `<script>` Execution & `/types/areslib.d.ts` Returns `404`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect` *(reproduced live on `https://aresfirst.org/academy/playground`)*
- **Evidence:** `src/components/editor/SimPreviewFrame.tsx:191-446`; `firebase.json` `Content-Security-Policy` (`script-src 'self' ...`, no `'unsafe-inline'`); `src/hooks/useMonacoEditor.ts:56` (`fetch('/types/areslib.d.ts')`); deleted in `75d46d8b`. Live browser audit confirmed 2 CSP script blocks (`about:srcdoc` lines 51 & 135) leaving preview stuck on `"Loading Environment..."` and live `GET https://aresfirst.org/types/areslib.d.ts` returning `404`.
- **Affected Behavior / Trigger:** Visiting `/academy/playground` or `/dashboard/simulations` on `https://aresfirst.org`.
- **Impact:** Interactive Simulation Playground preview is completely non-functional in production, and Monaco loses ARESLib TypeScript definitions with a 404 console error.
- **Remediation:**
  1. Replace inline `<script>` tags inside `SimPreviewFrame` `srcdoc` with a dedicated static sandbox host page (`public/sandbox/simulation-preview.html` + external `public/sandbox/simulation-preview.js`) loaded via `<iframe src="/sandbox/simulation-preview.html" sandbox="allow-scripts" referrerPolicy="no-referrer" />` (preserving strict opaque origin — NEVER `allow-same-origin`). Pass compiled files and runtime URL from `SimPreviewFrame` via `postMessage` once the sandbox emits `sim-sandbox-ready`, executing compiled modules inside the isolated opaque sandbox via `blob:` module/script URLs permitted ONLY in a dedicated `/sandbox/simulation-preview.html` CSP header in `firebase.json` (`script-src 'self' blob:; connect-src 'none'; frame-ancestors 'self'; ...`), keeping `/**` CSP 100% free of `'unsafe-inline'`, `'unsafe-eval'`, and `blob:`.
  2. Restore `public/types/areslib.d.ts` for Monaco IntelliSense.
- **Acceptance Test:** Hosting/CSP header test in `src/test/hostingConfig.test.ts` verifying `/sandbox/simulation-preview.html` has isolated CSP while `/**` remains unchanged; `SimPreviewFrame.test.tsx` + Playwright test verifying compiled simulation code executes and emits `sim-ready` with zero CSP violations and `GET /types/areslib.d.ts` returns `200`.

### AUD-06 — Unvalidated Cross-Origin `postMessage` Listener in `useSimulationTelemetry.ts`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `src/hooks/useSimulationTelemetry.ts:17-39`; `src/components/editor/SimPreviewFrame.tsx:41-160`; `src/components/SimulationPlayground.tsx:246-251`; `src/hooks/useSimulationChat.ts:173`.
- **Affected Behavior / Trigger:** `useSimulationTelemetry` attaches an unguarded `window.addEventListener("message", ...)` with zero `origin`, `source`, prototype-key, type, or size validation, bypassing `SimPreviewFrame.tsx`. Posting `key: "toString"` or non-array `sim-console.args` crashes React; posting `{ type: "ARES_SCREENSHOT", dataUrl: "https://attacker.example/..." }` injects unvalidated URLs into authenticated `POST /api/ai/sim-playground`.
- **Impact:** Cross-origin or sandboxed UI crash, unbounded memory DoS, and injection of arbitrary image URLs into authenticated member AI requests.
- **Remediation:** Remove the standalone `window.addEventListener("message", ...)` from `useSimulationTelemetry.ts` and forward validated telemetry, FPS, console logs, and screenshots exclusively through `SimPreviewFrame.tsx`'s `iframeRef`-checked `handleMessage` with `Object.hasOwn`/prototype-key guards, bounded series/log caps, finite timestamps, and strict `^data:image\/(png|jpeg|webp);base64,` validation.
- **Acceptance Test:** Unit tests in `src/test/SimPreviewFrame.test.tsx` & telemetry tests verifying non-iframe/non-opaque messages, prototype keys (`toString`, `__proto__`), non-array `args`, and non-`data:image/` screenshots are rejected safely without crashing.

### AUD-07 — BIOBUZZ Cold-Start `/health` & Admission Race
- **Severity & Confidence:** `P1 High` — `Confirmed Defect` *(reproduced live on `https://aresweb-biobuzz-sim-205869391101.us-central1.run.app/health`: `accepting: false` cold -> `accepting: true` warm; also broke CI deploy run `43368352140`)*
- **Evidence:** `functions/src/biobuzzServer.ts:60,76-89,100`; `infra/gcp/biobuzz-service.json:19` (`minInstances: 0`); `scripts/biobuzz-cloud-run.mjs:40,52-57`.
- **Affected Behavior / Trigger:** `rooms.drain()` initializes `accepting = false` and `server.listen()` binds synchronously while `void readControl()` asynchronously fetches `internal_biobuzz_control/service` from Firestore. A cold-start `/health` or `/api/biobuzz/create` returns `accepting: false` / `503` before `readControl()` settles, failing `--verify-live`.
- **Impact:** Spurious production deployment failures whenever BIOBUZZ is skipped after scaling to zero, and spurious `503` errors for the first cold-start player.
- **Remediation:** Retain `const initialControl = readControl();` in `biobuzzServer.ts` and await `Promise.race([initialControl, timeout(5000)])` before serving `/health` and admission readiness (staying fail-closed if Firestore errors), plus add bounded retry/backoff on `--verify-live` in `scripts/biobuzz-cloud-run.mjs`.
- **Acceptance Test:** `functions/src/biobuzzServer.test.ts` delayed-Firestore test confirming first `/health` returns `accepting: true` (and `accepting: false` on Firestore error); `scripts/biobuzz-cloud-run.test.mjs` test verifying `--verify-live` retries transient cold-start responses and fails closed if admission stays false.

### AUD-08 — Tailwind v4 `@layer components` vs `@layer utilities` Breaks `.hover:bg-ares-bronze:hover` Contrast Across 25 Public CTAs
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `src/app/globals.css:83-128`; compiled `dist/assets/index-DcnyJ8ln.css` (`@layer components` precedes `@layer utilities`); `packages/ui/src/Button.tsx:19-20`; 25 public CTA call sites (`DesktopUserMenu`, `MobileNavDrawer`, `Footer`, `PwaUpdatePrompt`, `AnalyticsConsentBanner`, `PublicDataState`, `/sponsors`, `/blog`, `/robots`, `/tournaments`, `/outreach`, `/calendar`, `/academy`, `/location-morgantown`, `/robotics-west-virginia`).
- **Affected Behavior / Trigger:** Hovering any `bg-ares-red hover:bg-ares-bronze text-white` CTA activates `@layer utilities` `.hover\:bg-ares-bronze:hover` (`#CD7F32`) while `@layer utilities` `.text-white` overrides `@layer components` `color: var(--ares-on-bright-accent)`.
- **Impact:** `#FFFFFF` on `#CD7F32` yields **3.14:1** contrast, failing WCAG 2.2 AA `4.5:1` across sitewide primary actions.
- **Remediation:** Move the bronze-hover foreground rule outside `@layer components` (unlayered in `src/app/globals.css`) and add explicit `hover:text-obsidian` to `packages/ui/src/Button.tsx:20`.
- **Acceptance Test:** Playwright computed-style hover contrast test (`>= 4.5:1`) + updated `ContrastTokens.test.ts` asserting the rule is outside `@layer components`.

### AUD-09 — Direct Online Saves Do Not Clear Stale Queued Outbox Entries in `TournamentPitCommand` & `TournamentScoutingHub`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `src/app/tournaments/[id]/TournamentPitCommand.tsx:212-215`; `src/app/tournaments/[id]/TournamentScoutingHub.tsx:207-210`; `src/lib/pitModeOutbox.ts:148-160,213-226`.
- **Affected Behavior / Trigger:** Offline edit `A` queues in `localStorage`; connectivity returns and newer online edit `B` succeeds directly without removing `A`; a later flush replays `A`, overwriting `B` on the server.
- **Impact:** Silent rollback of live pit checklists, battery voltages, open robot blockers, and pit scouting cards during tournaments.
- **Remediation:** Export `clearSupersededOutboxMutations(tournamentId, matcher, uid)` from `src/lib/pitModeOutbox.ts` and invoke it on direct online save success for `pit_state` and matching `pit_scouting` (`teamNumber`).
- **Acceptance Test:** Unit + component tests confirming queueing `A`, succeeding direct save `B`, and flushing never sends `A`.

### AUD-10 — `TournamentPitCommand` Never Hydrates Pending Offline `pit_state` on Reload & Clobbers Local Edits on Prop Sync
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `src/app/tournaments/[id]/TournamentPitCommand.tsx:88-96,156-161,199-231`; `src/lib/pitModeOutbox.ts:151`.
- **Affected Behavior / Trigger:** Reloading offline or receiving a refetched stale `pitState` prop overwrites local React state from server `pitState`; the next offline toggle coalesces and replaces the previous queued offline snapshot with the stale base.
- **Impact:** Permanent loss of offline battery logs, checklist ticks, and robot blockers.
- **Remediation:** Hydrate `checklists`/`batteries`/`triageItems` from any pending `pit_state` in `listTournamentOutbox(tournament.id, userUid)` on mount, and skip overwriting local state from `pitState` while a pending `pit_state` exists.
- **Acceptance Test:** Component test mounting `TournamentPitCommand` with pre-seeded `pit_state` in `localStorage` and stale `pitState` prop verifying offline entries survive mount, prop refresh, and follow-up edits.

### AUD-11 — `isPermanentOutboxError` Drops Queued Offline Scouting Reports on HTTP `401 Unauthorized`
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:** `src/lib/pitModeOutbox.ts:40-50,228-234`; `src/app/tournaments/[id]/TournamentScoutingHub.tsx:117-124`.
- **Affected Behavior / Trigger:** Tablet stays offline >1h (Firebase ID token expires); on reconnect, auto-flush hits `HTTP 401`, `isPermanentOutboxError` returns `true`, and all queued scouting reports are permanently deleted from `localStorage`.
- **Impact:** Irrecoverable loss of offline scouting reports after token expiration.
- **Remediation:** Exclude `401` from `isPermanentOutboxError` (`status !== 401 && status !== 408 && status !== 429`), retain items in `remaining`, and surface an explicit re-authentication / retry notice.
- **Acceptance Test:** `PitModeOutbox.test.ts` asserting `isPermanentOutboxError({ status: 401 }) === false` and that `401` keeps items in `result.remaining` with `result.rejected` empty.

### AUD-12 — `web` SSR Function Hangs 20s on `429` & Lacks `trust proxy: 1`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `functions/src/web.ts:38-44,60-65,104-113`.
- **Affected Behavior / Trigger:** `express-rate-limit` sends `429` without calling `next()`, leaving `new Promise((resolve) => requestLimiter(req, res, () => resolve()))` pending until the 20s function timeout; missing `app.set("trust proxy", 1)` allows `X-Forwarded-For` bypass.
- **Impact:** Concurrency-slot exhaustion DoS on dynamic SSR pages and IP limiter bypass.
- **Remediation:** Mount `requestLimiter` and `handleWebRequest` on an `express()` app with `app.disable("x-powered-by")` and `app.set("trust proxy", 1)`, removing the manual `new Promise` wrapper.
- **Acceptance Test:** `web.test.ts` verifying rate-limited request `max + 1` resolves immediately with `429` and `trust proxy === 1`.

### AUD-13 — PR #351 Site Announcements: Unbounded Retry Loop, Schedule-Edit `@**all**` Re-Ping, & Admin UI Lifecycle/Delivery Gaps
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `functions/src/lib/siteAnnouncementDelivery.ts:6,17-41`; `functions/src/routes/announcements.ts:62-72,99-114`; `src/app/dashboard/announcements/page.tsx:13-23,149-152,302-310,342`.
- **Affected Behavior / Trigger:** Persistent Zulip failure retries every 2 min indefinitely with no cap; editing only `endsAt`/`startsAt`/`evergreen` on an already-`sent` active banner resets `zulipDelivery: "pending"` and broadcasts another `@**all**` ping; `/dashboard/announcements` labels scheduled/expired notices `"Publishing enabled"`, hides Zulip delivery status, gives no re-ping warning, and disables `"Remove from site"` when `isActive` checkbox is unchecked before saving.
- **Impact:** Error storms on misconfiguration, surprise `@**all**` channel spam, and inaccurate admin status controls.
- **Remediation:** Add `zulipAttempts` + exponential backoff + terminal `"failed"` state after 5 attempts in `siteAnnouncementDelivery.ts`; only reset `zulipDelivery: "pending"` when user-visible content (`message`, `severity`, `link`, `linkLabel`) changes or `isActive` transitions `false -> true`; expose `zulipDelivery` & `zulipDeliveredAt` in `GET /api/announcements/admin`; compute explicit `Draft / Hidden`, `Scheduled`, `Live`, `Expired` states, show Zulip delivery badge + `@**all**` warning, and track persisted `serverIsActive` for `"Remove from site"`.
- **Acceptance Test:** `siteAnnouncementDelivery.test.ts` (retry cap -> `"failed"`), `announcements.test.ts` (schedule-only edit keeps `"sent"`, admin GET returns delivery metadata), `AnnouncementManagerPage.test.tsx` (Scheduled/Expired states, delivery badge, Remove enabled while unsaved checkbox unchecked).

### AUD-14 — `GET /api/photos/public` Soft-Delete Pagination Cursor Stall
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `functions/src/routes/photos.ts:195-266`.
- **Affected Behavior / Trigger:** Archiving `>= limit + 1` newest photos in public albums causes `GET /api/photos/public` to return `{ photos: [], hasMore: true, nextCursor: null }`.
- **Impact:** Public gallery stalls or returns truncated pages.
- **Remediation:** Port the bounded scan loop pattern from `GET /api/photos` (`photos.ts:148-187`) with `scanCursor` advancement to `GET /api/photos/public`.
- **Acceptance Test:** `photos.test.ts` seeding 25 archived photos newer than 5 active public photos and asserting `GET /api/photos/public?limit=24` returns all 5 active photos.

### AUD-15 — `profileRoster.ts` Omits `authData?.email` from `sanitizeAvatarUrl`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `functions/src/routes/profileRoster.ts:201,233-237,273-303`; `functions/src/routes/profileSelf.ts:33-41`.
- **Affected Behavior / Trigger:** DiceBear avatar URL containing a member's email in `?seed=...` passes `sanitizeAvatarUrl(data.avatar, [doc.id, data.contactEmail, data.email])` because `contactEmail` is encrypted ciphertext and `authData?.email` is omitted.
- **Impact:** Potential minor/member email exposure on unauthenticated public `/about`.
- **Remediation:** Pass `authData?.email` into `sanitizeAvatarUrl` in `/about-roster` and `/team-roster`, and reject email-shaped (`@`) substrings in decoded avatar URLs inside `sanitizeAvatarUrl` and `profileUpdateSchema`.
- **Acceptance Test:** `profiles.test.ts` verifying an email-seeded DiceBear avatar is stripped to `""` on `GET /api/profiles/about-roster`.

### AUD-16 — Focus-Visible Contrast Failures on Light (`marble`/`white`) and Gold (`#FFB81C`) Surfaces
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/globals.css:269-272`; `src/components/SiteAnnouncementBanner.tsx:64,168,180`; `src/app/join/page.tsx:196-380`; `src/app/about/page.tsx:180,214`; `src/app/robotics-west-virginia/page.tsx:112-151`.
- **Impact:** Cyan (`#00E5FF`) and white focus rings yield `1.13:1`–`1.73:1` contrast (failing WCAG 2.2 SC 1.4.11 `>= 3.0:1`).
- **Remediation:** Override focus outline color to `var(--obsidian)` on `.marble-band`, `.bg-marble`, `.bg-white`, and `.bg-ares-gold` surfaces in `src/app/globals.css`, and change `SiteAnnouncementBanner` focus rings to `focus-visible:ring-current`.
- **Acceptance Test:** Contrast/CSS rule unit test + Playwright focus-ring computed-color check on `/join` and gold `SiteAnnouncementBanner`.

### AUD-17 — Additional WCAG 2.2 AA Rest & Hover Contrast Failures
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/seasons/page.tsx:537` + `src/app/globals.css:236-246` (same-element `bg-white text-ares-red` = `2.78:1`); `src/components/Footer.tsx:397,425` (`1.54:1`, `1.73:1`); `src/app/blog/page.tsx:204` (`~2.6:1`); `src/components/OfflineIndicator.tsx:49` (`2.81:1`); `src/app/tournaments/page.tsx:232,321,333` (`2.35:1`); `src/app/outreach/OutreachSections.tsx:289` (`3.59:1`); `SelectedEventPanel.tsx:45,96`, `EventVenueInfo.tsx:40`, `EventRsvps.tsx:107,114`, `academy/page.tsx:441`, `TournamentDetailSections.tsx:115`, `TournamentAlliancePlanner.tsx:489`, `TournamentMatchesList.tsx:519`, `SimulationPlaygroundConsoleTabs.tsx:53,63`, `SimulationPlaygroundPreview.tsx:29,39`, `ZulipThread.tsx:157`, `PhotoPickerModal.tsx:340,396,472`, `VideoPickerModal.tsx:123`.
- **Remediation:** Add same-element `.bg-white.text-ares-red, .bg-marble.text-ares-red` to `globals.css`; add `hover:text-obsidian` on bright-fill hover icons; switch `OfflineIndicator` to `text-obsidian`; switch `/tournaments` gradient start to `from-ares-red-light`; raise all cited sub-AA text utilities to `>= /65` (`>= 4.5:1`).
- **Acceptance Test:** Expanded `ContrastTokens.test.ts` assertions + Playwright/Vitest style verification.

### AUD-18 — Stacking-Context Trap (`CommandPalette`), Public Modal Z-Index Inversions, `OfflineIndicator` Collision & `Navbar` Transition Overlap
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect` *(banner-over-navbar overlap observed live on `/arcade`)*
- **Evidence:** `src/components/navigation/CommandPalette.tsx:189` (trapped inside `Navbar` `z-50` stacking context); `src/components/Navbar.tsx:71` (`transition-all duration-500` animates `top` over 500ms); `src/components/OfflineIndicator.tsx:49,65` (`z-50`); public modals at `z-50`–`z-[81]` (`gallery/page.tsx:320`, `outreach/page.tsx:180`, `AcademySearchModal.tsx:38`, `AcademyFeedbackSection.tsx:85`, `PhotoLightbox.tsx:26`, `RobotEditorModal.tsx:100`, `videos/page.tsx:332`, `TournamentMatchPrintDialog.tsx:44`) beneath `SiteAnnouncementBanner` (`z-[70]`) and desktop `AnalyticsConsentBanner` (`z-[100]`).
- **Remediation:** Portal `CommandPalette` to `document.body` at `z-[120]` with scroll lock and background `inert`; raise listed modal layers to `z-[120]`/`z-[121]`; raise `OfflineIndicator` to `z-[80]` (offset below announcement banner); change `Navbar.tsx:71` `transition-all` to `transition-colors`.
- **Acceptance Test:** Unit/Playwright tests verifying `CommandPalette` portals to `document.body` above banners and `Navbar` offsets instantaneously without `transition-all`.

### AUD-19 — Keyboard & Assistive-Technology Defects (`CommandPalette`, `EventGallery`, `AcademySearchModal`, `ErrorBoundary`)
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/components/navigation/CommandPalette.tsx:205-280` (missing `role="combobox"`, `aria-controls`, `aria-activedescendant`, option `id`s); `src/components/events/EventGallery.tsx:48-59` (sibling `.sr-only` input breaks `focus-within:`); `src/app/academy/components/AcademySearchModal.tsx:38-80` (no visible Close button); `src/components/ErrorBoundary.tsx:148,174` (`<h2>` without `<h1>`, missing `type="button"`).
- **Remediation:** Wire `combobox` + `aria-activedescendant` in `CommandPalette`, switch `EventGallery` to `peer` / `peer-focus-visible:`, add Close button in `AcademySearchModal`, and upgrade `ErrorBoundary` heading to `<h1>` + `type="button"`.
- **Acceptance Test:** Vitest Testing Library assertions for all four components.

### AUD-20 — `/events/:id` Passes Raw Serialized Tiptap JSON to `<SEO description>`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/events/[id]/page.tsx:557-560`.
- **Remediation:** Extract plain text via `toPlainText(event.description).trim().slice(0, 160)` before passing to `<SEO description={...} />`.
- **Acceptance Test:** Unit test rendering `EventDetailPage` with Tiptap JSON description asserting `meta[name="description"]` contains prose and omits `"type":"doc"`.

### AUD-21 — Truthful Product & Eligibility Contradictions on `/terms` and `/location-morgantown`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/terms/page.tsx:85` (claims active Stripe processor), `:112` (`new Date().toLocaleDateString()` dynamic date); `src/app/location-morgantown/page.tsx:220` (`Grades 7-12` vs `/join`'s `6-12`).
- **Remediation:** Update `/terms` to truthfully describe inquiry-based sponsorships without active on-site Stripe checkout and use a fixed revision date (`November 20, 2026`); update `/location-morgantown` to `Students (Grades 6–12)`.
- **Acceptance Test:** Unit tests verifying `/terms` omits Stripe claims and dynamic today-date and `/location-morgantown` states `Grades 6–12`.

### AUD-22 — `@media print` Pagination/Clipping & `SponsorsPage` Imperative Logo Fallback
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect` *(blank Zulip sponsor card during lazy-load abort observed live)*
- **Evidence:** `src/app/globals.css:291-310` (`visibility: hidden` + `position: absolute; inset: 0`); `src/app/sponsors/page.tsx:203,295-309` (`overflow-hidden` + imperative `style.display = "none"` / `classList.remove("hidden")` overwritten on React re-render + unsized `loading="lazy"`); `src/components/PwaUpdatePrompt.tsx:273` (missing `print:hidden`); `src/app/sponsors/SponsorFactSheetSection.tsx:155,161` (missing `print:text-black`).
- **Remediation:** Replace `inset: 0` print hack in `globals.css` with `display: none !important` hiding non-sheet siblings and `position: static` flow for `.ares-print-sheet`, add `print:overflow-visible print:py-0` on `/sponsors`, `print:hidden` on `PwaUpdatePrompt`, and `print:text-black` on Fact Sheet notices; replace imperative DOM mutation in `SponsorsPage.tsx` with React `failedLogoKeys` state and explicit image dimensions (`h-20 w-auto`) / eager loading.
- **Acceptance Test:** `SponsorsPage.test.tsx` verifying logo fallback survives state re-render; Playwright `emulateMedia({ media: 'print' })` test on `/sponsors` and `/robots/hephaestus`.

### AUD-23 — Calm UI & Reduced-Motion Violations
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/components/events/EventHero.tsx:66` (`motion-safe:animate-pulse`); `src/components/navigation/DesktopUserMenu.tsx:133` & `src/components/VideoPickerModal.tsx:80` (`animate-ping`); `src/components/AvatarEditor.tsx:215-218` (unwrapped `framer-motion`); `src/components/docs/AutonomousLogicDiagram.tsx:62,69,88-99` (unconditional `animated: true` edges + missing accessible label).
- **Remediation:** Remove non-loading `animate-pulse`/`animate-ping`; wrap `src/App.tsx` with `<MotionConfig reducedMotion="user">`; gate `AutonomousLogicDiagram` edge animation on `prefers-reduced-motion` and add an accessible `role="region"` + summary.
- **Acceptance Test:** Unit tests verifying absence of infinite pulse/ping on static UI, root `MotionConfig`, and reduced-motion behavior + label on `AutonomousLogicDiagram`.

### AUD-24 — Cross-Component Outbox Desynchronization Between `TournamentPitCommand` and `TournamentScoutingHub`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/tournaments/[id]/page.tsx:502-519`; `TournamentPitCommand.tsx:113-134`; `TournamentScoutingHub.tsx:76-110`.
- **Remediation:** Dispatch a lightweight `ares:pit-outbox-changed` window event on every `writeTournamentOutbox`, listen in both components, and pass `onSavePitState` into `TournamentScoutingHub` so syncing from either panel updates both badges and React Query caches.
- **Acceptance Test:** Integration/component tests verifying cross-panel badge synchronization and React Query cache update on flush from either panel.

### AUD-25 — `unverified` Users Exposed to Member Navigation & False `"Read tasks & documents: Granted"` Claims
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/components/dashboard/DashboardSidebar.tsx:161-243`; `src/app/dashboard/page.tsx:208,284-320,1080-1174`; `DashboardOnboardingGuide.tsx:39-46`; `events/page.tsx`, `EventFormRoster.tsx:521`, `usePhotoCollectionData.ts`, `videos/page.tsx`, `zulip/page.tsx`, `useTaskBoardData.ts`, `useDocumentSync.ts`.
- **Remediation:** Restrict `DashboardSidebar` for `isUnverified` to `Command Center` and `My Profile` (matching `CommandPalette.tsx:127`), update `DashboardHome` permissions card to `"Pending verification"` and skip member-only fetches/subscriptions when `isUnverified`, and guard member workspace routes cleanly with a pending-verification notice before firing blocked API/Firestore queries.
- **Acceptance Test:** Unit tests with `role: "unverified"` confirming sidebar parity and zero `403`/blocked calls on `/dashboard`, `/dashboard/events`, `/dashboard/photos`, `/dashboard/videos`, `/dashboard/zulip`, `/dashboard/tasks`.

### AUD-26 — Photo Manager UI Exposes Public Albums & Edit Controls to Roles Blocked by Backend Authorization
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/dashboard/photos/PhotoLibraryPanel.tsx:158-163,294-304`; `PhotoManagementDialogs.tsx:257-263,286-292`; `functions/src/routes/photos.ts:365-384`; `photosUpload.ts:64-80`.
- **Remediation:** Filter/disable public albums in upload and edit `<select>` lists when `!canManage`, gate edit controls on `canContribute`, and prevent `member` from opening edit on photos in public albums (or show a clear read-only note).
- **Acceptance Test:** Vitest tests in `PhotoLibraryPanel` / `PhotoManagementDialogs` verifying `member` cannot pick public albums and `!canContribute` hides edit actions.

### AUD-27 — Incomplete CSV Formula-Injection Escaping (`emailRoster`, `inquiries`) & Portfolio Stale Picker / Inflated CSV Count
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/app/dashboard/users/emailRoster.ts:60-63`; `src/app/dashboard/inquiries/page.tsx:51-55`; `src/app/dashboard/portfolio/page.tsx:283-285,321-323,415,918-945,1125-1150`.
- **Remediation:** Use `escapeSpreadsheetCsvCell` (`src/lib/outreachExport.ts`) in `emailRoster.ts` and `inquiries/page.tsx`; filter `page.linkedArtifactIds` through `candidateById` in `portfolio/page.tsx:415`; derive effective picker values against `filteredCandidates` in `portfolio/page.tsx`.
- **Acceptance Test:** Unit tests covering leading whitespace/newline formula payloads (`" =1+1"`, `"\t=SUM(A1)"`, `"\r\n+1+1"`) and Portfolio verified CSV counts + filter-switched artifact linking.

### AUD-28 — Blog Share Kit Canvas Text Overflow/Collision & Unguarded `encodeQrMatrix` Crash on Long Robot IDs
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `src/lib/blogShareKit.ts:297-308,336-359`; `src/lib/qrSvg.ts:20-25,121-130`; `src/app/robots/[id]/page.tsx:148-153`.
- **Remediation:** Measure canvas widths via `ctx.measureText` + pass `maxWidth` in `blogShareKit.ts` (keeping byline `<= 612px`); add QR Versions 5-L and 6-L (up to 134 bytes) in `src/lib/qrSvg.ts` and guard `encodeQrMatrix` in `RobotDetailPage` with a `try/catch` URL fallback.
- **Acceptance Test:** Unit tests in `blogShareKit.test.ts` (wide uppercase headlines & 66-char bylines fit bounds) and `qrSvg` / `RobotDetailPage` (80-char robot ID renders cleanly).

### AUD-29 — Academy Upstream Studio Drift (`7.0.79 -> 7.0.80`) & Stale `catalog.json` `appliesToVersion` / Dashboard Placeholder
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect` *(confirmed by failed `pnpm run content:verify`)*
- **Evidence:** `content/learning/catalog.json:4-8,289,395,810,830`; `content/learning/source-authorities.json:5-15`; `src/components/dashboard/LearningMetadataFields.tsx:81` (`Studio 7.0.75`); `scripts/validate-learning-catalog.mjs:334-361,625`.
- **Remediation:** Refresh upstream `ARES-Robotics` authority to the immutable `main` commit declaring `Studio 7.0.80` (using standing ARES refresh approval), correct all 4 stale `appliesToVersion` entries + `LearningMetadataFields.tsx:81`, extend `validate-learning-catalog.mjs` to validate `document.appliesToVersion` (including hyphenated `ARES-FTC`/`ARES-FRC` and commit prefixes) and duplicate `sourceRoots`, and record the source comparison under `docs/`.
- **Acceptance Test:** `pnpm run content:verify` and `pnpm run content:release-validate` both exit `0`, and validator unit tests fail on stale `appliesToVersion` or duplicate `sourceRoots`.

### AUD-30 — BIOBUZZ WebSocket `/play` Lacks Per-IP & Pending-Handshake Caps
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `functions/src/biobuzzServer.ts:18-28`; `infra/gcp/biobuzz-service.json:18,20,27`.
- **Remediation:** Cap unbound (pre-handshake) sockets globally (`<= Math.min(16, limit * 4 + 4)`), cap total sockets (`<= limit * 4 + maxPending`) reserving >=100 Cloud Run concurrency slots for HTTP, enforce per-IP unbound cap (`<= 4`) + sliding upgrade rate limit, and tighten handshake timeout to `3000` ms.
- **Acceptance Test:** `functions/src/biobuzzServer.test.ts` verifying excess idle `/play` upgrades are rejected while `/health` and admitted players succeed.

### AUD-31 — Selective PR CI (`infra/verification-areas.json`) Missing Cross-Area Edges & Linux Case-Sensitive Glob Misses
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `infra/verification-areas.json:77-99,189,242,303,325-334,361,373-377,384-386,438-439,461,481-507`.
- **Remediation:** Add `functions/src/routes/calendarHelpers.ts` and `functions/src/lib/zulip.ts` to `shared` (or wire full transitive areas/components), add `"integrations"` to `media.dependsOn` + `"mediaApi"` to `integrations.components`, fix all 12 case-sensitive unit-test globs on Linux, add `src/lib/biobuzzScoring.test.ts` & `src/test/AnnouncementManagerPage.test.tsx`, narrow `*Drive*`, and prune dead path patterns.
- **Acceptance Test:** Expanded `scripts/affected-areas.test.mjs` verifying cross-area triggers and Linux POSIX case-sensitive glob matches.

### AUD-32 — Tight `academyInteractiveJs` Gzip Bundle Budget Margin (`96.8%`)
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:** `config/bundle-budgets.json:8-9`; `node scripts/check-bundle-size.mjs` (`91,956 / 95,000` bytes gzip, `3,044 B` margin).
- **Remediation:** Deduplicate repeated interactive lab chrome into `src/sims/shared/academy-interaction-ui.tsx` (or re-baseline aggregate `academyInteractiveJs` budget with explicit headroom while preserving the strict `2,600` B per-lab `largestAcademyInteractiveJs` cap).
- **Acceptance Test:** `pnpm run build && node scripts/check-bundle-size.mjs` passes with `>= 10%` gzip headroom on `academyInteractiveJs`.

### AUD-33 through AUD-36 — Low-Severity Hardening, Polish & Maintenance Backlog (`P3`)
- **AUD-33:** Add `Cache-Control: private, no-store` on PII `GET` endpoints (`inquiries`, `profileSelf`, `profileAdmin`); sanitize `item.filename` + set `redirect: "error"` in `photosImport.ts`; add per-user quota/audit on `POST /api/simulations/gist`, `AbortSignal.timeout` on external fetches, and move auth before body validation/hashing in `profileSync.ts` & `studioIntegrations.ts`.
- **AUD-34:** Pass `noindex` + `"Lesson Not Found"` on unknown `/academy/:slug` SPA transitions, track `useLocation()` for `/dashboard/*` canonicals, and add `noindex` + `<h1>` + accurate `mentor` unauthorized copy in `/dashboard/tournaments`.
- **AUD-35:** Normalize heading skips (`/blog`, `/robots/:id`, `/sponsors`, `Footer`), align `MermaidDiagram.tsx` hexes with `design/ares-design-tokens.json`, add `role="status"` on spinners, add `role="group"`/`type="button"`, add `tabIndex={-1}` & clipboard error alerts in `BlogShareKitModal`, and keep restored videos visible in `VideosManagementPage` when `showArchived` is checked.
- **AUD-36:** Deduplicate `MotorIO.kt` in `robotics-curriculum-plan.json:85-86`, warn on unbacked `"verified"` portfolio pages, dynamically discover all `packages/*/src` (including `biobuzz`) + dynamic `import()` + Firebase ban in `gamePackageBoundaries.test.ts`, evict finished/interrupted BIOBUZZ rooms under `maxRooms: 1`, remove tracked `.tanstack/tmp/17d57fe7-7adf9ddb359f852cb640e9d8da397488` (53 KiB) + add `.tanstack/` to `.gitignore`, and prune 7 dead paths from `vite.config.ts` `test.coverage.include`.

---

## 5. Verified Clean Boundaries & Scope Limits
- **Verified Clean Controls:**
  - **PR #348 fixes verified solid:** `profileRoster.ts` fails closed when `authorized_users` is empty; `webRendering.ts` HTML-escapes metadata with arrow replacers and strips `--- Meeting Notes ---`; all 37 prerendered shells emit exactly 1 canonical tagged `data-prerender-seo`; `/biobuzz` 301-redirects to `/biobuzz/simulator` and `/waggle-way/community` renders `200`; zero duplicate `<main>` landmarks remain across all game packages; `pnpm-workspace.yaml` removes the vulnerable `sucrase>tinyglobby` path (`0` prod vulnerabilities).
  - **PR #351 core controls verified solid:** `deliverSiteAnnouncement` is `public: false`, `maxInstances: 1`, `concurrency: 1`, uses Firestore `lastUpdateTime` lease preconditions, escapes message/link labels with `escapeZulipMarkdown`, validates internal `/` paths, and enforces `ensureAdmin` on `/api/announcements/admin`.
  - **Core security & privacy boundaries:** `storage.rules` denies all direct browser access; `inquiries` encrypts PII with AES-256-GCM before write and locks direct Firestore access; `travel-readiness` & `travel-readiness/reveal` enforce `ensureAdmin` + redacted `audit_logs`; lab PIN check-in uses HMAC-SHA256 + `timingSafeEqual` + transactional lockouts and blocks student `attended: true` self-writes; `linkAuthorizedUserByEmail` covers all custom role checks; all 8 workspace packages under `packages/*` have zero imports of `src/` or Firebase; all 39 GitHub Action `uses:` references are SHA-pinned; Pollinator and `SimPreviewFrame` both enforce opaque `sandbox="allow-scripts"` (never `allow-same-origin`); zero fabricated team data exists across public routes.
  - **Live operational notes (non-mutated):** Live `/blog` includes a test post titled `"Ball Transfer"` (`"Test"`, `2026-11-02`, `Sawyer Matheny`) recommended for team archival review; Storage App Check observation (`168.0h`, `0` direct calls, `0` unresolved media references) is `READY_FOR_MANUAL_ENFORCEMENT_REVIEW`.
- **Explicit Scope & Evidence Limits:**
  - Local 688-case `pnpm run test:e2e` was intentionally skipped during the read-only audit phase per user scope (CI shard runs on `99dac979` passed; full local `test:e2e` will be executed after remediation edits before PR handoff).
  - Live production checks were strictly read-only (`18` public routes at `1440×900` and `320×640`, public GETs, and read-only GCP/Firebase/GitHub metadata). Authenticated `/dashboard/*`, `/tournaments/*`, and screen-reader AT walkthroughs were assessed via source inspection, Vitest suites, and Firebase emulators rather than interactive authenticated production sessions.
  - Accordingly, this report does **not** claim complete security, full WCAG 2.2 AA conformance, or zero defects outside executed checks.
