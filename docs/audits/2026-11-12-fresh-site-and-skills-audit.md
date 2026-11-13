# Fresh Site & Agent Audit Skills Review — 2026-11-12

## 1. Scope, Environment & Release Identity
- **Repository:** `ARES-23247/ARESWEB`
- **Audited Commit / Branch:** `b51d3c6615e6e1c52125c2b8cedec09a08e7d97c` (`chore/audit-skills-and-fresh-site-audit`, branched from clean `master`)
- **Initial Worktree State:** Clean at `b51d3c6615e6e1c52125c2b8cedec09a08e7d97c`; Phase 1 updated only shared skills, agent docs, and agent config validator tests before launching the Phase 2 full-stack repo + read-only live audit. Zero application (`src/`, `functions/`, `packages/`, `firestore.rules`, `storage.rules`) files were modified.
- **Audit Date:** `2026-11-12`
- **Runtime Versions:** Node `v24.19.0`, pnpm `11.21.0`, OpenJDK `21.0.12`, OS `Windows`
- **Live Target:** `https://aresfirst.org` and Firebase/GCP project `aresfirst-portal` (strictly read-only; zero mutations and zero secret values accessed)

### Verification Ledger (Executed vs. Live vs. Static Inspection)
| Check / Surface | Type | Command or Method | Outcome & Exact Scope |
| --- | --- | --- | --- |
| Agent skills & validator | Executed Gate | `pnpm run validate:agents`, `pnpm exec vitest run scripts/validate-agent-config.test.mjs`, `pnpm run lint` | Passed (verified 6 shared skills + validator tests `22 passed`) |
| Route security inventory | Executed Gate | `pnpm run check:route-security` | Passed (`134` mutation routes: `117` Firebase-authorized, `17` explicitly controlled exceptions) |
| Security observability | Executed Gate | `pnpm run validate:security-observability` | Passed (`5` redacted log metrics) |
| Game Cloud Run contract | Executed Gate | `pnpm run validate:game-deployment` | Passed (`\$35` spend cap prerequisite; `500000` monthly units) |
| Functions deploy lock & lint | Executed Gate | `pnpm run validate:functions-deploy-lock`, `pnpm --filter functions lint` | Passed (`eslint src --max-warnings=0`) |
| Release tooling tests | Executed Gate | `pnpm run test:release-tooling` | Passed (`5` files / `26` tests; `97.5%` lines, `100%` functions) |
| Frontend & root TypeScript / lint | Executed Gate | `pnpm run typecheck`, `pnpm run lint` | Passed (`tsc --noEmit`, `eslint --max-warnings=0`) |
| Production dependency audit | Executed Gate | `pnpm audit --prod --audit-level=low` | Passed (`0` known vulnerabilities) |
| GitHub Dependabot posture | Read-Only Live | `gh api "repos/ARES-23247/ARESWEB/dependabot/alerts?state=open" --jq 'length'` | Passed (`0` open alerts) |
| Academy provenance & release | Executed Gate | `pnpm run content:release-validate` | Passed (`68` learning docs, `3` batches, pinned at `4c789f47`) |
| Upstream ARES source drift check | Executed Gate | `pnpm run content:verify` | **Failed** (`studioVersion` changed: catalog `7.0.74`, `main` declares `7.0.75`) |
| Frontend test & coverage suite | Executed Gate | `pnpm run test:coverage` | Passed (`313` files, `2113` tests; `91%` stmts, `84.71%` branches, `88.82%` funcs, `91.96%` lines) |
| Functions build & coverage | Executed Gate | `pnpm --filter functions build && pnpm --filter functions test:coverage` | Passed (`88` files, `1072` tests; `93.92%` stmts, `84.58%` branches, `98.12%` funcs, `95.51%` lines) |
| Firestore & Storage rules | Executed Gate | `pnpm run test:rules` | Passed (`2` files, `41` tests in Firebase Emulator Suite) |
| Functions Firestore emulator | Executed Gate | `pnpm run test:functions-emulator` | Passed (`3` files, `10` tests in Firebase Emulator Suite) |
| Production build & bundle budgets | Executed Gate | `pnpm run build && node scripts/check-bundle-size.mjs` | Passed (`8/8` budgets pass; `35` prerendered route shells) |
| GCP Cloud Run & Secret names | Read-Only Live | `gcloud run services list` (`us-central1`), `gcloud secrets list` | `16` Cloud Run services listed (all CI-managed services carry `ares-fp` labels); `19` secret names verified |
| Storage App Check observation | Read-Only Live | `node scripts/check-storage-app-check-observation.mjs --project aresfirst-portal --start ... --require-ready` | `READY_FOR_MANUAL_ENFORCEMENT_REVIEW` (`167.95h`, `0` direct Storage verifications) |
| Live media inventory | Read-Only Live | `node scripts/inventory-media-references.mjs --project aresfirst-portal --bucket aresfirst-portal.firebasestorage.app` | `0` unresolved references across `33` posts, `96` events, `1` album, `32` `imported_photos`, `101` docs, `549` revisions (`blog/`: `1` obj, `gallery/`: `93` objs) |
| Live HTTP & API responses | Read-Only Live | `fetch` checks against `https://aresfirst.org` routes & public APIs | Security headers enforced (`CSP`, `HSTS`, `XCTO: nosniff`); `/feed.xml` `200`; `/rss.xml` `404`; live defects observed in `/api/seasons`, `/api/sponsors`, `/api/content/posts` |
| Live headless browser inspection | Read-Only Browser | `browser` subagent (`BROWSER_HOST_FACTS`: `visited_origins: https://aresfirst.org`, `blocked_origins: none`) | `15` desktop (`1440x900`) + `6` mobile (`320x640`) routes returned HTTP `200`, zero horizontal overflow, working mobile nav drawer; CSP console blocks surfaced on `/sponsors` & root HTML |
| Source & config domain review | Static Analysis | 4 parallel `research` subagents + lead-agent `read_file` verification | All findings verified at exact `path:line` |

---

## 2. Audit of Agent & Audit Skills (Phase 1 Completed & Verified)

### Gaps Identified in Existing Skills & Tooling
1. **Stale repository topology in `AGENTS.md` and `docs/AGENT_SETUP.md`:** Both omitted newer workspace packages (`packages/biobuzz/`, `packages/waggle-way/`, `packages/ui/`, totaling 8 `packages/*`), omitted `functions/src/biobuzzServer.ts`, `functions/src/apps/biobuzz.ts`, `src/lib/{biobuzzOnline,buzzleOnline,buzzelloOnline,waggleCommunity}.ts`, and omitted `infra/verification-areas.json` + `scripts/affected-areas.mjs` + `scripts/deployment-fingerprints.mjs` from the live source-of-truth table.
2. **Shallow validator enforcement:** `scripts/validate-agent-config.mjs` previously checked only top-level agent entry files and frontmatter/duplication rules—it did not validate backticked repository file paths, relative Markdown links inside `.agents/skills/**/*.md`, or completeness of documented `packages/*` workspaces.
3. **Recurring audit blind spots across `.agents/skills/*/SKILL.md`:** Past defects recurred across domains because skills lacked compact verification checklists for 3-way UI/API/Firestore-Rules role parity, `linkAuthorizedUserByEmail` & archived `role`/`isDeleted` preservation, Zulip/Bluesky escaping + canonical `https://aresfirst.org` URLs, shared-tablet offline outbox `uid` scoping, `@media print` container isolation and hover foreground contrast, `pnpm` v11 flag forwarding (`--`), selective CI closure/fingerprint tracing, and read-only live production checks.

### Upgrades Applied & Verified
- Updated `AGENTS.md`, `docs/AGENT_SETUP.md`, and `docs/conventions/18-audit-protocol.md` to reflect current live topology and link the upgraded audit skill references.
- Enhanced `.agents/skills/aresweb-comprehensive-audit/SKILL.md` and added three focused playbooks under `.agents/skills/aresweb-comprehensive-audit/references/`: `domain-checklists.md`, `live-production-checks.md`, and `report-template.md`.
- Upgraded `.agents/skills/{aresweb-zero-trust-security,aresweb-web-accessibility,aresweb-api-reference,aresweb-ci,aresweb-ast-migration}/SKILL.md` with targeted prevention patterns while keeping every `SKILL.md` lean and free of policy duplication.
- Hardened `scripts/validate-agent-config.mjs` (lines `106-116`, `147-172`) and `scripts/validate-agent-config.test.mjs` (`22/22` tests passing; `pnpm run validate:agents` passing).

---

## 3. Summary of Site Findings

| ID | Severity | Status | Domain | Summary |
| --- | --- | --- | --- | --- |
| **FA-01** | P1 High | Confirmed Defect | Live Content & Seasons | Live `/api/seasons` serves raw Tiptap/ProseMirror JSON (`{"type":"doc",...}`) rendered literally on `/seasons` |
| **FA-02** | P1 High | Confirmed Defect | CI & Deployment | `deployment-fingerprints.mjs` omits `waggleVerification.worker.ts` from `game` Cloud Run closure |
| **FA-03** | P1 High | Confirmed Defect | Championship Offline Pit Mode | `pitModeOutbox` lacks `uid` scoping, retries permanent 4xx forever, drops mid-flush writes, and misses PitCommand auto-flush |
| **FA-04** | P1 High | Confirmed Defect | Portal RBAC & UI Parity | `mentor` role is shown Tournaments, Seasons, Outreach, and Sponsors UI while backend requires `admin`/`coach` |
| **FA-05** | P1 High | Confirmed Defect | Export Security | CSV formula injection in `/dashboard/portfolio` (`escapeCsvCell` omits `=`, `+`, `-`, `@`, `\t`, `\r`) |
| **FA-06** | P1 High | Confirmed Defect | Public UI & WCAG Contrast | Unlayered `.clipped-button` CSS overrides Tailwind v4 utilities and permits `3.14:1` white-on-bronze hover text |
| **FA-07** | P1 High | Confirmed Defect | Print & Judge Handouts | Missing `@media print` isolation & `print:hidden` nav on Robot Pit, Sponsor Fact, Travel Binder, and Portfolio sheets |
| **FA-08** | P2 Medium | Confirmed Defect | Live Production & CSP | Live `/api/sponsors` serves Zulip logo from a GitHub HTML `/blob/` URL blocked by `firebase.json` `img-src` CSP |
| **FA-09** | P2 Medium | Confirmed Defect | SEO & Prerender Shells | `index.html` and `dist/index.html` still advertise `"ARES Analytics"` instead of `"ARES Robotics Studio"` |
| **FA-10** | P2 Medium | Confirmed Defect | Backend Security (Zulip) | Unsanitized Zulip mentions/Markdown in `POST /api/tasks/notify` and missing `@` strip in `sanitizeOnshapeText` |
| **FA-11** | P2 Medium | Confirmed Defect | Backend Pagination | `GET /api/photos/public` returns `hasMore: true, nextCursor: null` on archived chunks; `photos`/`albums`/`videos` lack scan loop |
| **FA-12** | P2 Medium | Confirmed Defect | Backend Input Bounds | `?limit=-1` or `0` throws HTTP `500` on `GET /api/inquiries` and returns empty truncated results on `GET /api/outreach` |
| **FA-13** | P2 Medium | Confirmed Defect | Backend Rosters & Travel Safety | Unpaginated `.limit(200)` / `.limit(100..500)` in `profileAdmin.ts` and `profileRoster.ts` silently drop active members at scale |
| **FA-14** | P2 Medium | Confirmed Defect | Webhooks Stability | Unvalidated `taskId` in `POST /api/webhooks/zulip` triggers HTTP `500` Firestore ref error on `"Task-"` or `"Task-a/b"` |
| **FA-15** | P2 Medium | Confirmed Defect | Selective CI Mapping | `infra/verification-areas.json` maps `src/app/dashboard/simulations/**` under `public` instead of `editor` |
| **FA-16** | P2 Medium | Confirmed Defect | Academy Provenance | `pnpm run content:verify` fails on upstream `ARES-Robotics/main` Studio bump `7.0.74 -> 7.0.75`; stale `9.3.6` placeholder |
| **FA-17** | P2 Medium | Confirmed Defect | WCAG Semantics & Contrast | Async error/empty/loading states lack `<h1>` / `role="status"`; `h2->h4` skip, `5px`–`8px` micro-text, `marble/40` & `marble/45` fail `4.5:1` |
| **FA-18** | P3 Low | Confirmed Defect | Backend Data Contract | `portfolio.ts` candidate loader queries mismatched fields (`tasks.status=="done"`, `robots.season`/`cadUrl`, `outreach.impacted`) |
| **FA-19** | P3 Low | Risk / Hardening | Backend Abuse Resistance | 4-digit self check-in PIN lacks per-user/per-event lockout; `sync-ftcscout` lacks durable `distributedQuota` |
| **FA-20** | P3 Low | Confirmed Risk | Firestore Rules Defense-in-Depth | Direct client writes on `seasons`, `awards`, `robots` in `firestore.rules` lack field/URL parity with Express DTO APIs |
| **FA-21** | P3 Low | Confirmed Defect | Sandbox, Modal & Motion | `BlogShareKitModal` unguarded slug throw; `SimPreviewFrame` missing `origin === "null"` & strict payload checks; missing `MotionConfig` |
| **FA-22** | P3 Low | Hyg. / Operational | Budgets, Shims & Live Content | Tight Academy gzip headroom (`96.9%`), 9 unused/test-only `src/` shims, live `"testing-permissions"` blog post, Cloudflare CSP noise |

*Severity scale:* **P0 Critical** (active compromise, data breach, or outage), **P1 High** (auth/PII boundary flaw, broken core flow, or major data loss), **P2 Medium** (bounded security hardening gap, role UI mismatch, a11y/SEO bug), **P3 Low** (technical debt, orphan, test gap, minor UX/perf polish).

---

## 4. Detailed Findings

### FA-01 — Live `/seasons` Renders Raw Serialized Tiptap JSON & Editor Placeholder Text
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - Live `GET https://aresfirst.org/api/seasons` returned `robotDescription: "{\"type\":\"doc\",\"content\":[{\"type\":\"paragraph\",\"content\":[{\"type\":\"text\",\"text\":\"Describe the robot's design, mechanisms, and season highlights...\"}]}]}"` for `2026` `BIOBUZZ` / `Phobos II`.
  - `src/app/seasons/page.tsx:252-256` renders `{season.robotDescription}` directly inside `<p>` without parsing JSON or sanitizing/extracting plain text or rich blocks.
  - `functions/src/routes/seasons.ts:84` passes raw `text(data.robotDescription, 2_000)` through `seasonDto` verbatim.
- **Affected Behavior / Trigger:** Any season whose description was saved using the Tiptap rich-text serializer or seeded with default editor placeholder JSON prints raw JSON syntax (`{"type":"doc",...}`) onto the public `/seasons` page.
- **Impact:** Public visitors on `/seasons` see raw JSON markup and unfilled editor placeholder text on the flagship current season card.
- **Remediation:** Normalize `robotDescription` at API write/read boundaries and update `src/app/seasons/page.tsx` to extract readable text or rich nodes when JSON AST is present; replace the live `"Describe the robot's..."` placeholder value via `/dashboard/seasons`.
- **Acceptance Test:** Unit test passing Tiptap JSON into `seasonDto` / `/seasons` renderer asserting human-readable text output, plus live `/api/seasons` verification.

### FA-02 — `deployment-fingerprints.mjs` Omits `waggleVerification.worker.ts` From `game` Cloud Run Closure
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `scripts/deployment-fingerprints.mjs:215-227` constructs `gameFiles` using `collectFunctionModuleClosure(root, ["functions/src/gameServer.ts"], { fileCache })`, which only follows static/dynamic `import`, `export ... from`, and `require(...)` edges.
  - `functions/src/lib/waggleVerification.ts:46` spawns `new Worker(join(__dirname, "waggleVerification.worker.js"), ...)`, so `waggleVerification.worker.ts` is missing from `gameFiles`.
- **Affected Behavior / Trigger:** A PR modifies only `functions/src/lib/waggleVerification.worker.ts` (or a future module imported exclusively by that worker) without modifying `waggleVerification.ts`.
- **Impact:** Fingerprint-gated production deploys see an unchanged `game` `ares-fp` label and skip rebuilding/deploying `aresweb-game-api` on Cloud Run, leaving stale Waggle Way server verification logic live.
- **Remediation:** Seed `"functions/src/lib/waggleVerification.worker.ts"` explicitly in the `collectFunctionModuleClosure` call for `gameFiles` at `scripts/deployment-fingerprints.mjs:224`.
- **Acceptance Test:** Add a unit test in `scripts/deployment-fingerprints.test.mjs` asserting `functions/src/lib/waggleVerification.worker.ts` is included in `game` fingerprint inputs and mutating its content changes the `game` hash.

### FA-03 — Offline Pit Outbox Lacks `uid` Isolation, Mishandles 4xx Errors, and Drops Concurrent/PitCommand Mutations
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `src/lib/pitModeOutbox.ts:30-35` keys `localStorage` solely by `ares_pit_outbox_v1:${tournamentId}` with no authenticated `uid` namespace.
  - `src/lib/pitModeOutbox.ts:143-175` treats every flush exception identically (re-queueing permanent `4xx` validation/auth failures forever), reads `queue` once at line 147 and overwrites `localStorage` with `remaining` at line 173 (clobbering items enqueued during async flight), and silently ignores `QuotaExceededError` at lines 77-79.
  - `src/lib/pitModeOutbox.ts:49-58` validates only `id` and `kind` without checking `tournamentId` or `payload` structure.
  - `src/app/tournaments/[id]/TournamentScoutingHub.tsx:134-152,176-193` enqueues even on non-network `4xx` errors while clearing form inputs; `src/app/tournaments/[id]/TournamentPitCommand.tsx:153-161` enqueues `pit_state` on failure without an `online` auto-flush listener or pending-sync badge.
- **Affected Behavior / Trigger:** Shared pit tablets switching scouts, permanent `4xx` validation/auth rejections, submitting a new scouting report while `flushTournamentOutbox` is awaiting network I/O, or losing connectivity inside Pit Command.
- **Impact:** Cross-user replay/attribution errors on shared devices, lost scouting edits during concurrent flushes, infinite failing retry loops, and orphaned offline Pit Command updates.
- **Remediation:** Scope storage keys by `${tournamentId}:${uid}`, separate transient network/`5xx` errors from permanent `4xx` failures, re-read current outbox or merge by `id`/`queuedAt` when finishing a flush, wire `PitCommand` to `online` flush/badge state, and surface quota warnings visibly.
- **Acceptance Test:** Unit tests in `src/test/` covering multi-user key isolation, mid-flush enqueue preservation, `4xx` rejection surfacing, and `QuotaExceededError` notification.

### FA-04 — `mentor` Role UI/API Parity Mismatch Across Four Dashboard Tabs
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `src/components/dashboard/DashboardSidebar.tsx:142-144,244-257` and `src/components/navigation/CommandPalette.tsx:75-80,129-131` render `tournaments`, `seasons`, `outreach`, and `sponsors` for `mentor`.
  - `src/app/dashboard/seasons/page.tsx:109` sets `canManage = ["admin", "coach", "mentor"].includes(...)`, while `functions/src/routes/seasons.ts:191,200,209` gates `/api/seasons/admin` and `/api/awards/admin` with `ensureAdmin` (`admin | coach`).
  - `src/app/dashboard/outreach/page.tsx:60-108` and `src/app/dashboard/sponsors/page.tsx:49-100` lack client role gates altogether and immediately fire admin API requests on mount while their backend routers enforce `admin | coach` (`functions/src/routes/tournaments.ts`, `outreach.ts`, `sponsors.ts` share the same boundary).
- **Affected Behavior / Trigger:** An authenticated user with role `mentor` navigates to `/dashboard/tournaments`, `/dashboard/seasons`, `/dashboard/outreach`, or `/dashboard/sponsors` from the sidebar or `Ctrl+K` palette.
- **Impact:** Mentors are shown dead-end dashboard routes that immediately fail with `403` permission errors.
- **Remediation:** Move `tournaments`, `seasons`, `outreach`, and `sponsors` to `isAdminOrCoach` / `ADMIN_COMMAND_ITEMS` in `DashboardSidebar.tsx` and `CommandPalette.tsx` (or update backend policy explicitly if mentors are intended to manage them) and add matching client role guards on the four pages.
- **Acceptance Test:** Component tests verifying a signed-in `mentor` does not see admin/coach-only tabs in sidebar/palette and sees an explicit permission notice if visiting those URLs directly.

### FA-05 — CSV Formula Injection in `/dashboard/portfolio` Export
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `src/app/dashboard/portfolio/page.tsx:129-134` defines a local `escapeCsvCell(value)` that only quotes commas/quotes/newlines without neutralizing leading `=`, `+`, `-`, `@`, `\t`, or `\r` (unlike `src/lib/outreachExport.ts` and other CSV exporters).
  - `src/app/dashboard/portfolio/page.tsx:404-430` writes `section`, `status`, `ownerNickname`, `title`, and `summaryNotes` through that unguarded helper.
- **Affected Behavior / Trigger:** A portfolio page `title`, `summaryNotes`, or `ownerNickname` starting with `=CMD(...)` or `+1` is exported via CSV and opened in Excel/LibreOffice Calc.
- **Impact:** Spreadsheet formula injection when coaches/students export portfolio status tables.
- **Remediation:** Replace the local `escapeCsvCell` helper with the repo's shared formula-neutralizing CSV cell helper (`'` prefix before `[=+\-@\t\r]`).
- **Acceptance Test:** Unit test exporting `=HYPERLINK(...)`, `+SUM(1,2)`, `\t=1` payloads and verifying leading single-quote neutralization.

### FA-06 — Unlayered `.clipped-button` CSS Overrides Tailwind Utilities & Permits Low-Contrast Hover
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `src/app/globals.css:83-122` defines `.clipped-button` and `.clipped-button-sm` outside `@layer components`, giving them higher cascade precedence than Tailwind v4 `@layer utilities` (`bg-ares-gold`, `bg-white/10`, `text-obsidian`, `text-ares-gold`).
  - Callers such as `src/app/robots/[id]/page.tsx:108,128,138` apply utility overrides (`bg-ares-gold/15 text-ares-gold`, `bg-white/10 text-white`, `bg-ares-gold text-obsidian`), which get forced back to `background: var(--ares-red); color: white;`.
  - Lines `118-122` exclude `hover:text-*` callers (`hover:text-ares-gold`, `hover:text-white`), leaving `white` / `ares-gold` on `--ares-bronze` (`#CD7F32`) at ~`3.14:1` contrast (below WCAG `4.5:1`).
- **Affected Behavior / Trigger:** Viewing or hovering secondary/gold `.clipped-button` actions on `/robots/[id]`, `/robots`, or `/`.
- **Impact:** Intended ghost/gold CTA visual hierarchy is broken by red override, and hover states fail WCAG 2.2 AA text contrast.
- **Remediation:** Wrap `.clipped-button` / `.clipped-button-sm` inside `@layer components` (using `--ares-on-bright-accent` for bronze hover) or migrate variant styling to the shared `<Button>` primitive.
- **Acceptance Test:** Playwright computed-style & contrast check across `/`, `/robots`, and `/robots/[id]` in both rest and hover states.

### FA-07 — Incomplete `@media print` Isolation Across Public & Dashboard Printable Sheets
- **Severity & Confidence:** `P1 High` — `Confirmed Defect`
- **Evidence:**
  - `src/app/globals.css:269-286` isolates only `.outreach-report-print` and `.tournament-match-print` under `@media print`.
  - `src/components/Navbar.tsx:66-72`, `src/components/Footer.tsx`, and dashboard sidebar/chrome lack `print:hidden`.
  - Consequently, printable views in `src/app/robots/[id]/page.tsx:153-160` (Judge / Pit Sheet), `src/app/sponsors/SponsorFactSheetSection.tsx:105-145` (Team & Sponsor Fact Sheet), `src/app/dashboard/users/components/TravelReadinessPanel.tsx:166-207` (Emergency Travel Binder), and `src/app/dashboard/portfolio/page.tsx:1212-1240` (Judge Handout / Control Award Sheet) print alongside fixed dark navbars, footers, email rosters, and surrounding UI chrome.
- **Affected Behavior / Trigger:** Invoking `Print` on any of those four sheets.
- **Impact:** Cluttered or illegible judge handouts and emergency travel binders leaking surrounding tables (e.g., `/dashboard/users` Email Roster) onto printed pages.
- **Remediation:** Add `print:hidden` on global navigation/footer/banner/dashboard chrome and generalize `@media print` isolation in `globals.css` (e.g. a shared `.ares-print-sheet` class or explicit selectors for all printable sheets).
- **Acceptance Test:** Playwright `@media print` emulation check verifying navbar, footer, and sibling dashboard cards are hidden when each printable sheet is active.

### FA-08 — Live `/sponsors` Zulip Logo Uses GitHub HTML `/blob/` URL Blocked by `img-src` CSP
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - Live `GET https://aresfirst.org/api/sponsors` returns for `id: "zulip"`: `"logoUrl": "https://github.com/zulip/zulip/blob/main/static/images/logo/zulip-icon-circle.svg"`.
  - `firebase.json:53` sets `img-src` without `https://github.com` (only `'self' blob: data: https://api.dicebear.com ...`), and `/blob/` is an HTML GitHub viewer page rather than an image asset.
  - Headless browser inspection of `https://aresfirst.org/sponsors` recorded `net::ERR_FAILED (csp)` on the Zulip logo request.
- **Affected Behavior / Trigger:** Any visitor loading `/sponsors`.
- **Impact:** Zulip sponsor card fails CSP image policy and renders without its logo in production.
- **Remediation:** Upload the official SVG/PNG Zulip logo via `/dashboard/sponsors` Managed Logo Upload (so it serves cleanly from `/api/sponsors/:id/logo` on `'self'`), or replace the record URL rather than broadening CSP to `github.com`.
- **Acceptance Test:** Visit `https://aresfirst.org/sponsors` after updating the sponsor asset and verify `naturalWidth > 0` with zero CSP `img-src` errors.

### FA-09 — `index.html` & Prerendered Home Fallback Still Advertise Stale `"ARES Analytics"` Name
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `index.html:30-38` and built `dist/index.html:42-49` render `<h2 id="analytics-product-heading">ARES Analytics</h2>`, locked by `src/test/prerenderShells.test.ts:42-47` (`expect(bodyText(home)).toContain("ares analytics")`).
  - Live browser inspection confirms `/` (`src/app/page.tsx`), `/privacy`, and `/terms` present `"ARES Robotics Studio"`.
- **Affected Behavior / Trigger:** Search crawlers or non-JS pre-hydration views reading the root HTML shell.
- **Impact:** Brand and Google OAuth product-verification mismatch between static prerendered HTML and live React content.
- **Remediation:** Update `index.html` and `src/test/prerenderShells.test.ts` to reference `"ARES Robotics Studio"` consistently.
- **Acceptance Test:** `pnpm run build && pnpm run test:coverage` with `prerenderShells.test.ts` asserting `"ares robotics studio"`.

### FA-10 — Unsanitized Zulip Mentions/Markdown in `POST /api/tasks/notify` & Onshape `@` Bypass
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/tasks.ts:65-97` (`POST /api/tasks/notify`) interpolates `title`, `description`, `priority`, `subteam`, `status`, and `dueDate` straight into `sendZulipMessage` with zero escaping, whereas `POST /api/tasks/comment` (`line 55`) strips `@**...**`, `@all`, and `@everyone`.
  - `functions/src/lib/onshape.ts:29-32` (`sanitizeOnshapeText`) strips Markdown metacharacters `[[\]()`*_~>#]` but leaves `@` intact, allowing `@all`/`@everyone` pings through Onshape relay metadata.
- **Affected Behavior / Trigger:** Any team member submitting a task title/description with `@all` or `[link](https://...)`, or an Onshape event with `@all` in `userName`/`documentName`.
- **Impact:** Unauthorized stream-wide pings or spoofed Markdown links under the team Zulip bot identity.
- **Remediation:** Apply shared inline escaping (`@` -> `@\u200B` + Markdown escaping) to all untrusted strings in `POST /api/tasks/notify` and `sanitizeOnshapeText`.
- **Acceptance Test:** Vitest tests in `tasks` and `onshape` verifying `@all`, `@everyone`, and `[phish](https://evil.example)` are neutralized before `sendZulipMessage`.

### FA-11 — Soft-Delete Pagination Cursor Stall & Short Pages in `photos.ts`, `albums.ts`, and `videos.ts`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/photos.ts:186-226` (`GET /api/photos/public`) queries `.limit(limit + 1)` per album chunk and computes `hasMore: candidates.length > limit || snapshots.some((s) => s.docs.length > limit)` while setting `nextCursor: page.length ? page[page.length - 1].id : null`. When `limit + 1` consecutive docs in a chunk are archived (`isDeleted === 1`), `hasMore` is `true` while `page` is empty (`photos: []`) and `nextCursor` is `null`.
  - `functions/src/routes/photos.ts:146-153` (`GET /api/photos`) and analogous `.limit(limit + 1)` endpoints in `albums.ts` and `videos.ts` lack bounded cursor-advancing scan loops.
- **Affected Behavior / Trigger:** Archiving `limit` consecutive newest photos/albums/videos and requesting page 1 or iterating cursors.
- **Impact:** Public gallery and media admin pagination returns empty pages or stalls (`nextCursor: null` with `hasMore: true`).
- **Remediation:** Port the bounded scan loop pattern from `outreach.ts:95-158` (advancing `scanCursor` past archived chunks) or query `where("isDeleted", "==", 0)` directly with composite indexes when `!includeArchived`.
- **Acceptance Test:** Route test seeding 30 archived photos ahead of 5 active public photos, verifying `GET /api/photos/public?limit=24` returns/reaches all 5 active items.

### FA-12 — Unbounded Lower `limit` Query Param (`-1` / `0`) on `GET /api/inquiries` & `GET /api/outreach`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/inquiries.ts:147,150`: `const limitVal = Math.min(parseInt(req.query?.limit as string) || 50, 100);` then `.limit(limitVal + 1)` — `limit=-1` calls `.limit(0)`, throwing a Firestore error (`500`).
  - `functions/src/routes/outreach.ts:76,96,136-158`: same formula causes `while (validDocs.length < limitVal + 1 ...)` to exit immediately when `limit=-1` (`0 < 0` false), returning `{ logs: [], hasMore: true, nextCursor: null }`.
- **Affected Behavior / Trigger:** Requesting `?limit=-1` (or `limit=-2`) against `/api/inquiries` or `/api/outreach`.
- **Impact:** Unhandled `500` on admin inquiries or bogus empty/infinite pagination state on public outreach.
- **Remediation:** Clamp with `Math.max(1, Math.min(..., 100))` consistent with `parseLimit` in `photos.ts`/`videos.ts`.
- **Acceptance Test:** Unit tests calling `?limit=-1` and `?limit=0` on both endpoints and asserting `200` with `>= 1` clamped limit.

### FA-13 — Unpaginated `.limit(...)` Queries Truncate Travel Readiness & Team/About Rosters at Scale
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/profileAdmin.ts:722-735` (`loadActiveTravelRoster`, used by `GET /admin/travel-readiness` and `POST /admin/travel-readiness/reveal`) reads `authorized_users` with `.orderBy(FieldPath.documentId()).limit(200)` with no cursor pagination before filtering out deleted/unverified accounts.
  - `functions/src/routes/profileRoster.ts:142-150,241-244` queries `user_profiles` `.limit(100)`/`.limit(300)` and `authorized_users` `.limit(500)` without cursor pagination.
- **Affected Behavior / Trigger:** Accumulation of >200 historical/archived `authorized_users` docs (e.g., alumni/past seasons) or >100 `user_profiles` docs.
- **Impact:** Active students/mentors whose UIDs sort after doc `#200` are silently dropped from Coach Emergency Travel Binders and rosters.
- **Remediation:** Paginate in bounded batches using `startAfter` up to an explicit fail-closed safety ceiling (matching `profileEmailRoster.ts`).
- **Acceptance Test:** Unit test seeding 205 `authorized_users` docs (150 archived + 55 active) verifying all 55 appear in `travel-readiness` and `reveal`.

### FA-14 — Unvalidated `taskId` in Zulip Inbound Webhook Causes HTTP `500` Firestore Ref Crash
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/webhooks.ts:264-272` strips `"Task-"` (`topic.replace("Task-", "").trim()`) and calls `adminDb.collection("tasks").doc(taskId).get()` without matching `/^[A-Za-z0-9_-]{1,160}$/` (contrast `tasks.ts:22,27`).
- **Affected Behavior / Trigger:** Authenticated Zulip webhook message in topic `"Task-"` (empty ID) or `"Task-foo/bar"` (nested slash path).
- **Impact:** `adminDb.collection("tasks").doc("")` / invalid path throws an exception (`500`), triggering repeated Zulip webhook retries.
- **Remediation:** Strip prefix via `topic.slice("Task-".length).trim()`, validate against `/^[A-Za-z0-9_-]{1,160}$/`, and return `res.json({ content: "" })` silently if invalid.
- **Acceptance Test:** Webhook route test sending valid token with `"Task-"` and `"Task-a/b"` asserting `200 { content: "" }`.

### FA-15 — Selective CI Mismaps `src/app/dashboard/simulations/**` Under `public` Instead of `editor`
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - `infra/verification-areas.json:397` lists `"src/app/dashboard/simulations/**"` inside `areas.public.paths` instead of `areas.editor.paths`.
  - `src/app/dashboard/simulations/page.tsx:6-7` mounts `<SimManager />` and `<SimulationPlayground />` (`editor` area). `scripts/affected-areas.mjs` only propagates forward (`editor -> public`), not reverse.
- **Affected Behavior / Trigger:** PR touching only `src/app/dashboard/simulations/page.tsx`.
- **Impact:** Selective CI runs `public` tests (`public-routes.spec.ts`, `championship.spec.ts`) and skips `e2e/editor.spec.ts` and Simulation IDE unit suites. *(Minor note: `src/lib/biobuzzOnline.ts` is unmapped in `areas.biobuzz.paths`, safely falling back to `full: true`.)*
- **Remediation:** Move `"src/app/dashboard/simulations/**"` into `areas.editor.paths` in `infra/verification-areas.json`.
- **Acceptance Test:** Update `scripts/affected-areas.test.mjs` verifying `src/app/dashboard/simulations/page.tsx` selects `editor` and `e2e/editor.spec.ts`.

### FA-16 — Upstream ARES Monorepo Version Drift (`7.0.74 -> 7.0.75`) & Stale `9.3.6` Placeholder
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - Executing `pnpm run content:verify` failed: `ARES monorepo studioVersion changed: catalog declares 7.0.74, main declares 7.0.75.`
  - `src/components/dashboard/LearningMetadataFields.tsx:81` still uses hardcoded `placeholder="e.g. ARES 9.3.6"`.
- **Affected Behavior / Trigger:** Running Academy upstream provenance check or creating a new lesson draft in `/dashboard/academy` / `/dashboard/areslib`.
- **Impact:** `content:verify` fails until an official ARES version refresh PR bumps catalog provenance cleanly (under the owner's standing ARES refresh policy); authors see outdated version placeholder copy.
- **Remediation:** Inspect the upstream `7.0.74 -> 7.0.75` Studio diff via `scripts/migrate-learning-content.mjs`, update catalog/provenance per `aresweb-ast-migration`, and update the placeholder in `LearningMetadataFields.tsx`.
- **Acceptance Test:** `pnpm run content:verify && pnpm run content:release-validate` both pass with exit `0`.

### FA-17 — Public Accessibility Semantics, Micro-Text (`5px`–`8px`), and Sub-`4.5:1` Contrast
- **Severity & Confidence:** `P2 Medium` — `Confirmed Defect`
- **Evidence:**
  - Async loading/error states lack a semantic `<h1>` (and `src/app/blog/[slug]/page.tsx:100-106` spinner lacks `role="status"` / accessible text) across `src/app/blog/[slug]/page.tsx:100-138` (`PublicDataState` delegates to `AsyncState` `<h2>`), `src/app/academy/page.tsx:317-349,373-384`, and sibling `robots/[id]`, `events/[id]`, `tournaments`, and `tournaments/[id]` error states.
  - `src/app/calendar/page.tsx:475,514,526,532` skips `<h2> -> <h4>` (`line 475` to `line 526`) and renders `text-[5px]` (`line 514`) and `text-[8px]` (`line 532`); `src/components/Footer.tsx:482` renders `text-[8px]`.
  - Low-contrast muted copy on `#1A1A1A` obsidian (`text-marble/40` `~3.83:1` and `text-marble/45` `~4.29:1`, below `4.5:1`) in `src/app/academy/page.tsx:593,600` and sibling event/gallery/video/tournament components.
- **Affected Behavior / Trigger:** Screen-reader navigation during error states, keyboard/low-vision users reading timestamps, badges, and footer/sidebar captions.
- **Impact:** Degrades WCAG 2.2 AA heading hierarchy and readability.
- **Remediation:** Render `<h1>` for top-level error/empty fallbacks + `role="status"` on full-page spinners; fix `<h2> -> <h3>` in `calendar/page.tsx`; enforce `>= 10px` (prefer `text-xs`) micro-labels and `text-marble/60` (`>= 4.5:1`) for readable captions.
- **Acceptance Test:** Axe-core / Playwright accessibility checks covering error states, `/calendar`, `/academy`, and `/`.

### FA-18 — `portfolio.ts` Candidate Artifact Loader Queries Mismatched Collection Fields
- **Severity & Confidence:** `P3 Low` — `Confirmed Defect`
- **Evidence:**
  - `functions/src/routes/portfolio.ts:187` queries `adminDb.collection("tasks").where("status", "==", "done")` whereas `firestore.rules` enforces `completed` (`['todo', 'in_progress', 'review', 'completed']`).
  - `functions/src/routes/portfolio.ts:215-216` reads `data.season` & `data.cadUrl` instead of `seasonName` & `onshapeUrl`/`cadViewerUrl`.
  - `functions/src/routes/portfolio.ts:244-245` reads `data.impacted` instead of `peopleReached`.
- **Affected Behavior / Trigger:** Loading candidate portfolio artifacts via `GET /api/content-admin/portfolio/:seasonKey`.
- **Impact:** Portfolio candidate sidebar omits completed tasks, drops robot season/CAD metadata, and displays `0` community members reached for every outreach event.
- **Remediation:** Align field names in `loadCandidateArtifacts()` (`status == "completed"`, `seasonName`, `onshapeUrl || cadViewerUrl`, `peopleReached`).
- **Acceptance Test:** Route test seeding canonical `tasks`, `robots`, and `outreach_logs` docs asserting accurate candidate DTO output.

### FA-19 — Hardening Gaps: 4-Digit Self Check-In PIN & Unthrottled `sync-ftcscout` Quota
- **Severity & Confidence:** `P3 Low` — `Risk / Needs Reproduction`
- **Evidence:**
  - `functions/src/routes/calendarManageRoutes.ts:428-432,459-488` issues a 4-digit PIN (`1000..9999`, 2-hour TTL) protected only by the router IP rate limiter (`120` req / 15 min) with no per-user or per-event failure counter/lockout.
  - `functions/src/routes/tournamentOperations.ts:516-525` (`POST /api/tournaments/:id/sync-ftcscout`, `ensureAdminOrCoach`) lacks a durable `distributedQuota` middleware before fetching `api.ftcscout.org`.
- **Affected Behavior / Trigger:** Authenticated team member guessing PINs across rotating IPs or multi-instance cold starts invoking `sync-ftcscout`.
- **Impact:** Possible self-attendance PIN guessing within 2 hours; unbounded outbound FTCScout bursts across cold starts.
- **Remediation:** Add a transactional per-`(eventId, uid)` PIN failure limit (e.g., 5 attempts) or longer PIN; wrap `sync-ftcscout` with `distributedQuota`.
- **Acceptance Test:** Test asserting 6th bad PIN attempt returns `429`/`403` even if IP changes or valid PIN follows; quota test on `sync-ftcscout`.

### FA-20 — Firestore Rules Direct-Write Schema Drift (`seasons`, `awards`, `robots`)
- **Severity & Confidence:** `P3 Low` — `Confirmed Risk`
- **Evidence:**
  - `firestore.rules:662-679` permits `admin`/`coach` client SDK writes on `seasons`/`awards` without field allowlists, `https://` checks, or `isDeleted` validation.
  - `firestore.rules:574-582` permits `admin`/`coach`/`mentor` client SDK writes on `robots` checking only `isDeleted` without URL allowlists enforced by `functions/src/routes/robots.ts`.
- **Affected Behavior / Trigger:** Authorized client SDK writing directly to Firestore instead of Express DTO endpoints (e.g., an admin tool writing Tiptap JSON or unsafe URL strings).
- **Impact:** Reduced defense-in-depth / schema drift (potentially contributing to `FA-01`).
- **Remediation:** Route all `seasons`, `awards`, and `robots` mutations through Express APIs (`allow create, update: if false;`) or tighten rule field/URL checks.
- **Acceptance Test:** Emulator rules test in `tests/rules/security.rules.test.ts` rejecting direct malformed client writes.

### FA-21 — Minor Defense-in-Depth: `BlogShareKitModal`, `SimPreviewFrame`, and Motion Preferences
- **Severity & Confidence:** `P3 Low` — `Confirmed Defect`
- **Evidence:**
  - `src/components/dashboard/BlogShareKitModal.tsx:64-67` calls `buildCanonicalBlogUrl`, `buildBlogShareCaption`, and `buildBlogWebShareIntents` outside the `try/catch` wrapping `renderInstagramSquareCardDataUrl`, so an invalid slug throws during render; `src/lib/blogShareKit.ts:98` interpolates `post.slug.trim()` directly into `buildInstagramCaption` rather than delegating to `buildCanonicalBlogUrl`.
  - `src/components/editor/SimPreviewFrame.tsx:33,54,85-87,97` lacks `event.origin === "null"`, `!Number.isFinite(...)` on `ARES_TELEMETRY`, shape/length bounds on `sim-test-result`, and a handler for `sim-fps`. (Sandbox itself remains isolated with `sandbox="allow-scripts"` only.)
  - Zero `<MotionConfig reducedMotion="user">` wrappers across Framer Motion pages; non-loading `animate-pulse` stragglers remain in minor UI elements (`EventHero`, `VideoPickerModal`, `OfflineIndicator`, `DesktopUserMenu`).
- **Impact:** Minimal security risk (sandbox is opaque), possible unhandled render exception on malformed draft slugs, and reduced-motion polish.
- **Remediation:** Guard `shareBundle` in `BlogShareKitModal` cleanly and reuse `buildCanonicalBlogUrl` slug validation; tighten `SimPreviewFrame` checks; wrap `App` in `<MotionConfig reducedMotion="user">`.
- **Acceptance Test:** Unit tests for invalid draft slug in `BlogShareKitModal.test.tsx` and malformed `NaN`/`sim-test-result` payloads in `SimPreviewFrame`.

### FA-22 — Tight Bundle Headroom, Legacy Re-Export Shims, & Live Production Hygiene Observations
- **Severity & Confidence:** `P3 Low` — `Confirmed`
- **Evidence & Observations:**
  1. **Tight Academy gzip headroom (`config/bundle-budgets.json:8-9`):** Measured `academyInteractiveJs` at `92,018 / 95,000` bytes gzip (`96.9%`, only `2,982 B` margin) and `largestAcademyInteractiveJs` (`feedforward-term-lab`) at `2,364 / 2,600` bytes gzip (`90.9%`, only `236 B` margin).
  2. **Legacy `src/` compatibility shims (`0%` test coverage / zero prod callers):** `src/lib/buzzleDefinitions.ts`, `src/lib/buzzleDictionary.ts`, `src/lib/buzzleWordHelp.ts`, and `src/lib/games/hexGrid.ts` have zero callers across the repo; `src/lib/{biobuzzScoring,buzzello,buzzle,buzzleAi}.ts` and `src/components/games/{BuzzleHelpMode,BuzzleWordHelp}.tsx` have only legacy test or `0%` coverage entries.
  3. **Live public `/api/content/posts` (`https://aresfirst.org/blog` & `/feed.xml`):** Serves a test article titled `"Testing permissions"` (`slug: "testing-permissions"`, `date: "2026-11-03"`, `"Testing update"`), likely left over from earlier permission testing. Note also that `/feed.xml` is the configured RSS URL (`index.html:8`, `200 application/rss+xml`), while `/rss.xml` returns `404` (nothing in repo links `/rss.xml`).
  4. **Cloudflare Edge + Strict CSP Console Errors:** Live `https://aresfirst.org/` HTML contains a Cloudflare edge inline `<script>` (`(function(){function c()...`) and `https://static.cloudflareinsights.com/beacon.min.js` which are cleanly blocked by the site's strict `script-src 'self' ...` CSP (resulting in benign browser console CSP warnings rather than weakened CSP).
  5. **Storage App Check Readiness:** `check-storage-app-check-observation.mjs` reports `READY_FOR_MANUAL_ENFORCEMENT_REVIEW` (`167.95h`, `0` direct Storage calls) and `inventory-media-references.mjs` shows `0` unresolved Storage/Firestore links—operators may proceed to manual Firebase Console review when ready.

---

## 5. Verified Clean Boundaries & Scope Limits
- **Verified Clean Controls:**
  - **Auth & Role Parity (`linkAuthorizedUserByEmail` & Archival):** `functions/src/middleware/auth.ts`, `robots.ts`, `tournaments.ts`, `profileSelf.ts`, and `profileSync.ts` consistently link invites by verified email and fail closed on unknown roles or `isDeleted: 1` records (preserving archived roles without mutating stored docs). Verified across `88` Functions test files (`1072` tests) + Firestore emulator tests (`10` tests).
  - **Zero-Trust Storage & Server-Mediated Collections:** `storage.rules` denies all direct browser reads/writes (`if false`), and all sensitive collections (`inquiries`, `user_profiles`, `event_checkin_codes`, `finance_transactions`, `tournaments`, `tournament_matches`, `sponsors`, `events`, `imported_photos`, `albums`, `videos`, `system_settings`, `waggle_gardens`, `studio_integration*`) lock direct browser writes cleanly (`41/41` emulator rules tests passing).
  - **Cryptography & Redacted Logging:** PII uses `AES-256-GCM` with `PBKDF2-SHA256`; student contact fields remain forced private; Emergency Travel Binder `reveal` requires `ensureAdmin` + writes redacted `audit_logs`; Dependabot reports `0` open alerts and `pnpm audit --prod` reports `0` vulnerabilities.
  - **Opaque-Origin Iframe Sandboxes & Cloud Run Game Services:** Both `SimPreviewFrame.tsx` and `/pollen` use `sandbox="allow-scripts"` only (never `allow-same-origin`). All 35 prerendered public shells build cleanly under bundle budgets, all GitHub Actions are SHA-pinned, and `16/16` live Cloud Run services match expected `ares-fp` deployment tracking (with both legacy `ares-analytics-gateway*` services external to this repo).
- **Explicit Scope & Evidence Limits:**
  - This audit stopped strictly short of application edits, deployments, or production mutations.
  - `pnpm run test:e2e` (the 30 Playwright browser specs across isolated shards) was **not** executed in this read-only run; live browser checks covered `15` unauthenticated desktop routes (`1440x900`) and `6` mobile routes (`320x640`) on `https://aresfirst.org`.
  - Authenticated `/dashboard/*`, `/tasks`, and `/tournaments/*` runtime flows were evaluated via source inspection and mocked Vitest suites (`313` files / `2113` tests), not interactive authenticated browser sessions on live production.
  - Because portions of this audit relied on automated checks and static inspection rather than full assistive-technology testing or authenticated runtime pentesting, this report does **not** claim complete security, zero remaining bugs, or full WCAG 2.2 AA conformance.
