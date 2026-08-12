# ARESWEB Comprehensive Audit Scorecard

**Date:** 2026-08-12

**Auditor:** Codex, with staged specialist audit passes

**Revision:** `7c2e0bfcde9bef8dfd08d15878391c02d4d2320e` (`master`)
**Scope:** Vite/React frontend, Firebase Functions, Firestore and Storage rules,
CI/CD, PWA, accessibility, privacy, SEO, tests, repository hygiene, orphaned
code, documentation, and the audit protocol itself.

> Remediation status: this report records findings at the audited revision.
> Changes on `codex/audit-remediation` remediate the confirmed high-severity
> defects and much of the medium/low debt. The complete local verification gate
> is recorded in `2026-08-12-release-readiness.md`; nothing in that verification
> means the branch has been deployed. The tables below remain the historical
> baseline used to verify the remediation rather than a claim about current code.

## Executive assessment

**Overall grade: C-**

The portal has strong foundations: verified Firebase tokens, explicit DTOs on
many public APIs, bounded cleanup jobs, immutable release artifacts, OIDC-based
deployment, emulator tests, cross-browser E2E, and a successful production
deployment from the audited revision. Those controls are real and worth
preserving.

The site is not yet safe to describe as fully secure, WCAG-conformant, or
technically clean. No confirmed critical vulnerability was found, but several
high-severity boundaries need attention:

1. Membership authorization accepts every role except the literal string
   `unverified` and does not consistently reject archived users.
2. Inquiry approval writes a student's legal name and contact data to
   `user_profiles` before encryption.
3. Retired telemetry/upload/replay infrastructure is still deployed, including
   a 50 MB body parser and placeholder success responses.
4. The TypeScript lint gate is effectively inert, and coverage/test composition
   creates several false-green signals.
5. Important keyboard, focus, contrast, and simulation-accessibility barriers
   contradict the site's public perfect-accessibility claim.
6. Academy failures are presented as empty content; simulation save/library
   behavior does not match its UI contract; and unsupported AI/API controls are
   exposed or advertised.
7. PWA precaching, original-size gallery images, stale repositories/scripts,
   and an approximately 883 MiB packed Git history create material efficiency
   and maintenance debt.
8. Search crawlers receive generic client-only metadata and HTTP-200 soft 404s;
   the live sitemap includes 18 obvious test/WIP records.

The audit protocol is useful as a framework but must be updated before the next
audit. Its 12-pillar structure should remain; several implementation rules are
stale, contradictory, or unsafe.

## Scorecard

| Pillar | Grade | Critical item summary |
| --- | :---: | --- |
| 1. Security | C | Membership is a denylist; task identity can be spoofed; App Check remains documented as observation-only. |
| 2. Privacy & Youth Protection | C- | Student profile PII is written plaintext during inquiry approval; public/raw-data boundaries remain. |
| 3. Accessibility | D | Five high keyboard/focus/interaction findings; the public perfect-AIM claim is unsupported. |
| 4. Style & Brand | C | Core pages are consistent, but raw colors, cyan misuse, red-on-dark contrast, and nomenclature drift are widespread. |
| 5. Efficiency | C | 5.19 MB PWA precache, original-size gallery cards, over-reading queries, and duplicate profile requests. |
| 6. Refactoring | D+ | Confirmed dead modules, duplicate utilities, 20 large production files, and obsolete executable scripts. |
| 7. Portability | C | Frontend/backend boundaries are mostly clean, but MCP, CDN editor assets, and old absolute/retired-stack guidance are brittle. |
| 8. Functionality | D+ | Academy false-empty states, broken simulation save semantics, role-mismatched AI controls, and inaccurate Developer API UI. |
| 9. Testing | D+ | Strong test volume, but narrow denominators, middleware-bypassing route tests, weak E2E auth, incomplete rules coverage, and no MCP tests. |
| 10. Architecture | C- | Good Express composition and DTO work coexist with retired routers, monolithic secret binding, and duplicated authorization semantics. |
| 11. DevOps & Hygiene | C | Strong OIDC artifact deployment, but inert linting, repository artifacts, stale GSD/docs, and inactive hook systems. |
| 12. Scalability & Resilience | C | Bounded cleanup is good; public gallery reads, PWA install cost, secret coupling, and deployment health polling need work. |

## 1. Security

### Strengths

- Firebase ID tokens are verified with Admin Auth, and privileged roles are
  looked up server-side (`functions/src/middleware/auth.ts:10-50`).
- Large upload authentication occurs before body allocation
  (`functions/src/index.ts:84-104`).
- Public inquiries use rate limiting and reCAPTCHA; route errors normally flow
  through `asyncHandler`, `ApiError`, and `globalErrorHandler`.
- The simulation iframe remains opaque-origin and validates message sources.
- Production deployment uses GitHub OIDC/Workload Identity Federation and a
  verified release artifact rather than a service-account JSON key.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| SEC-01 | HIGH | Member access accepts any role other than `unverified`; unknown roles and archived authorization records can retain member access. | `functions/src/middleware/auth.ts:55-72`, `firestore.rules:15-25`, `storage.rules:5-13` |
| SEC-02 | MEDIUM | Task/Zulip author identity and content are partly client supplied, allowing spoofed attribution and avoidable youth-name exposure. | `functions/src/routes/tasks.ts:21-39`, `functions/src/routes/webhooks.ts:65-75`, `firestore.rules:103-108` |
| SEC-03 | MEDIUM | App Check is fail-open unless `ENFORCE_APP_CHECK=true`; the operations guide still documents an observation-only rollout. | `functions/src/middleware/appCheck.ts:106-127`, `docs/SECURITY_OPERATIONS.md:46-92` |
| SEC-04 | MEDIUM | Public raw robot/field documents and public active-content uploads expand future data-leak and content-hosting risk. | `firestore.rules:170-176,190-194`, `functions/src/routes/simulations.ts:440-447`, `storage.rules:20-33,45-50` |
| SEC-05 | MEDIUM | One Express function receives all integration secrets, increasing blast radius and redeployment coupling. | `functions/src/index.ts:153-179` |

## 2. Privacy & Youth Protection

### Strengths

- Inquiry submissions normally encrypt name, email, and metadata before storage.
- `user_profiles`, settings, audits, and media management are server-only in
  Firestore; many public routes return explicit minimized DTOs.
- Inquiry cleanup uses batches of 400, below Firestore's 500-write limit.
- Public profiles constrain avatar and nickname surfaces.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| PRI-01 | HIGH | Inquiry approval writes `firstName`, `lastName`, and `contactEmail` plaintext; encryption happens only if the profile is later loaded. | `functions/src/routes/inquiries.ts:351-378`, `functions/src/routes/profileSelf.ts:166-215` |
| PRI-02 | MEDIUM | Public/direct comment paths can persist full names or client-supplied author labels rather than verified nicknames. | `functions/src/routes/tasks.ts:21-39`, `functions/src/routes/webhooks.ts:65-75` |
| PRI-03 | MEDIUM | The public repository contains an unreviewed 89 MB community-chat video. The repository is public, so the media needs immediate content/retention review for youth or third-party PII. | `Community Chat…mp4` |
| PRI-04 | MEDIUM | Raw-document public reads will expose future private fields automatically unless migrated behind DTO APIs. | `firestore.rules:170-176,190-194` |

## 3. Web Accessibility

### Strengths

- A shared skip link transfers focus to one shared main landmark.
- Reduced-motion styles are global.
- Newer flows often use Radix Dialog and explicit live/error regions.
- Focus-trap and shared UI accessibility tests exist and the focused suites
  reviewed during this audit passed.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| A11Y-01 | HIGH | The closed mobile docs drawer remains tabbable off screen and lacks complete dialog/disclosure semantics. | `src/components/docs/DocsSidebar.tsx:79-191` |
| A11Y-02 | HIGH | The event photo lightbox renders outside the active editor focus trap and has no nested-modal behavior. | `src/app/dashboard/events/components/EventEditorDrawer.tsx:111-128,398-416` |
| A11Y-03 | HIGH | Two event-photo upload inputs use `display:none`; the styled labels are mouse-only. | `src/components/events/EventGallery.tsx:37-55`, `src/app/dashboard/events/components/EventGalleryTab.tsx:32-45` |
| A11Y-04 | HIGH | Many canvas/SVG simulations expose pointer-only interaction without keyboard/native-control equivalents or nonvisual state. | `src/sims/auto/index.tsx:85-112,221`, `src/sims/physics/index.tsx:217-269`, `src/sims/bee/index.tsx:585-723` |
| A11Y-05 | HIGH | The public claim of a perfect 10.0 AIM score and zero WAVE/pa11y errors is unsupported; pa11y is absent from package scripts and CI. | `src/app/accessibility/page.tsx:60-69,113-124`, `.pa11yci.cjs:12-31` |
| A11Y-06 | MEDIUM | Missing names/live semantics remain in AI chat and attendance controls. | `src/components/simulation/AiChatPanel.tsx:26-74`, `src/components/events/EventRsvps.tsx:174-184` |
| A11Y-07 | MEDIUM | Known 2.69:1 red-on-dark text and weak red-only focus indicators remain widespread. | `src/components/events/EventRsvps.tsx:81`, `src/app/join/page.tsx:236`, `src/components/PhotoPickerModal.tsx:193` |
| A11Y-08 | MEDIUM | Custom focus trapping is incomplete and conflicts with newer Radix dialogs. | `src/lib/useFocusTrap.ts:21-46` |
| A11Y-09 | MEDIUM | SPA route changes are not announced and do not apply a deliberate focus policy. | `src/components/layout/LayoutWrapper.tsx:9-28` |
| A11Y-10 | MEDIUM | Custom tab widgets declare ARIA tabs without keyboard, ID, or panel relationships. | `src/app/dashboard/photos/page.tsx:357-372`, `src/app/dashboard/events/components/EventEditorDrawer.tsx:162-215` |

## 4. Style & Brand

### Strengths

- Core pages mostly use the named ARES palette and League Spartan/Inter.
- Generic Tailwind color scales were not found in production source.
- The canonical production identity is centralized.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| BRD-01 | MEDIUM | Production source contains hundreds of raw hex values, concentrated in simulations, without an approved scientific/visualization exception palette. | Representative: `src/sims/battleship/index.tsx:457,539-544`, `src/sims/bee/index.tsx:45-49` |
| BRD-02 | MEDIUM | `ares-cyan`, documented as a focus indicator, is used extensively as ordinary text/border/icon color. | Representative: `src/app/store/page.tsx:77-85` |
| BRD-03 | MEDIUM | Visible and metadata copy does not consistently use the team's `FIRST®` nomenclature. | Representative: `index.html:9`, `src/app/tech-stack/page.tsx:13`, `src/components/FAQSchema.tsx:39-55` |
| BRD-04 | MEDIUM | The accessibility protocol attempts to preserve brand colors by evading contrast scanners rather than using compliant tokens. | `.agents/skills/aresweb-web-accessibility/SKILL.md:37-38`, `docs/conventions/06-accessibility.md:29-35` |

## 5. Code Efficiency

### Strengths

- Public and dashboard routes are lazy-loaded, and simulation components use
  generated lazy imports.
- Hashed assets receive immutable caching.
- API traffic is excluded from service-worker fallback/runtime caching.
- Reviewed timers, listeners, object URLs, and subscriptions generally clean up.
- Current bundle budgets pass: initial JS 703,874 raw / 220,936 gzip; initial
  CSS 164,065 / 21,512 gzip; largest lazy chunk 2,753,786 / 717,900 gzip.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| PERF-01 | HIGH | Workbox precaches 162 entries / about 5.19 MB raw, including nearly every lazy page/simulation and unused images, defeating route-level lazy loading on first install. | `vite.config.ts:39-52`, generated `dist/sw.js` |
| PERF-02 | HIGH | Monaco is simultaneously local, externalized, manually chunked, and loaded from a mismatched jsDelivr version that production CSP blocks; preview also requests CDN scripts. | `package.json:34`, `vite.config.ts:70-90`, `src/components/editor/LazyMonacoEditor.tsx:7-24`, `src/components/editor/SimPreviewFrame.tsx:154-162,288-292` |
| PERF-03 | HIGH | Gallery cards download original uploads of up to 8 MB because no responsive derivatives are generated. | `functions/src/routes/photosUpload.ts:57-59,131-149`, `src/app/gallery/page.tsx:218-220,274-276` |
| PERF-04 | MEDIUM | Public gallery can read 250 photos to return a 24-item page after in-process filtering. | `functions/src/routes/photos.ts:114-151` |
| PERF-05 | MEDIUM | The bundle gate measures initial assets and only one largest lazy file, not aggregate route or PWA costs. | `scripts/check-bundle-size.mjs:29-49` |
| PERF-06 | MEDIUM | Fourteen external Google font faces are requested. | `index.html:20-22` |
| PERF-07 | MEDIUM | `/api/profiles/me` is fetched independently by always-mounted and feature-specific consumers despite a shared QueryClient. | `src/components/dashboard/DashboardSidebar.tsx:62-88`, `src/app/dashboard/events/hooks/useEventEditor.ts:120-140` |

## 6. Refactoring Needs and Orphaned Code

### Strengths

- Route pages and generated simulation imports were explicitly traced and are
  live; they were not misclassified as orphaned merely because they are dynamic.
- Core shared DTO, error, and Firebase helpers already exist.

### Confirmed orphan/debt inventory

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| DEBT-01 | HIGH | Retired telemetry/upload/replay code remains deployed with a 50 MB parser, database/storage permissions, placeholder endpoints, mocks, and an unused client hook. | `functions/src/index.ts:84-112`, `functions/src/routes/upload.ts`, `functions/src/routes/replay.ts`, `src/hooks/scope/useAutoLogSync.ts`, `firestore.rules:128-130`, `storage.rules:40-43` |
| DEBT-02 | HIGH | Fifteen executable scripts still target retired Cloudflare/Hono/D1/R2/Drizzle paths and can mislead or mutate obsolete state. | Representative: `scripts/autonomous_setup.mjs:13-32`, `scripts/clear-rate-limits.ts:1-30`, `scripts/restore_docs.mjs:3-24` |
| DEBT-03 | HIGH | Current tree contains an unreferenced 89 MB MP4 and 2.6 MB of Playwright trace artifacts; Git history is about 882.90 MiB packed. | root MP4, `data/`, `.git` object inventory |
| DEBT-04 | MEDIUM | `.planning/` and `planning/` contain 320 GSD files (35.6% of 900 tracked files); only the bundle baseline is actively referenced. | `.planning/`, `planning/`, `scripts/check-bundle-size.mjs:6` |
| DEBT-05 | MEDIUM | Confirmed dead modules include `CodeBlock`, cart store, duplicate storage keys, backend site config, telemetry hook, and starter public SVGs. | `src/components/docs/CodeBlock.tsx`, `src/store/useCartStore.ts`, `src/lib/storageKeys.ts`, `functions/src/lib/site-config.ts`, `public/{file,globe,next,vercel,window}.svg` |
| DEBT-06 | MEDIUM | `src/lib/security.ts` and `src/utils/security.ts` are byte-identical but both imported; storage-key copies are also identical. | `src/lib/security.ts`, `src/utils/security.ts`, `src/lib/storageKeys.ts`, `src/utils/storageKeys.ts` |
| DEBT-07 | MEDIUM | `greatbee` and `untitled` simulation sources are byte-identical, while registry JSON and generated imports disagree. | `src/sims/greatbee/index.tsx`, `src/sims/untitled/index.tsx`, `src/sims/simRegistry.json:88,304`, `src/components/generated/sim-registry.ts:58` |
| DEBT-08 | MEDIUM | Twenty production files exceed 500 lines, including profiles, document editor, tasks, Academy, and events; simulations combine engines and presentation. | `functions/src/routes/profiles.ts`, `src/components/dashboard/DocFormDrawer.tsx`, `src/app/dashboard/tasks/components/TaskDetailsModal.tsx` |
| DEBT-09 | MEDIUM | Production contains at least 72 explicit `any` patterns at external/admin boundaries. | Representative: `functions/src/routes/upload.ts:77-81`, `functions/src/routes/profiles.ts:417`, `src/components/PhotoPickerModal.tsx:125,348,423` |
| DEBT-10 | LOW | Confirmed unused direct dependencies include root `vaul` and MCP `zod`/`zod-to-json-schema`; Functions `@emnapi/*` needs package-runtime confirmation before removal. | `package.json`, `mcp-server/package.json`, `functions/package.json` |

## 7. Code Portability

### Strengths

- Frontend and Functions import boundaries are mostly separated.
- Primary browser API calls use relative `/api/*` paths.
- Firebase service domains are distinguished from the canonical public domain.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| PORT-01 | HIGH | MCP defaults to a production OpenAPI URL that returns 404; every documented `ai-tools` endpoint also returns 404. | `mcp-server/src/index.ts:322-328`, `mcp-server/README.md:43-138` |
| PORT-02 | MEDIUM | MCP README embeds a developer-specific absolute Windows path and documents Claude/ChatGPT endpoints not implemented by the current backend. | `mcp-server/README.md:30-59` |
| PORT-03 | MEDIUM | Editor operation depends on jsDelivr while CSP excludes it, producing environment-specific behavior. | `src/components/editor/LazyMonacoEditor.tsx:7-24`, `firebase.json:33-34` |
| PORT-04 | MEDIUM | Local hooks are split between undocumented `.githooks` and an uninstalled Husky file; neither is active in this clone. | `.gitconfig:1`, `.githooks/`, `.husky/pre-commit`, `package.json` |

## 8. Functionality

### Strengths

- Important public management pages preserve explicit loading, empty, and error
  states, especially inquiries, tasks, photos, sponsors, and outreach.
- Store and leaderboard unavailable states are honest rather than fake-success
  implementations.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| FUN-01 | HIGH | Academy/ARESLib Firestore failures become “No Lessons Yet” or a blank slug view; generated `/academy/playground` share links rely on an undocumented Firestore record. | `src/app/academy/page.tsx:86-144,383-401`, `src/hooks/useSimulationActions.ts:81-88` |
| FUN-02 | HIGH | “Your Saved Simulations” duplicates the official registry; Save ignores the simulation name and writes the first/default file to a colliding repository path. | `src/hooks/useSimulationFiles.ts:74-109`, `src/hooks/useSimulationActions.ts:42-70`, `functions/src/routes/simulations.ts:247-322` |
| FUN-03 | HIGH | AI controls appear for roles that every AI route rejects; UI edit capability and server AI capability are inconsistent. | `functions/src/routes/ai.ts:19-59`, `src/app/dashboard/tasks/components/TaskDetailsModal.tsx:269-284,526-535`, `src/app/dashboard/events/components/EventEditorDrawer.tsx:331-347` |
| FUN-04 | HIGH | Indexed Developer API UI advertises PAT generation, a TBA proxy, and an interactive explorer, while only Firebase tokens exist and OpenAPI is explicitly unpublished. | `src/app/developer-api/page.tsx:23-117`, `functions/src/index.ts:129-146` |
| FUN-05 | MEDIUM | Task/Zulip failures and replay fallback paths can return HTTP 200 with `{success:false}` or degraded mock output. | `functions/src/routes/tasks.ts:35-39,77-81`, `functions/src/routes/replay.ts:347-350` |
| FUN-06 | MEDIUM | Accessibility/privacy copy promises mandatory AI alt text, while common and event upload paths explicitly disable AI labeling. | `src/app/accessibility/page.tsx:49-52`, `src/app/privacy/page.tsx:69-79`, `src/hooks/usePhotoUpload.ts:23-33` |
| FUN-07 | MEDIUM | Store, leaderboard, and placeholder Developer API pages are promoted in navigation/sitemap despite unavailable or placeholder status. | `src/components/Navbar.tsx:131-138`, `functions/src/routes/sitemap.ts:18-31` |
| FUN-08 | LOW | Two dashboard backgrounds request missing `/favicon.ico`. | `src/app/dashboard/layout.tsx:53-56`, `src/app/outreach/OutreachSections.tsx:24` |

## 9. Testing Coverage

### Strengths

- Functions coverage is currently 87.31% lines / 96.99% functions overall.
- Rules tests use the real Firebase Emulator Suite.
- E2E runs Chromium desktop, Pixel 7, Firefox, and WebKit.
- Several tests explicitly protect failure honesty and youth-data DTOs.
- No skipped/only/TODO tests were found.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| TST-01 | HIGH | Frontend coverage explicitly instruments only 28 of 278 production TS/TSX files; 56% lines/42% functions and no branch floor are false-green global metrics. | `vite.config.ts:124-169` |
| TST-02 | HIGH | Aggregate Functions gates hide `replay.ts` at 14.9% lines and `simulations.ts` at 51.4% lines. | `functions/vitest.config.ts:12-22`, generated Functions coverage report |
| TST-03 | HIGH | Route tests commonly invoke only the last Express handler, bypassing auth, App Check, validation, rate limiting, async/error composition, and mount order. | Representative: `functions/src/routes/__tests__/profiles.test.ts:99-105`, `inquiries.test.ts:94-100`, `photos.test.ts:35-46` |
| TST-04 | HIGH | Playwright authority is injected through arbitrary `sessionStorage` roles, and tasks have E2E-only data branches. | `e2e/fixtures.ts:37-50`, `src/context/AuthContext.tsx:32-55`, `src/app/dashboard/tasks/page.tsx:126,201,338` |
| TST-05 | HIGH | One rules test file covers only part of roughly 30 Firestore and eight Storage match areas, with no list/query semantics. | `tests/rules/security.rules.test.ts` |
| TST-06 | MEDIUM | E2E route/failure/accessibility coverage is a small smoke subset and does not fail on unexpected same-origin API failures. | `e2e/*.spec.ts`, `e2e/fixtures.ts:9-28` |
| TST-07 | MEDIUM | MCP has no test or coverage command; CI only installs, audits, and builds it. | `mcp-server/package.json:9-13`, `.github/workflows/ci.yml:47-95` |
| TST-08 | MEDIUM | Orphan pa11y configs and retired cart tests add green noise without protecting live behavior. | `.pa11yci.cjs`, `.pa11yci.local`, `src/test/useCartStore.test.ts`, `vite.config.ts:132,162-165` |

## 10. Architecture

### Strengths

- The Express composition root clearly mounts routers and applies global rate
  limiting, App Check observation/enforcement, body parsing, and error handling.
- Public media/calendar/profile APIs increasingly use explicit DTOs.
- Scheduled cleanup is isolated from the HTTP function and binds only the
  encryption secret.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| ARC-01 | HIGH | Retired telemetry architecture remains in the live composition root and rules despite the UI feature being removed. | `functions/src/index.ts:94-112`, rules listed under DEBT-01 |
| ARC-02 | MEDIUM | Authorization semantics are duplicated across middleware, Firestore rules, and Storage rules and have already drifted. | `functions/src/middleware/auth.ts:55-72`, `firestore.rules:15-25`, `storage.rules:5-13` |
| ARC-03 | MEDIUM | One Cloud Function and one secret list couple unrelated public, media, AI, GitHub, Google, and Zulip surfaces. | `functions/src/index.ts:153-179` |
| ARC-04 | MEDIUM | CORS allowlists and upload authorization are duplicated; orphan rule paths such as `team_layouts`, `/field`, and `/fields` lack current owners. | `functions/src/index.ts:52-81,94,153-161`, `firestore.rules:269-272`, `storage.rules:52-60` |
| ARC-05 | MEDIUM | Simulation persistence conflates user drafts, official repository files, and generated registries. | `functions/src/routes/simulations.ts`, `src/hooks/useSimulationFiles.ts` |

## 11. DevOps & Hygiene

### Strengths

- CI pins Node 22.13.1, pnpm 11.21.0, Java 21, and Actions by full commit SHA.
- The latest CI run, CodeQL runs, required gate, and production deployment all
  succeeded for the audited revision.
- Deployment is serialized, restricted to `master`, uses a protected
  environment, consumes the verified artifact, and performs production health
  probes.
- Production dependency audits, rules tests, E2E, builds, and bundle budgets are
  in the required gate.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| DEV-01 | HIGH | ESLint has no TS/TSX parser/files blocks; root excludes Functions and CI never runs Functions lint. The green lint step does not enforce TypeScript quality. | `eslint.config.mjs:1-24`, `functions/eslint.config.mjs:1-13`, `.github/workflows/ci.yml:50-58` |
| DEV-02 | HIGH | Repository clone/storage cost is dominated by tracked media/test artifacts and historical build caches. | root MP4, `data/`, Git object inventory |
| DEV-03 | MEDIUM | README/PROJECT/API authentication/Drizzle/debugging documents describe old runtimes, ports, commands, React versions, Hono, D1, Better-Auth, or Cloudflare flows. | `README.md`, `PROJECT.md`, `docs/API_AUTHENTICATION.md`, `docs/DRIZZLE_STUDIO.md`, `DEBUGGING.md` |
| DEV-04 | MEDIUM | Production health checks allow only five 10-second retries, shorter than Firestore index activation can require. | `.github/workflows/ci.yml:268-285` |
| DEV-05 | MEDIUM | Dependabot does not cover the standalone MCP lockfile/package. | `.github/dependabot.yml`, `mcp-server/package-lock.json` |
| DEV-06 | MEDIUM | Local toolchain is out of policy (Node 24, pnpm 11.16, Java 11); CI is compliant, but contributor setup is not reproducible from the current docs. | local environment vs `AGENTS.md` and `package.json` |

## 12. Scalability & Resilience

### Strengths

- Pagination and hard limits exist on many public APIs.
- Cleanup batches stay below Firestore's batch ceiling.
- Uploads and expensive AI paths have explicit rate limits.
- PWA update recovery and stale-cache cleanup have targeted tests.

### Findings

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| SCALE-01 | HIGH | PWA first-install request/byte volume scales with the entire application rather than the shell. | `vite.config.ts:39-52` |
| SCALE-02 | HIGH | Original gallery uploads are reused for grid cards; transfer cost scales directly with full-resolution media. | photo files listed under PERF-03 |
| SCALE-03 | MEDIUM | Public gallery over-reads and filters in memory; a public projection or denormalized publication flag is needed. | `functions/src/routes/photos.ts:114-151` |
| SCALE-04 | MEDIUM | Sitemap queries cap each collection at 500 without stable ordering/pagination, and one collection failure causes a total 503. | `functions/src/routes/sitemap.ts:92-124` |
| SCALE-05 | MEDIUM | Functions secret scope and container count are coupled across all routes. | `functions/src/index.ts:153-179` |

## SEO and crawl-layer findings

SEO cuts across functionality, portability, and architecture and is summarized
separately because it is not one of the original 12 pillar labels.

| ID | Severity | Finding | Location |
| --- | --- | --- | --- |
| SEO-01 | HIGH | Page-specific metadata/content/JSON-LD exist only after client rendering; raw routes serve one generic shell. | `firebase.json:48-59`, `index.html:7-25`, `src/components/SEO.tsx:212-237` |
| SEO-02 | HIGH | Unknown and missing URLs return HTTP 200 soft 404s and generic indexable metadata. | `firebase.json:58-59`, `src/App.tsx:145-149` |
| SEO-03 | HIGH | Live sitemap advertises 18 obvious test/E2E/WIP records. | `functions/src/routes/sitemap.ts:92-120`, live `/sitemap.xml` |
| SEO-04 | MEDIUM | `/tournaments` is simultaneously in the sitemap, blocked by robots, and client-side `noindex`. | `functions/src/routes/sitemap.ts:34`, `public/robots.txt:4`, `src/app/tournaments/page.tsx:95-98,145-148` |
| SEO-05 | MEDIUM | Physical Event JSON-LD often lacks Google's required structured postal address/location facts. | `src/components/SEO.tsx:148-174`, `src/app/events/[id]/page.tsx:77,101-105,458-463` |
| SEO-06 | MEDIUM | Social previews default to a square favicon and are not present in raw dynamic-page HTML. | `src/components/SEO.tsx:18,227`, `index.html:7-12` |
| SEO-07 | MEDIUM | Firebase-host canonical redirects depend on JavaScript and trailing-slash variants remain separate 200 URLs. | `index.html:13-16`, `src/components/SEO.tsx:44-52` |
| SEO-08 | MEDIUM | Hosting overrides the sitemap function's intended cache policy with `no-store`. | `functions/src/routes/sitemap.ts:10,194-195`, `firebase.json:18-22` |

## Audit protocol assessment

### Decision

**Keep the 12-pillar structure, but update the protocol before relying on it for
another audit.** The current protocol is directionally appropriate and did help
surface meaningful issues, but several rules are obsolete or actively unsafe.

### Protocol defects

| ID | Severity | Problem | Evidence |
| --- | --- | --- | --- |
| PROTO-01 | HIGH | Accessibility guidance teaches a CSS pseudo-element technique specifically to evade Axe contrast detection. This must be deleted, not qualified. | `.agents/skills/aresweb-web-accessibility/SKILL.md:37-38`, `docs/conventions/06-accessibility.md:29-35` |
| PROTO-02 | HIGH | Failure guidance requires raw `console.error` and logging user email/UID, contradicting structured logging and data minimization. | `.agents/skills/aresweb-failure-exposure/SKILL.md:19-21,51-52`, `docs/conventions/14-failure-exposure.md:44-52` |
| PROTO-03 | HIGH | Duplicate convention files still authorize Drizzle/Hono `as any`, Cloudflare headers, Wrangler deployment, and `c.executionCtx.waitUntil()` for a Firebase/Express system. | `docs/conventions/01-typescript-safety.md:7-38`, `03-zero-trust-security.md:34-39`, `12-pwa-resilience.md:25`, `14-failure-exposure.md:46-52` |
| PROTO-04 | MEDIUM | Comprehensive guidance prescribes libraries/patterns that are absent or retired (`react-hook-form`, `useUIStore` as a universal standard). | `.agents/skills/aresweb-comprehensive-audit/SKILL.md:67-68` |
| PROTO-05 | MEDIUM | Orchestration requires seven concurrent agents even when the environment permits only three subagents; staged waves should be the rule. | `.agents/skills/aresweb-multi-agent-audit/SKILL.md:12-24` |
| PROTO-06 | MEDIUM | The audit protocol lacks a reproducible orphan method: entry-point import graphs, generated-registry validation, dependency-use checks, duplicate hashing, tracked-artifact inventory, and dynamic-reference confirmation. | No current protocol section |
| PROTO-07 | MEDIUM | It lacks evidence confidence, live-vs-orphan classification, false-positive validation, and an explicit separation between audit/report authorization and remediation/deployment authorization. | No current protocol section |
| PROTO-08 | LOW | The required root `final_audit_scorecard.md` conflicts with the same protocol's rule against root audit reports. | comprehensive skill line 93 vs multi-agent skill line 24 |

### Required protocol update

1. Make `AGENTS.md` the explicit highest-precedence repository contract and
   derive the stack from `package.json`, routing, and deployment config at audit
   start.
2. Replace all raw-console/email/UID guidance with structured `logger.*`, request
   correlation IDs, redaction, and minimum necessary context.
3. Delete every scanner-bypass recommendation. Require real contrast fixes,
   documented manual verification, and narrowly justified tool suppressions only
   for proven false positives.
4. Replace hard-coded seven-way concurrency with bounded staged waves based on
   the active agent limit.
5. Add an orphan/debt protocol: import reachability from real entry points,
   generated registries, dynamic import review, exact-duplicate hashing,
   dependency use, tracked-large-file/history inventory, scripts/docs ownership,
   and confirmation before deletion.
6. Require every finding to state severity, confidence, live/orphan status,
   exploitability/user impact, exact evidence, remediation, and validation.
7. Add live crawl/API/PWA checks when the production system is in scope, while
   keeping them read-only unless explicit production authority is given.
8. Use one canonical protocol source and generate/synchronize
   `docs/conventions/*`; do not maintain contradictory copies.
9. Store dated audit artifacts under `docs/audits/` or an external artifact
   system, not indefinitely at repository root.

## Prioritized remediation roadmap

### Must fix before making stronger security/accessibility claims

1. Replace denylist membership with an explicit active-role enum and archived
   check in middleware, Firestore rules, and Storage rules; add emulator and HTTP
   role-matrix tests.
2. Encrypt inquiry-approved student names/contact data before the batch write.
3. Remove retired upload/replay/telemetry routers and permissions after an
   explicit production-data retention decision.
4. Repair the TypeScript/Functions ESLint gate and add one proof that TS/TSX is
   actually linted.
5. Fix the docs drawer, nested event lightbox, event upload keyboard access, and
   remove/soften unsupported accessibility claims.
6. Add explicit Academy error/not-found states and align AI controls with server
   role capabilities.
7. Withdraw or rewrite the inaccurate Developer API/MCP/OpenAPI promises.
8. Review and remove the public repository MP4 and generated trace artifacts;
   decide whether a coordinated history rewrite is warranted.
9. Remove test/WIP production records from the live sitemap after owner review.

### Should fix next

1. Restrict PWA precaching and add service-worker byte/request budgets.
2. Self-host one Monaco version and preview dependencies; add a production-CSP
   editor test.
3. Generate responsive image derivatives and query a bounded public photo
   projection.
4. Reconcile simulation draft/save/publish/registry architecture.
5. Instrument all frontend production source for coverage; add full Express
   middleware integration tests and complete rules matrices.
6. Delete retired executable scripts, GSD planning residue, dead modules/assets,
   duplicate utilities, and stale authentication/database docs.
7. Add real 404/prerender/SSR crawl behavior and reconcile sitemap/robots/noindex.
8. Move task comments behind a verified-identity DTO API.

### Backlog

1. Split large profiles/editor/task modules and simulation engine/view layers.
2. Define an approved accessible visualization palette and correct remaining
   brand/nomenclature drift.
3. Consolidate profile querying and reduce external font weights.
4. Split high-risk integrations into functions with narrower secret bindings.
5. Add MCP tests only if the product is retained; otherwise delete the package.
6. Coordinate Git-history cleanup with all contributors after current-tree
   cleanup is complete.

## Verification and limitations

- The worktree was clean on `master` at audit start.
- GitHub CI run `31626473077`, both CodeQL runs, the required test gate, and the
  production deployment succeeded for the audited revision.
- CI covered install, lint as currently configured, TypeScript, dependency
  audits, frontend/Functions coverage, rules, builds, bundle budgets, E2E, and
  production health.
- Live read-only checks confirmed key public pages return 200, `/sw.js` is valid
  JavaScript with 162 precache entries, and every documented MCP/AI-tools endpoint
  returns 404.
- The bundle budget script passed against the current `dist` output.
- The local workstation is outside the repository's required toolchain versions,
  so this audit relied on the successful pinned CI run for the full verification
  gate rather than presenting an out-of-policy local run as authoritative.
- Static orphan results were manually checked against dynamic route and
  simulation registries. Absence of a literal import alone was not treated as
  proof of dead code.
- No production data, secrets, deployment configuration, or runtime state was
  changed by this audit. This file is the only tracked audit artifact added.
