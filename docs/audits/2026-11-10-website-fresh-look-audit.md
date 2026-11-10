# Website Fresh-Look UX, Accessibility, and Engineering Audit — November 10, 2026

## Scope, environment, and release identity

- **Repository:** `ARES-23247/ARESWEB`
- **Audited commit:** `2b6356cd2239df140651866deaebd4198a52b1e7` (`master`, synced with `origin/master`)
- **Audit branch:** `feature/fresh-look-phase-1-audit`
- **Initial worktree state:** Clean (`git status -sb` reported no modified or untracked files)
- **Audit date:** November 10, 2026
- **Runtime environment:** Windows, Node.js `v24.19.0`, `pnpm 11.21.0`, OpenJDK `21.0.12`

### Executed verification vs. code inspection

Commands executed directly during this audit on `2b6356cd`:

- `pnpm run validate:agents` — passed (6 tracked shared skills and multi-agent entry points validated)
- `pnpm run check:route-security` — passed (123 mutation routes: 106 Firebase-authorized, 17 explicitly controlled exceptions)
- `pnpm run validate:functions-deploy-lock` — passed
- `pnpm run lint` and `pnpm --filter functions lint` — passed with `--max-warnings=0`
- `pnpm run typecheck` — passed (`tsc --noEmit`)
- `pnpm run test:release-tooling` — passed (4 files, 20 tests, 97.43% line / 100% function coverage)
- `pnpm vitest run src/test/ContrastTokens.test.ts src/test/HomeBranding.test.tsx src/test/PublicTruthPages.test.tsx` — passed (3 files, 14 tests)
- `pnpm run build` — passed (Vite 8.3.5 client build + Workbox SW + 35 prerendered public shells)
- `node scripts/check-bundle-size.mjs` — passed (`initialJs` 771,968 B raw / 241,237 B gzip; `initialCss` 188,523 B raw / 24,876 B gzip)
- `pnpm audit --prod --audit-level=high` — passed (`No known vulnerabilities found`)

Findings below combine executed checks, deterministic WCAG 2.2 relative-luminance math against live styles, and direct source inspection of active routes, navigation registries, prerender shells, and portal components. Automated and static checks are supporting evidence only; this report does not claim complete security, full WCAG 2.2 AA conformance, or zero remaining defects across untested live flows.

---

## Architecture and surface inventory

- **Public & game routes (`src/App.tsx`, `scripts/prerender-static-routes.mjs`):** 35 prerendered route shells plus dynamic detail routes (`/blog/:slug`, `/events/:id`, `/robots/:id`, `/tournaments/:id`, `/academy/:slug`, `/docs/:slug`), SPA-only `/academy/playground`, redirect `/tasks`, and wildcard `NotFoundPage`.
- **Member & administrative portal (`src/App.tsx:170–192`, `src/app/dashboard/layout.tsx`):** 22 nested `/dashboard` routes behind fail-closed Google sign-in + server-backed `authorized_users/{uid}` verification.
- **Navigation registries (`src/components/Navbar.tsx`, `src/components/navigation/navItems.ts`, `src/components/Footer.tsx`, `src/components/navigation/CommandPalette.tsx`):** Desktop top bar, `Team` and `Resources` dropdowns, mobile focus-trapped drawer (`MobileNavDrawer`), `Ctrl+K` / `Cmd+K` Quick Jump (`CommandPalette`), footer index, and portal `DashboardSidebar`.
- **Design contract (`design/ares-design-tokens.json`, `src/styles/ares-design-tokens.css`, `src/app/globals.css`):** Cross-product token contract shared with ARES Robotics Studio / Analytics (`obsidian`, `marble`, `ares-red`, `ares-bronze`, `ares-gold`, `ares-cyan`, `ares-on-bright-accent`, League Spartan + Inter).
- **Compliance & truthfulness anchors (`src/test/HomeBranding.test.tsx`, `src/test/PublicTruthPages.test.tsx`):** Homepage `ARES Robotics Studio` identity + `/privacy` and `/terms` links support Google OAuth brand verification; public pages use server DTOs and `PublicDataState` without fabricated team metrics, mock 3D parts, or placeholder rosters.

---

## Summary of findings

Eleven confirmed issues across WCAG contrast/semantics, crawler-vs-UI truthfulness, public storytelling and navigation IA, design-token discipline, portal workflow parity, and CSS bundle headroom:

| ID | Priority | Area | Summary | Planned Phase |
| --- | --- | --- | --- | --- |
| **FL-01** | P2 | Accessibility & Brand Tokens | Printables CTAs/badges hardcode `#fa6831` with white text (`2.96:1` contrast, below WCAG AA `4.5:1`) | Phase 3 |
| **FL-02** | P2 | Accessibility & Contrast | `.clipped-button:hover` and bronze hover classes pair `#CD7F32` fill with `#FFFFFF` text (`3.15:1` contrast) | Phase 3 |
| **FL-03** | P2 | Truthfulness & SEO | Prerender shells for `/store`, `/arcade`, and `/join` drift from live UI state, game roster, and grade options | Phase 2 |
| **FL-04** | P2 | Homepage UX & IA | Signed-out `/` leads with internal sign-in, PKCE copy in slot #2, 2/6 Arcade games, and auth-gated `/dashboard/tasks` | Phase 2 |
| **FL-05** | P2 | Navigation IA | Top-level `Navbar` promotes unavailable `/store` while burying/omitting `Join`, `Sponsors`, `Tournaments`, `Finance`, and `Playground` | Phase 2 |
| **FL-06** | P2 | Accessibility & Landmarks | Robot 404 view and Dashboard lockscreen render `<h2>` with no `<h1>`, degrading route announcements | Phase 3 / Phase 4 |
| **FL-07** | P2 | Portal UX & Parity | `/dashboard` splits daily overview across two pages, omits 4/6 approval queues on home, lists 21 flat sidebar links, and misses 10 `Ctrl+K` routes | Phase 4 |
| **FL-08** | P3 | Design Tokens | `SiteAnnouncementBanner` and announcement preview hardcode arbitrary `#07343b` and `#3d2b00` hex colors | Phase 3 |
| **FL-09** | P3 | Visual System & Layout | Public pages mix four incompatible header/card patterns and double `6rem` top padding (`192px` offset) on four routes | Phase 3 |
| **FL-10** | P3 | Motion & Focus Calmness | Continuous `animate-pulse` and `animate-bounce` loops run indefinitely on non-loading static text and icons | Phase 3 / Phase 4 |
| **FL-11** | P3 | Bundle Budget Headroom | `initialCss` stands at `188,523 / 200,000` raw bytes (`94.3%` of budget), requiring token/utility reuse | Phases 2–4 |

No fabrication of team members, sponsors, awards, 3D parts, or CAD assets was found in live public routes. Route-security and production dependency checks passed cleanly.

---

## Detailed findings

### FL-01 — P2: Printables CTAs and badges violate brand token rules and fail WCAG 2.2 AA contrast (`2.96:1`)

- **Confidence:** High; verified directly from source classes and WCAG 2.x relative-luminance calculation.
- **Evidence:**
  - `src/app/robots/page.tsx:159,200,205,216` (`bg-[#fa6831] hover:bg-[#e05620] text-white text-xs`)
  - `src/app/robots/[id]/page.tsx:137,341,346,348` (`bg-[#fa6831] hover:bg-[#e05620] text-white ... text-xs`)
  - `docs/conventions/05-brand-guidelines.md:45–47` (forbids arbitrary hex classes such as `bg-[#...]`)
- **Impact:** `#FA6831` (relative luminance `0.3044`) paired with `#FFFFFF` (`1.0000`) yields a `2.96:1` contrast ratio on `12px` (`text-xs`) button labels — failing WCAG 2.2 AA (`4.5:1` for normal text and `3.0:1` for large text) while introducing an unapproved third-party hex color into fleet cards and robot dossiers.
- **Remediation:** Replace `#fa6831` / `#e05620` classes on `/robots` and `/robots/:id` with authorized brand tokens (e.g., `bg-ares-bronze text-obsidian` or `border-ares-gold/40 bg-ares-gold/10 text-ares-gold` on dark surfaces) meeting `>= 4.5:1` contrast.
- **Acceptance test:** Extend `ContrastTokens.test.ts` (or a source-token check) and component tests on `RobotsFeedPage` / `RobotDetailPage` to assert zero `#[0-9a-fA-F]` class literals in `src/app/robots/` and `>= 4.5:1` foreground/background token pairing.

### FL-02 — P2: `.clipped-button:hover` and bronze hover overrides drop normal-text contrast to `3.15:1`

- **Confidence:** High; `ContrastTokens.test.ts:64–78` already proves `--ares-bronze` (`#CD7F32`) requires dark `onBrightAccent` text, while `.clipped-button:hover` retains white text.
- **Evidence:**
  - `src/app/globals.css:98–103,122–127` (`.clipped-button:hover` and `.clipped-button-sm:hover` set `background: var(--ares-bronze)` while inheriting `color: white`)
  - `src/app/page.tsx:121,138,145` (`hover:bg-ares-bronze` with `text-white` / `hover:text-white`)
  - `src/components/Footer.tsx:516`, `src/app/dashboard/layout.tsx:114`, `src/components/dashboard/DashboardSidebar.tsx:484`, `src/app/location-morgantown/page.tsx:42`, `src/app/robotics-west-virginia/page.tsx:49`
- **Impact:** Hovering primary buttons across the site transitions background fill to `#CD7F32` (`L = 0.2837`) while keeping `#FFFFFF` text, producing `3.15:1` contrast on `12px–14px` uppercase labels (below `4.5:1` WCAG 2.2 AA).
- **Remediation:** Update `.clipped-button:hover` and `.clipped-button-sm:hover` in `src/app/globals.css` to set `color: var(--ares-on-bright-accent)` (`#05070A`, `6.04:1` contrast on `#CD7F32`), and remove conflicting `hover:text-white` overrides when paired with `hover:bg-ares-bronze`.
- **Acceptance test:** Assert in `ContrastTokens.test.ts` that `.clipped-button:hover` and `.clipped-button-sm:hover` specify `var(--ares-on-bright-accent)` (or `var(--obsidian)`) and contain no `hover:bg-ares-bronze hover:text-white` combinations across `src/`.

### FL-03 — P2: Prerendered crawler shells for `/store`, `/arcade`, and `/join` drift from live UI truth

- **Confidence:** High; direct comparison of `scripts/prerender-static-routes.mjs` against rendered React routes.
- **Evidence:**
  - `scripts/prerender-static-routes.mjs:111–113` describes `/store` as active merchandise purchasing (*"Purchases directly support the team's parts, tools, and competition travel"*), whereas `src/app/store/page.tsx:37–47` explicitly states *"Online ordering is not available yet"* and *"Checkout unavailable"*.
  - `scripts/prerender-static-routes.mjs:30–33` lists only four games (`BUZZHEX`, `BUZZLE`, `BUZZELLO`, `Pollinator Pile-Up`) in `/arcade` metadata and body copy, omitting `BIOBUZZ Simulator` (`/biobuzz/simulator`) which leads `ARCADE_GAMES` in `src/components/navigation/navItems.ts:43–50`.
  - `scripts/prerender-static-routes.mjs:83–85` states *"Students in grades 7–12 ... can apply"*, while `src/app/join/page.tsx:10` offers `GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"]`.
- **Impact:** Search engines and no-JS visitors receive inaccurate availability claims for `/store`, incomplete discovery for `/arcade`, and inconsistent grade eligibility on `/join`.
- **Remediation:** Synchronize `staticPageMetadata` in `scripts/prerender-static-routes.mjs` so `/store` truthfully notes online checkout is not yet open while pointing to `/sponsors` and `/join`, `/arcade` includes `BIOBUZZ Simulator`, and `/join` matches the live application form's grade range (`grades 6–12`).
- **Acceptance test:** Unit test in prerender/truthfulness suite verifying `/store`, `/arcade`, and `/join` prerender shell strings match live route capabilities and eligibility.

### FL-04 — P2: Signed-out Homepage prioritizes internal sign-in, OAuth compliance copy, and auth-locked routes over public storytelling

- **Confidence:** High; verified directly in `src/app/page.tsx` and `src/test/HomeBranding.test.tsx`.
- **Evidence:**
  - `src/app/page.tsx:134–149` renders `Team Member Sign In` as the primary red Hero CTA for unauthenticated visitors, duplicating `DesktopUserMenu` in `src/components/Navbar.tsx:159–169`, with no Hero path to `/join`, `/robots`, or `/seasons`.
  - `src/app/page.tsx:156–230` places `ARES Robotics Studio` PKCE / loopback OAuth technical notes immediately below the Hero ahead of any robots, seasons, outreach, or Academy content. (`src/test/HomeBranding.test.tsx:38–47` requires the Studio heading and `/privacy` + `/terms` links on `/`, not slot #2 placement.)
  - `src/app/page.tsx:259–324` hardcodes only 2 of the 6 `ARCADE_GAMES` (`BUZZELLO` and `BUZZLE`), omitting `BIOBUZZ Simulator`, `Waggle Way`, `BUZZHEX`, and `Pollinator Pile-Up`.
  - `src/app/page.tsx:394–417` links signed-out public visitors to `/dashboard/tasks` (*"Kanban Task Board"*), which immediately hits the `Administrative Gate` lockscreen in `src/app/dashboard/layout.tsx:64–179`.
- **Impact:** Prospective students, families, sponsors, and FTC judges encounter internal login walls and OAuth boilerplate before seeing what ARES builds, teaches, or achieves.
- **Remediation:** Redesign `src/app/page.tsx` around a public-first hierarchy: Hero CTAs for `Join the Team` (`/join`) and `Explore Robots & Legacy` (`/robots`), preserving the signed-in session quick-jump when authenticated; a progressive `"Live from ARES"` strip backed by public DTOs (`/api/calendar/events`, `/api/content/posts`, `/api/seasons`, `/api/sponsors`) with truthful `PublicDataState` empty/error handling; Team/Robots/Impact showcase; Academy & Open-Source section retaining the `ARES Robotics Studio` + `/privacy` + `/terms` OAuth block; full 6-game `ARES Arcade` showcase from `ARCADE_GAMES`; and a closing Sponsors/Join section without auth-gated `/dashboard` cards.
- **Acceptance test:** Update and expand `src/test/HomeBranding.test.tsx` to verify Google OAuth compliance (`ARES Robotics Studio`, `/privacy`, `/terms`), public Hero CTAs when signed out, portal quick-jump when signed in, all 6 Arcade games, live pulse fallback/error truthfulness, and zero unauthenticated links to `/dashboard/*`.

### FL-05 — P2: Primary navigation promotes unavailable `/store` while omitting or burying high-value public routes

- **Confidence:** High; verified across `Navbar.tsx`, `navItems.ts`, `MobileNavDrawer.tsx`, `Footer.tsx`, and `CommandPalette.tsx`.
- **Evidence:**
  - `src/components/Navbar.tsx:119–124` and `src/components/navigation/navItems.ts:66` give `/store` both top-level desktop navbar placement and `Resources` dropdown placement despite checkout being disabled (`src/app/store/page.tsx:38`).
  - `src/components/navigation/navItems.ts:32–41,58–67`: `Tournaments` (`/tournaments`), `Sponsors` (`/sponsors`), `Financial Ledger` (`/finance`), and `Simulations Playground` (`/academy/playground`) are absent from `TEAM_LINKS` and `RESOURCE_LINKS` (and therefore absent from both desktop dropdowns and `MobileNavDrawer.tsx:154–178`), even though all four exist in `CommandPalette.tsx:33–36,48`.
  - `src/components/Footer.tsx:108–277` also omits `/tournaments` and `/finance` from its `Organization` and `Resources` columns.
- **Impact:** Mobile visitors and desktop browsers who do not press `Ctrl+K` have no menu path to `/tournaments`, `/finance`, or `/academy/playground`, while top-level navigation funnels clicks into an unlaunched store.
- **Remediation:** Demote `/store` to `Footer` (and `CommandPalette`) until checkout launches; promote `Join` and `Sponsors` in top-level `Navbar.tsx`; add `Tournaments`, `Sponsors`, and `Financial Ledger` to `TEAM_LINKS`, add `Interactive Simulations` (`/academy/playground`) to `RESOURCE_LINKS`, and align `Footer.tsx` columns.
- **Acceptance test:** Component tests covering `Navbar`, `MobileNavDrawer`, and `Footer` verifying `/join` and `/sponsors` top-level links, presence of `/tournaments`, `/finance`, and `/academy/playground` in menus, and retention of `/store` in Footer/Quick Jump.

### FL-06 — P2: Missing `<h1>` on Robot 404 state and Dashboard lockscreen degrades route announcements

- **Confidence:** High; verified in `LayoutWrapper.tsx` focus/announcement observer and target components.
- **Evidence:**
  - `src/components/layout/LayoutWrapper.tsx:42–73` searches `#main-content` for an `<h1>` on every client route transition to focus and announce `<heading> loaded`, falling back after a 2,000 ms timeout if no `<h1>` mounts.
  - `src/app/robots/[id]/page.tsx:51–58` renders `<h2>Robot Not Found</h2>` with no `<h1>`.
  - `src/app/dashboard/layout.tsx:64–179` renders `<h2>Administrative Gate</h2>` on the signed-out portal lockscreen with no `<h1>` (whereas the unauthorized state at line 196 properly uses `<h1>Portal access denied</h1>`).
- **Impact:** Navigating to a missing robot URL or an unauthenticated `/dashboard` URL leaves the page without a level-1 heading and delays screen-reader route confirmation by 2 seconds before falling back to generic `"Page loaded"`.
- **Remediation:** Promote `Robot Not Found` (`src/app/robots/[id]/page.tsx:53`) and `Administrative Gate` (`src/app/dashboard/layout.tsx:103`) from `<h2>` to `<h1>`.
- **Acceptance test:** Unit tests asserting an accessible level-1 heading (`role="heading", level: 1`) renders immediately on both states.

### FL-07 — P2: `/dashboard` splits daily context across two overview pages, omits 4/6 approval queues on home, lists 21 flat sidebar links, and misses 10 `Ctrl+K` routes

- **Confidence:** High; verified across `src/app/dashboard/page.tsx`, `src/app/dashboard/today/page.tsx`, `src/components/dashboard/DashboardSidebar.tsx`, and `src/components/navigation/CommandPalette.tsx`.
- **Evidence:**
  - `src/app/dashboard/page.tsx:124–155` (`Command Center`) and `src/app/dashboard/today/page.tsx:89–160` (`Team Today`) both open independent Firestore `onSnapshot(query(collection(db, "tasks"), ...))` listeners and present overlapping task/readiness summaries.
  - `src/components/dashboard/DashboardSidebar.tsx:107–120` consumes 6 approval/alert states (`pendingBlogApprovals`, `pendingEventApprovals`, `pendingAcademyApprovals`, `pendingAreslibApprovals`, `pendingDocumentApprovals`, `hasPendingInquiries`), whereas `src/app/dashboard/page.tsx:76–81,184–286` surfaces banners only for `pendingBlogApprovals` and `hasPendingInquiries` — leaving pending Event, Academy, ARESLib, and Cloud Resource approvals invisible on the Command Center home.
  - `src/components/dashboard/DashboardSidebar.tsx:196–479` renders up to 21 flat navigation items without collapsible section controls, including `/robots` (`Fleet Archive`) which exits the `/dashboard` shell unexpectedly.
  - `src/components/navigation/CommandPalette.tsx:59–74` includes only 11 portal items, omitting `/dashboard/today`, `/dashboard/zulip`, `/dashboard/areslib`, `/dashboard/simulations`, `/dashboard/documents`, `/dashboard/videos`, `/dashboard/photos`, `/dashboard/tournaments`, `/dashboard/seasons`, and `/dashboard/finance`.
- **Impact:** Students face two competing daily landing pages; mentors/coaches can miss staged Event, Academy, ARESLib, or Document approvals unless they scan sidebar badges; and power users cannot reach half the portal via `Ctrl+K`.
- **Remediation:** Merge `Team Today` capabilities (next scheduled practice/event, active announcement, due/priority tasks, recent team photos) into a unified role-aware `Command Center` (`/dashboard`) and redirect `/dashboard/today` cleanly to `/dashboard`; add a unified Mentor/Coach Approval Queue panel covering all 6 queues (including explicit error states); organize `DashboardSidebar` into collapsible role-aware groups; and register all portal routes in `CommandPalette` according to role.
- **Acceptance test:** Vitest coverage for `/dashboard` unified overview (all 6 approval queues + error states + next event/tasks), `/dashboard/today` redirect behavior, collapsible `DashboardSidebar` groups (`aria-expanded`), and role-filtered `CommandPalette` completeness.

### FL-08 — P3: Announcement banner and dashboard preview hardcode forbidden hex colors (`#07343b`, `#3d2b00`)

- **Confidence:** High; verified by static scan across `src/`.
- **Evidence:**
  - `src/components/SiteAnnouncementBanner.tsx:63–64` (`bg-[#07343b]`, `bg-[#3d2b00]`)
  - `src/app/dashboard/announcements/page.tsx:304–305` (`bg-[#3d2b00]`, `bg-[#07343b]`)
  - `docs/conventions/05-brand-guidelines.md:45–47`
- **Impact:** Bypasses `ares-design-tokens.css` with duplicated raw hex literals across public chrome and dashboard preview.
- **Remediation:** Replace arbitrary hex backgrounds with authorized dark semantic/brand surfaces (`bg-obsidian` / `bg-[var(--ares-app-surface-elevated)]` paired with `border-ares-cyan` / `border-ares-gold` and high-contrast `text-white`) in a shared announcement style map used by both components.
- **Acceptance test:** Source-token test confirming zero `#[0-9a-fA-F]` class literals in `SiteAnnouncementBanner.tsx` and `dashboard/announcements/page.tsx`, plus contrast verification `>= 4.5:1`.

### FL-09 — P3: Public routes mix four incompatible header/card layouts and apply double `6rem` top padding on four pages

- **Confidence:** High; verified in `LayoutWrapper.tsx` and route components.
- **Evidence:**
  - `src/components/layout/LayoutWrapper.tsx:142` already offsets `#main-content` by `calc(6rem + var(--site-announcement-height, 0px))` for the fixed navbar.
  - `src/app/accessibility/page.tsx:10`, `src/app/privacy/page.tsx:18`, `src/app/terms/page.tsx:17`, and `src/app/developer-api/page.tsx:24` add an extra `pt-24` (`6rem`), creating `192px` of empty top space before headings.
  - Public routes split across four uncoordinated header/card styles: compact `PageHeader` (`src/app/arcade/page.tsx:12`), `min-h-[50vh] py-28` centered meander heroes (`src/app/about/page.tsx:164`, `src/app/seasons/page.tsx:79`, `src/app/tech-stack/page.tsx:16`), giant left-aligned `text-7xl` headers (`src/app/blog/page.tsx:87`, `src/app/store/page.tsx:17`), and unrounded boxes (`src/app/developer-api/page.tsx:35`), while nearly every section sits on flat `bg-obsidian` without surface elevation or `marble` contrast bands.
- **Impact:** Navigating across public pages produces jarring jumps in heading vertical position, card corner geometry, and visual density.
- **Remediation:** Extend `PageHeader` (or a shared `PublicPageHero` / `SectionBand` pattern using existing `design/ares-design-tokens.json` variables), normalize top spacing across public routes, unify `.hero-card` / `.marble-card` usage, and introduce intentional `--ares-app-surface` elevation and `marble` contrast sections on multi-band public pages.
- **Acceptance test:** Render and visual/layout tests verifying consistent `<h1>` presence, absence of redundant `pt-24` shell offsets on wrapped public pages, and contrast compliance on both `obsidian` and `marble` bands.

### FL-10 — P3: Continuous `animate-pulse` and `animate-bounce` loops run indefinitely on static non-loading elements

- **Confidence:** High; verified by recursive scan across `src/`.
- **Evidence:**
  - Public static eyebrows/badges/icons: `src/app/about/page.tsx:167` (`Our Community & Heritage`), `src/app/tech-stack/page.tsx:19` (`Championship Architecture`), `src/app/join/page.tsx:120` (`Enrollment Open`), `src/app/tournaments/page.tsx:131` (lock icon).
  - Portal static chrome: `src/components/dashboard/DashboardSidebar.tsx:77,186,462` (active nav item icon and `Locked: View Only` badge), `src/app/dashboard/layout.tsx:96,121` (`animate-bounce` key icon and dev bypass label), `src/app/dashboard/page.tsx:169,293,322` (`animate-pulse` header icon and `animate-bounce` shield icon), `src/app/dashboard/components/DashboardServiceStatusCard.tsx:101` (`Not configured` static status).
- **Impact:** Even for users without `prefers-reduced-motion: reduce` enabled, perpetual pulsing/bouncing on static headings, active nav icons, and status labels creates visual fatigue and dilutes genuine loading/live-alert indicators (WCAG 2.2.2 Pause, Stop, Hide consideration for >5 second non-essential motion).
- **Remediation:** Reserve `animate-pulse` / `animate-spin` strictly for active transient loading skeletons/spinners and genuine live telemetry indicators; remove infinite `animate-pulse` and `animate-bounce` from static eyebrows, lockscreen icons, active nav icons, and static status badges.
- **Acceptance test:** Component/source assertions confirming static eyebrows, active sidebar links, and lockscreen headers do not carry `animate-bounce` or `animate-pulse`.

### FL-11 — P3: `initialCss` is at `94.3%` of its raw bundle budget (`188,523 / 200,000` bytes)

- **Confidence:** High; measured by `node scripts/check-bundle-size.mjs` on production build output.
- **Evidence:** `dist/` build check output: `PASS initialCss: 188523 raw / 24876 gzip bytes (budgets 200000 / 30000)` — leaving `11,477` raw bytes of headroom (`5.7%`).
- **Impact:** Proliferating one-off Tailwind arbitrary utilities (`tracking-[...]`, `shadow-[...]`, `min-h-[...]`, `bg-[#...]`) across Phases 2–4 could breach the `200,000` byte `initialCss` gate in CI.
- **Remediation:** Consolidate repeated hero, card, surface-band, and button patterns into shared React components and existing token utilities in `src/app/globals.css`, eliminating one-off arbitrary utility strings while verifying `node scripts/check-bundle-size.mjs` at the end of every phase.
- **Acceptance test:** `pnpm run build && node scripts/check-bundle-size.mjs` continues to pass with `initialCss <= 200,000` raw bytes and `<= 30,000` gzip bytes after all four phases without raising budget ceilings.

---

## Phased remediation roadmap

1. **Phase 1 — Audit baseline (this report):** Record verified baseline and acceptance criteria on `feature/fresh-look-phase-1-audit`.
2. **Phase 2 — Public Homepage & Navigation IA (`FL-03`, `FL-04`, `FL-05`):** Ship public-first `src/app/page.tsx` with progressive `"Live from ARES"` pulse, preserve Google OAuth `ARES Robotics Studio` + `/privacy` + `/terms` compliance, feature all 6 `ARCADE_GAMES`, remove auth-locked `/dashboard/tasks` from `/`, restructure `Navbar` / `navItems` / `MobileNavDrawer` / `Footer`, and synchronize `scripts/prerender-static-routes.mjs`.
3. **Phase 3 — Visual System & Public Page Polish (`FL-01`, `FL-02`, `FL-06` public, `FL-08`, `FL-09`, `FL-10` public, `FL-11`):** Fix `.clipped-button:hover` and Printables contrast defects, eliminate arbitrary hex literals, unify public headers/cards/padding, introduce `--ares-app-surface` elevation and `marble` contrast bands while keeping `design/ares-design-tokens.json` intact, and calm static infinite animations.
4. **Phase 4 — `/dashboard` Portal Streamlining (`FL-06` portal, `FL-07`, `FL-10` portal, `FL-11`):** Merge `Team Today` into a unified role-aware `Command Center` (`/dashboard`) with `/dashboard/today` redirect, surface all 6 mentor/coach approval queues on `/dashboard`, group `DashboardSidebar` into collapsible sections, complete `Ctrl+K` portal coverage, and run the full `AGENTS.md` verification gate.
