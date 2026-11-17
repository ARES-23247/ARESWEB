# ARESWEB website audit — November 17, 2026

## 1. Scope, environment, and release identity

- Repository `ARES-23247/ARESWEB`, branch `master`, commit `15c1f8ce56bfbdbd6ca08c42ba8684227b00809a`. The worktree started clean. GitHub reported the same commit at `refs/heads/master`.
- Windows, Node `24.19.0`, pnpm `11.21.0`, Java `21.0.12`. Verification used the locked workspace and emulator project `aresweb-ci`. Live browser sampling used clean Chromium contexts at `1440×900` and `320×640`.
- Scope covered Hosting and Cloud Run, public discovery and recruitment, accessibility and print, APIs and data rules, portal permissions and offline use, Academy source and release verification, Arcade, and CI. Production checks used public reads, browser-local interactions, and read-only cloud metadata. Authenticated portal behavior was assessed with code, automated fixtures, and emulators. No production forms, uploads, sign-in, matches, or record edits were submitted.
- The merged PR passed its required gate, rules job, and both selected browser shards. The `master` push for this SHA passed the protected build, production deployment, and production browser security smoke. CodeQL subsequently completed successfully for the same SHA. [Merged PR](https://github.com/ARES-23247/ARESWEB/pull/340) · [Deployment workflow](https://github.com/ARES-23247/ARESWEB/actions/runs/43368352140) · [CodeQL workflow](https://github.com/ARES-23247/ARESWEB/actions/runs/43811914885)

### Verification ledger

| Check | Evidence | Outcome |
| --- | --- | --- |
| Runtime and locked dependencies | `pnpm install --frozen-lockfile`, `pnpm run validate:runtime` | Passed with network access and the host pnpm store. |
| Repository and release contracts | `validate:agents`, `check:route-security`, `validate:security-observability`, `validate:game-deployment`, `validate:functions-deploy-lock` | Passed. Guard inventory checked 134 mutations, with 117 Firebase-authorized and 17 controlled exceptions. The logging contract checked five redacted metrics. |
| Static and release tooling | `pnpm run lint`, `pnpm --filter functions lint`, `pnpm run typecheck`, `pnpm run test:release-tooling` | Passed. Release-tooling coverage was 97.50% lines and 100% functions. |
| Unit coverage | `pnpm run test:coverage --coverage.reportsDirectory=scratch/audit-2026-11-17-root-coverage --maxWorkers=4`, `pnpm --filter functions test:coverage` | Frontend passed 2,123 tests in 313 files at 92.03% line coverage. Functions passed 1,090 tests in 88 files at 95.46% lines and 98.12% functions. The fresh frontend report used its own directory after the initial attempts overlapped in the default output directory. |
| Firebase and Functions authorization | `pnpm run test:rules`, `pnpm run test:functions-emulator` | Passed 41 Rules tests and 10 Functions emulator tests. The sandbox blocked loopback on the first attempt. Both commands completed on the host. |
| Build and budget | `pnpm run build`, `pnpm --filter functions build`, `node scripts/check-bundle-size.mjs` | Both builds passed. The frontend generated 35 prerender shells and met all eight budgets. Initial JS was 259,073 bytes gzip against 400,000. Academy interactive JS was 91,956 against 95,000. The editor runtime was 2,820,828 against 3,150,000. |
| Browser regression matrix | `pnpm run test:e2e --workers=5 --reporter=line`, followed by a one-worker retry of the two failed WebKit cases | 686 passed and two desktop WebKit BIOBUZZ cases failed in the full 688-case run. The two failures were a screenshot timeout in `biobuzz.spec.ts:3` and a missing robot-setup locator in `biobuzzSimulator.spec.ts:37`. Both passed on a serial retry against the same build. The full run exited 1. All three PWA cases passed. |
| Academy verification | `pnpm run content:verify`, `pnpm run content:release-validate` | Local release validation passed 68 documents, 242 source references, and three guarded batches. Remote verification failed on the Studio version comparison in ARES-03. |
| Dependency advisories | `pnpm audit --prod --audit-level=low`, `pnpm audit --prod --audit-level=high`, `pnpm view picomatch version` | Both audit thresholds reported one high-severity advisory and exited 1. The registry reported `4.0.7` as latest. See ARES-02. |
| Live Hosting, APIs, and media | `node scripts/check-production-health.mjs --deployment-id 15c1f8ce56bfbdbd6ca08c42ba8684227b00809a` plus bounded public GETs | 17 of 17 health checks passed. Sampled content, tournament results, sponsors, seasons, robots, calendar, finance, and video endpoints returned `200`. Signed-out profile and inquiries reads returned `401`. The sitemap, `robots.txt`, and `/feed.xml` returned `200`. All 175 sitemap URLs returned `200`, emitted one matching raw canonical, and had no `noindex` directive in the inspected raw response. The expected missing page and API returned `404`. |
| Live page rendering | Playwright Chromium navigation to 41 paths at each of two viewport sizes | 82 page loads. No root-level horizontal overflow in this sample. The mobile drawer put focus on its Close control and restored focus to the opener on Escape. The homepage rendered the configured obsidian, marble, and red tokens and had zero signed-out dashboard links inside its main content. See ARES-04 through ARES-09 for exceptions. |
| Live production inventory | `gcloud functions list`, `gcloud run services list`, `firebase functions:list --json`, deployment and game validators, Secret Manager metadata, GitHub PR and alert reads | The 12 declared Functions passed inventory and invoker policy validation. The build identity passed its IAM checks. Both website-owned game services had ready Cloud Run revisions. The game API passed its service, revision, and invoker contract checks. The BIOBUZZ public health endpoint responded `200`, with `accepting: false` on the first read and `accepting: true` at 3:39 p.m. Eastern Time. The reason for the initial state remains unverified. The protected BIOBUZZ validator is reserved for the deployment identity, so this audit used public health and ready-revision metadata. Secret Manager listed 19 entries. The open PR list contained seven dependency updates. The repository's open Dependabot-alert query returned no rows at audit time. |
| Storage App Check and media | `pnpm run appcheck:storage-observe --project aresfirst-portal --start 2026-11-10T20:26:14Z`, `pnpm run media:inventory --project aresfirst-portal --bucket aresfirst-portal.firebasestorage.app` | The 167.95-hour monitoring window recorded zero direct Storage App Check verifications. Aggregate inventory covered 815 document or collection-group rows and 95 objects across the named prefixes. No direct bucket URL references appeared in the scanned records. One of 32 imported-photo records had an original without both size variants. The public health check passed same-origin media delivery, and the published managed sponsor image loaded in Chromium. |
| Selective CI and backend fingerprints | Evaluated `selectAreas` and `computeDeploymentFingerprints` against the tracked checkout | 938 of 1,221 files across the six audited source roots had explicit area or shared coverage. All 283 unmatched paths selected the full 30-spec browser set. Fingerprints generated for 12 Functions and both Cloud Run game services. The Waggle replay worker is explicitly in the game inputs. |

## 2. Findings

| ID | Site severity | Confidence | Finding |
| --- | --- | --- | --- |
| ARES-01 | P2 | High | The offline scouting queue silently drops older pending submissions at capacity. |
| ARES-02 | P2 | High for the dependency and release gate | The production dependency audit fails on `picomatch` 4.0.7. |
| ARES-03 | P2 | High | Academy's Studio version drift fails a required verification step. |
| ARES-04 | P2 | High | Raw route metadata and client metadata compete, with conflicting canonicals on some routes. |
| ARES-05 | P2 | High | Two documented Arcade entry URLs return `404`. |
| ARES-06 | P2 | High | Three games produce duplicate main landmarks. |
| ARES-07 | P2 | High | Fixed notices cover nearly the whole first mobile viewport. |
| ARES-08 | P2 | High | A time-sensitive cancellation remains live after the date it names. |
| ARES-10 | P2 | High for the conditional behavior | The public roster admits previously opted-in profiles when the authorization collection is empty. |
| ARES-09 | P3 | High for the browser observation | The live custom domain emits repeated CSP errors from injected instrumentation. |

P0 covers a critical outage or compromise. P1 covers major loss, a broken core journey, or a high-impact authorization or privacy failure. P2 covers bounded user impact or a release gate failure. P3 covers lower-impact operational or maintenance issues.

### ARES-01 — Offline scouting silently discards queued work

**P2, confirmed by running the current client helper with an in-memory Storage fixture.** After 61 distinct stand-scouting saves for one user and tournament, the helper returned 60 items beginning with the second submission. A second user's queue stayed empty. The cap is 60. Enqueue and storage both keep only the last 60 entries, and the UI displays a successful offline-queue notice after enqueue. A busy tablet can therefore lose unsynced observations during a prolonged outage with no indication of which notes were dropped. `src/lib/pitModeOutbox.ts:30`, `:99–119`, `:142–172`, `:240–263` and `src/app/tournaments/[id]/TournamentScoutingHub.tsx:158–171`.

- **Remediation** Preserve queued entries at capacity and display a clear capacity error when a distinct mutation cannot be stored. Keep intentional replacement of coalesced snapshots and existing UID isolation.
- **Acceptance** Queue 60 distinct submissions offline, attempt a 61st, and assert that the original 60 still sync exactly once and that the attempted new save receives an actionable error. Verify that a coalescible update still succeeds at capacity.

### ARES-02 — The production dependency audit is red

**P2, confirmed by the npm advisory feed and lockfile.** `sucrase` carries `tinyglobby` and `picomatch` 4.0.7 in the production dependency tree. GitHub rates the issue high, with CVSS 8.7. The site loads Sucrase for its browser-side `transform` API. This review found no website request path passing visitor-supplied glob patterns to `picomatch`. The confirmed impact is a failed required dependency gate. The audit output names `>=4.0.8` as a patched range, but `pnpm view` returned 4.0.7 and GitHub lists no published patched version. `package.json:75`, `pnpm-lock.yaml:13404–13412`, `:13548–13551`, and `src/utils/lazySucrase.ts:1–17`. [GitHub advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf) · [Upstream releases](https://github.com/micromatch/picomatch/releases)

- **Remediation** Remove the affected production dependency path while preserving editor transforms, or update to a published, verified fixed release when available.
- **Acceptance** Confirm `pnpm audit --prod --audit-level=high` passes and exercise TypeScript compilation and sandbox preview in the editor and Academy playground.

### ARES-03 — Academy remote verification fails on Studio version drift

**P2, confirmed by the remote validator.** The checkout pins ARES Studio `7.0.75` at `0134e4858ceb555556a70c08ada33251e1714e3a`. The upstream manifest reported `7.0.79` on November 17, and the validator stopped at that comparison. GitHub reported `1df7d0805d82081d09119c0dad05ff059d1decaa` as the upstream `main` SHA during the audit. The guarded local candidate still passes its internal validation. The mismatch can block PR verification and leaves lessons that advertise the current Studio version stale. This result verifies drift, with remote blob verification incomplete after the early exit. `content/learning/catalog.json:4–8`, `content/learning/source-authorities.json:5–15`, `scripts/validate-learning-catalog.mjs:515–535`, `:757–760`, and `.github/workflows/ci.yml:84–88`. [Pinned upstream tree](https://github.com/ARES-23247/ARES-Robotics/tree/0134e4858ceb555556a70c08ada33251e1714e3a) · [Upstream manifest](https://github.com/ARES-23247/ARES-Robotics/blob/1df7d0805d82081d09119c0dad05ff059d1decaa/release/ares-versions.properties)

- **Remediation** Refresh the approved source authority against an immutable upstream commit. Review changed lesson references and regenerate the candidate digests while preserving human-review flags and historical evidence.
- **Acceptance** Run `pnpm run content:verify` through all remote reference checks and `pnpm run content:release-validate` through all guarded batches.

### ARES-04 — Prerender and React emit competing metadata

**P2, confirmed by raw HTML and Chromium.** A desktop sweep found two canonical tags on 37 sampled URLs after rendering. Most pairs identify the same URL. `/academy/playground` and `/dashboard` had one homepage canonical and one route canonical. The raw Academy playground HTML also uses the homepage title, headline, and canonical because its Hosting rewrite serves the generic shell. The dashboard is covered by `X-Robots-Tag: noindex, nofollow`, so its competing URL is primarily a template issue. The playground can misidentify itself to crawlers that read response HTML, and duplicate metadata makes client navigation and crawler output harder to validate. `index.html:7–13`, `scripts/prerender-static-routes.mjs:167–194`, `firebase.json:79–85`, `:302–304`, `src/components/SEO.tsx:270–301`, and `functions/src/webRendering.ts:182–202`. [Academy playground](https://aresfirst.org/academy/playground)

- **Remediation** Establish a single owner for canonical, description, and social tags through the raw response and React transition. Give the playground appropriate raw metadata and a deliberate indexing decision.
- **Acceptance** Assert one route-correct canonical in raw HTML, after React renders, and after client-side navigation for a static route, a published detail, and the playground. Assert the expected robots directives on protected routes.

### ARES-05 — Documented Arcade entry URLs return 404

**P2, confirmed by public GET and desktop and mobile browser navigation.** `/biobuzz` and `/waggle-way/community` both return a real `404`. The active entry points `/biobuzz/simulator`, `/biobuzz/score-calculator`, `/waggle-way`, and `/waggle-way/builder` returned `200`. Current Arcade cards and the embedded Waggle community shelf continue to provide entry points. Existing bookmarks or references to the two promised URLs fail. `AGENTS.md:84–86`, `src/App.tsx:135–143`, `firebase.json:169–176`, and `:370–376`. [BIOBUZZ short URL](https://aresfirst.org/biobuzz) · [Waggle Way community URL](https://aresfirst.org/waggle-way/community)

- **Remediation** Restore the documented entry URLs with redirects or explicit route handlers. Carry the Waggle visitor through to the community shelf where the interface supports it.
- **Acceptance** Exercise direct Hosting entry and in-app navigation for both URLs. Verify that a random absent path continues to return `404`.

### ARES-06 — Three Arcade games have nested main landmarks

**P2, confirmed after game titles and controls finished rendering.** `/buzzle`, `/buzzello`, and `/buzzhex` each present two main landmarks. The shared website wrapper supplies the skip destination and each game supplies another `<main>` inside it. Landmark navigation can present two competing entry points for the same page. Initial sweeps saw loading views on these games and Academy. Later checks confirmed those titles rendered, so loading snapshots alone do not establish missing headings in settled views. `src/components/layout/LayoutWrapper.tsx:138–147`, `packages/buzzle/src/Game.tsx:669`, `packages/buzzello/src/Game.tsx:928`, and `packages/buzzhex/src/Game.tsx:337–348`. [BUZZLE](https://aresfirst.org/buzzle) · [BUZZELLO](https://aresfirst.org/buzzello) · [BUZZHEX](https://aresfirst.org/buzzhex)

- **Remediation** Use a section or div for the embedded game shell, retaining its title and fullscreen target. Keep the site's main landmark and skip target.
- **Acceptance** Assert exactly one main landmark and one named level-one heading after load at both widths. Confirm keyboard access to the board and fullscreen entry after the change.

### ARES-07 — First-time mobile visitors see almost only notices

**P2, confirmed by first-visit Chromium screenshots and measured element sizes.** At `320×640`, the consent prompt used 425 pixels and the active announcement used 180. Together they occupied 605 pixels, roughly 95% of the viewport, before accounting for their gaps. On sampled home, Arcade, and sponsor views, the notices obscured the opening content or actions. The analytics prompt remains fixed while scrolling before a choice, and the announcement also stays fixed. Dismissing both in the audit context restored the normal view. `src/components/AnalyticsConsentBanner.tsx:53–92`, `src/components/SiteAnnouncementBanner.tsx:120–138`, `:156–183`, and `src/components/layout/LayoutWrapper.tsx:138–145`. [Homepage](https://aresfirst.org/)

- **Remediation** Reflow the notices at short, narrow viewport sizes so the consent controls and core site content remain usable together. Preserve separate Allow and Keep cookie-free actions.
- **Acceptance** Inject a long active announcement into a fresh `320×640` session. Before consent, verify that keyboard navigation and scrolling can reach a primary page action without either notice covering its focus indicator.

### ARES-08 — An expired practice cancellation is still displayed

**P2, confirmed in the November 17 Eastern Time session.** The live public announcement still said practice was canceled “tonight” and named Monday, November 16. The response had `startsAt: null` and `endsAt: null`, so the API's time-window filter cannot expire it. Families can mistake a previous cancellation for a current schedule change. `functions/src/routes/announcements.ts:42–48`, `:136–142`, `:209–213`, and `src/app/dashboard/announcements/page.tsx:272–282`. [Public announcement response](https://aresfirst.org/api/announcements)

- **Remediation** Retire stale content through the authorized announcement workflow. Require an end time for time-sensitive notices or default the editor to a visible, editable expiry.
- **Acceptance** Set a cancellation with an Eastern Time end, advance the test clock past that time, and verify the public response stops serving it and the banner disappears after refresh. Exercise an evergreen announcement separately.

### ARES-09 — Cloudflare instrumentation produces CSP console errors

**P3, confirmed in clean Chromium contexts.** The Cloudflare Insights beacon was blocked by the app's `script-src` on all 41 desktop entries. The browser also reported inline script policy violations. The custom domain advertises Cloudflare speculation rules, while the direct Firebase origin did not in the sampled responses. The authoritative origin of the inline violation and the telemetry configuration still need confirmation. Public page renders and health probes passed, so the observed effect is noisy diagnostics and blocked instrumentation. `firebase.json:49–54`. [Public custom domain](https://aresfirst.org/) · [Firebase Hosting origin](https://aresfirst-portal.web.app/)

- **Remediation** Inspect the edge features attached to the custom domain. Disable incidental injection if it is unused, or configure the intended instrumentation to agree with the consent and CSP model.
- **Acceptance** Use a fresh browser on the custom domain. The public pages render without edge-generated CSP console errors, `script-src` remains strict, and the cookie-free choice preserves the documented analytics behavior.

### ARES-10 — An empty authorization inventory makes the roster permissive

**P2, confirmed in source and reflected in existing synthetic route tests.** The public roster queries opted-in profiles and loads authorization records. If the authorization query returns zero documents, it sets the authorization map to `null` and treats every otherwise eligible profile as active. An incomplete restore or migration could therefore publish the display information of former members whose old opt-in flag remains. The DTO still strips the private student fields covered by the tests. The audit did not establish that production is in the affected data state. `functions/src/routes/profileRoster.ts:168–199`, `:250–263`, and `functions/src/routes/__tests__/profiles.test.ts:107–161`.

- **Remediation** Require active authorization for current members even when the lookup returns an empty result. If non-member records need publication, bind them to a deliberate, reviewed publication record suitable for alumni or partners.
- **Acceptance** With an empty authorization fixture and opted-in legacy profiles, expect the current-member roster to be empty. With one active authorization, verify only its opted-in profile is published and student DTOs retain their field restrictions.

## 3. Verified behavior and remaining coverage

| Domain | What this audit verified |
| --- | --- |
| Privacy and API controls | Shared authorization uses active role records and the email-linking helper. Tournament and robot custom gates also link eligible invited users. Inquiry writes encrypt contact data before persistence, and direct inquiry/profile document access is locked. Travel-readiness read and reveal use the admin/coach guard. Public DTO inspection sampled actual responses using field names and aggregate counts. Photo and logo upload paths place auth and quotas ahead of the large body parsers. Zulip syndication bounds and escapes display text. Emulator tests supply the allow, deny, and strict Rules evidence. `functions/src/middleware/auth.ts:54–158`, `functions/src/routes/inquiries.ts:76–106`, `functions/src/routes/profileAdmin.ts:791–923`, `functions/src/apiApp.ts:65–95`, `functions/src/lib/socialSyndication.ts:25–81`, and `firestore.rules:543–551`. |
| Public content and navigation | Production homepage HTML names ARES Robotics Studio and carries privacy and terms links. The join form grade options and crawler copy cover grades 6–12. The store advertises preview-only availability, and the Arcade shell lists all six games. The managed sponsor logo loaded. Under print media, the opened sponsor sheet was the sole visible heading. Navigation and footer stayed hidden when the robot print view was opened. Public seasons content returned readable text. The sitemap listed 90 Academy lessons, 19 posts, one robot, and 33 events during the read. The public RSS endpoint linked by the site is `/feed.xml`. |
| Portal and competition | Reviewed sidebar, command palette, page gates, and API authorization for administration, finance, recruiting, sponsor/outreach management, travel readiness, event check-in, and portfolio. Check-in code storage uses server-only rules. Portfolio CSV uses the shared spreadsheet cell escaper. The offline queue uses UID and tournament scope, retains transient failures, and attaches submission IDs for stand-scouting retries, with the capacity exception described above. Blog Share Kit uses encoded intents and a locally rendered square card. `src/components/dashboard/DashboardSidebar.tsx:141–275`, `src/components/navigation/CommandPalette.tsx`, `firestore.rules:436–438`, `src/app/dashboard/portfolio/page.tsx:398–422`, `src/lib/pitModeOutbox.ts:40–55`, `:197–263`, and `src/lib/blogShareKit.ts:90–131`. |
| Arcade, PWA, and release | Reviewed eight workspace packages and their boundary tests. The website injects authenticated transport. The simulation and Pollinator frames use opaque `allow-scripts` sandboxes and validate the sender. BIOBUZZ retains a bounded WebSocket payload, origin checks, admission quotas, separate handshake/reconnect handling, and drain behavior. CI pins actions, configures container Git ownership, checks both E2E reports, and uses workload identity for deployment. Verified the known replay worker is in the game fingerprint. `src/components/editor/SimPreviewFrame.tsx:131–147`, `:470`, `src/app/pollen/page.tsx:11–33`, `:51`, `functions/src/biobuzzServer.ts:16–43`, `functions/src/lib/biobuzzRooms.ts:17–64`, `.github/workflows/ci.yml:243–267`, `:323–331`, `:449–455`, and `scripts/deployment-fingerprints.mjs:216–240`. |

No file or object is marked orphaned from filename searches or aggregate inventory alone. Generated game copies were excluded from ownership findings. The reported 283 unclassified source paths add full-matrix work and preserve verification coverage through the conservative fallback. The measured bundle headroom is smallest on the Academy gzip budget, at 3,044 bytes. Those are maintenance observations.

Scope limits include authenticated production workflows, real venue-network and tablet behavior, physical prints, comprehensive screen-reader testing, and systematic timing under real mobile network conditions. The production browser sweep and source inspection do not establish WCAG conformance or the absence of security defects. The Storage monitoring interval and aggregate relationship scan are inputs to enforcement review. They do not establish coverage of all clients or grant authority to change cloud configuration.
