# ARESWEB 4-Domain Audit Checklists

Use these concrete checklists when auditing each non-overlapping domain. Every
confirmed finding must include exact `file:line` evidence, trigger conditions,
impact, remediation, and a concrete acceptance test.

---

## Domain 1 — Security, Youth Privacy, Rules & Backend APIs

**Scope:** `functions/src/**` (excluding game room physics covered in Domain 4),
`firestore.rules`, `storage.rules`, `tests/rules/**`.

1. **Three-way permission parity:** Compare Express route guards in
   `functions/src/routes/` and `functions/src/middleware/auth.ts`, client rules in
   `firestore.rules` / `storage.rules`, and dashboard UI gating across `admin`,
   `coach`, `mentor`, `member`, `unverified`, and archived (`isDeleted`) states.
2. **Pre-authorized user linking (`linkAuthorizedUserByEmail`):** Verify custom
   role helpers across routes (`tournaments.ts`, `portfolio.ts`,
   `profileAdmin.ts`, `calendarManageRoutes.ts`, `calendarOccurrenceRoutes.ts`,
   `seasons.ts`, `robots.ts`, `waggleWay.ts`, `drive.ts`) invoke
   `linkAuthorizedUserByEmail` before rejecting with `403`, so newly invited
   users do not fail on first direct API hit before `/api/profiles/session`.
3. **Archived-user & deletion preservation:** Confirm `/api/profiles/session`
   never mutates stored `role` in `authorized_users/{uid}` for archived users,
   and updates across `seasons`, `awards`, `posts`, `docs`, `documents`,
   `tournaments`, and `events` preserve existing `isDeleted` flags.
4. **Student PII & travel-readiness privacy:** Verify inquiry names/contact
   details are encrypted (`AES-256-GCM`) before Firestore write, public minor
   identities expose only approved nickname + avatar, `travel-readiness` and
   `travel-readiness/reveal` are restricted strictly to `admin`/`coach` with
   redacted audit logs (`functions/src/lib/logger.ts`), and inquiries stay blocked
   (`allow read, write: if false`) in `firestore.rules`.
5. **Public DTO allowlists:** Confirm public endpoints never spread raw
   Firestore documents or leak emails, phones, internal UIDs, receipt/Storage
   URLs, ciphertext, `approvedBy`, or operational metadata.
6. **Outbound webhooks, syndication & canonical links:** Verify Zulip
   (`functions/src/lib/zulip.ts`) and Bluesky (`functions/src/lib/bluesky.ts` /
   `functions/src/lib/socialSyndication.ts`) escape or bound untrusted metadata
   (rejecting wildcard mentions, injected Markdown links, or newlines) and emit
   canonical `https://aresfirst.org` URLs (check for stale `ares-ftc.org` or
   404 routes like `/admin/*`).
7. **Uploads, rate limits & App Check:** Confirm multipart/binary uploads
   authenticate and check size/type before buffering, apply safe Content-Type /
   Content-Disposition headers preventing active-content execution, and enforce
   App Check + rate limiting before expensive external fetches (`ftcScout`,
   GitHub, Drive, Gemini).
8. **Bounded queries & soft-delete pagination:** Verify list endpoints use
   Firestore ordering matching pagination cursors, scan in bounded batches when
   filtering `isDeleted !== 1` in memory, and never return truncated pages with
   `hasMore: false` early.

---

## Domain 2 — Public UX, WCAG 2.2 AA, SEO/Prerender & Print

**Scope:** Public routes in `src/App.tsx`, `src/app/**` (excluding `src/app/dashboard/**`
and game packages), `src/components/**`, `src/app/globals.css`, `design/`,
`scripts/prerender-static-routes.mjs`.

1. **Prerender-vs-live route parity:** Compare every route in
   `scripts/prerender-static-routes.mjs` against `src/App.tsx` and the live
   page component for truthful availability (`/store` checkout status), exact
   eligibility (`/join` grade options), complete rosters (`/arcade` 6 games),
   and canonical URLs (`https://aresfirst.org/...`).
2. **Homepage Google OAuth & storytelling:** Confirm `/` preserves
   `ARES Robotics Studio`, `/privacy`, and `/terms` links for OAuth verification
   while keeping public CTAs (`/join`, `/robots`, etc.) primary when signed out,
   with zero unauthenticated links funneling to auth-locked `/dashboard/*` cards.
3. **Design-token & CSS compilation discipline:**
   - In `src/app/globals.css`, verify all CSS `@import` statements stay
     consecutive and ahead of `@source` directives.
   - Check `src/` for hardcoded arbitrary hex color classes (`#[0-9a-fA-F]`) or
     off-brand accent drift outside `design/ares-design-tokens.json`.
   - Verify WCAG 2.2 AA contrast (`>= 4.5:1` normal text, `>= 3.0:1` large text
     and UI indicators) across rest, `:hover` (e.g., `.clipped-button:hover`),
     `:focus-visible`, badges, bronze/gold surfaces, QR codes, and printable
     sheets.
4. **Landmarks, headings & focus management:** Every public route, dynamic
   not-found view, empty state, and lockscreen must expose one semantic `<h1>`,
   skip link, visible focus indicator, accessible labels, and keyboard parity.
   Dialogs/drawers (`Navbar`, `MobileNavDrawer`, `CommandPalette`, modals) must
   trap focus, close on `Escape`, restore trigger focus, and unmount or set
   `inert` when collapsed.
5. **Reduced motion & calm UI:** Confirm `@media (prefers-reduced-motion)` or
   motion utilities respect user preferences and static non-loading text/icons do
   not run infinite `animate-pulse` or `animate-bounce` loops.
6. **Printables & truthful media/data:** Inspect `@media print` stylesheets and
   printable components (`/robots/:id` Pit Spec Card, `/sponsors` Team & Sponsor
   Fact Sheet) for readable light-mode contrast, clean QR geometry, and no
   clipped containers. Verify `PublicDataState` distinguishes loading, empty,
   and upstream error states without fabricating hardware, CAD, sponsors, or
   awards.

---

## Domain 3 — Portal (`/dashboard`), Championship Phases 1–4, Offline & Content

**Scope:** `src/app/dashboard/**`, `src/components/dashboard/**`, `src/hooks/`,
`src/context/`, `src/lib/pitModeOutbox.ts`, `src/lib/blogShareKit.ts`,
`src/lib/qrSvg.ts`, `content/learning/`.

1. **Portal navigation & role gating parity:** Audit every route under
   `src/app/dashboard/` alongside `DashboardSidebar.tsx`,
   `CommandPalette.tsx`, and `/dashboard` home cards for consistent role checks
   (`member`, `mentor`, `coach`, `admin`) against the backend route and
   `firestore.rules` (especially `Archive`, `Restore`, `Approve`, `Picklist`,
   `Travel Readiness`, `Roll Call`, `Portfolio`, `Finance`, and `Users`).
2. **Offline Pit Outbox (`src/lib/pitModeOutbox.ts` & tournament UI):**
   - Check shared-tablet safety: are queued scouting/triage entries keyed by
     authenticated `uid` + `tournamentId` so user B signing in on the same
     tablet does not replay or view user A's queued entries?
   - Check permanent `4xx` vs retryable `5xx`/network errors, corrupt
     `localStorage` JSON handling, storage quota errors, bounded queue caps, and
     duplicate submission idempotency.
3. **Travel Readiness & Roll Call privacy (`TravelReadinessPanel`,
   `EventFormRoster`, dashboard check-in):** Verify unrevealed PII stays masked,
   reveal actions require explicit `admin`/`coach` triggers, printable Emergency
   Binder omits unnecessary credentials/secrets and formats cleanly, and 4-digit
   lab check-in PIN flows cannot be self-spoofed via direct Firestore writes.
4. **Engineering Portfolio & Award Hub (`/dashboard/portfolio`):** Verify rubric
   scores, 15-page storyboard slots, Markdown/CSV/print exports (check CSV
   formula-injection escaping!), and gap flags reflect live Firestore/API counts
   truthfully without inflated completeness claims.
5. **Blog Share Kit (`src/lib/blogShareKit.ts`, `BlogShareKitModal.tsx`):**
   Audit `1080x1080` Canvas rendering for external cover-image CORS tainting
   (`crossOrigin` / fallback handling), clean text wrapping, URL parameter
   encoding in Web Intents, and full modal keyboard accessibility.
6. **Academy content & provenance (`content/learning/`):** Confirm `catalog.json`,
   `source-authorities.json`, `robotics-curriculum-plan.json`, and
   `release-candidate.json` reference one immutable `ARES-Robotics` commit with
   valid blob hashes, `requiresHumanReview: true`, and zero lingering old
   version strings outside dated historical logs.

---

## Domain 4 — Arcade, Simulations, Cloud Run, Selective CI/Deploy & Orphans

**Scope:** `packages/*`, `src/sims/`, `src/components/editor/`,
`src/components/simulation/`, `functions/src/gameServer.ts`,
`functions/src/biobuzzServer.ts`, `functions/src/lib/` (game/room logic),
`.github/workflows/`, `infra/`, `scripts/`, `config/bundle-budgets.json`,
`public/`.

1. **Package independence & generated copies:** Confirm none of the 8 packages
   under `packages/` import `src/` website modules or Firebase SDKs, and no
   canonical logic lives in ignored generated copies (`functions/src/generated/`,
   `public/games/`, `public/data/`, `functions/data/`).
2. **Simulation iframe isolation:** Verify every user-authored simulation or
   static game iframe (`Pollinator`, sim runners) uses an opaque sandbox
   (`allow-scripts` NEVER combined with `allow-same-origin`) and validates
   `postMessage` origins/schemas strictly.
3. **Cloud Run game & BIOBUZZ servers (`gameServer.ts`, `biobuzzServer.ts`):**
   Inspect HTTP vs WebSocket origin allowlists (production + Firebase preview
   channels), handshake vs reconnect leases, stale room eviction under
   `maxRooms` pressure, drain/resume admission locks, and rate/payload bounds.
4. **Selective CI & deployment fingerprint integrity:**
   - Programmatically verify every file under `src/`, `functions/src/`,
     `packages/`, `scripts/`, `infra/`, `content/` is intentionally covered by
     `infra/verification-areas.json` (`shared` or `areas`) — unmapped files
     must not silently skip affected checks if `affected-areas.mjs` misclassifies
     them, and `components` lists must include every deployed Function/Cloud Run
     service touched by that area.
   - Verify `scripts/deployment-fingerprints.mjs` hashes every transitive source
     file, shared module, workspace dependency, Docker context, and lockfile for
     each `coreApi`, `publicApi`, `mediaApi`, `driveApi`, `communicationsApi`,
     `game`, `biobuzz`, scheduled Function, and `hosting` component.
   - Check `.github/workflows/ci.yml` for pinned third-party action SHAs, WIF auth,
     container `safe.directory`, `pnpm` flag forwarding (no literal `--` bug), and
     complete shard coverage enforcement (`check-e2e-shards.mjs`).
5. **Bundle budgets & orphan/dead-code audit:** Review `config/bundle-budgets.json`
   margins (`initialJs`, `initialCss`, `academyInteractiveJs`, `editorRuntimeJs`),
   check dependencies/devDependencies, and trace any suspected orphan code,
   routes, scripts, or `public/` assets across all 10 required discovery
   channels before reporting them.
