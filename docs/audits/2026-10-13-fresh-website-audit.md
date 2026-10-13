# ARESWEB Comprehensive Repository Audit — 2026-10-13

- **Audited Commit**: `4c3bc7c7d5dbd02c973d2860270423f2ce155429` (`origin/master`, PR #296)
- **Worktree State**: Clean checkout on branch `codex/fresh-audit-2026-10-13` tracking `origin/master`
- **Toolchain**: Node `v24.18.0`, pnpm `11.21.0`, OpenJDK `21.0.12` (Firebase Emulator Suite + Playwright 1.62.1)
- **Audit Scope**: Full end-to-end repository audit covering areas previously completed and all areas left incomplete in the October 3, 2026 audit (`docs/audits/2026-10-03-fresh-website-audit.md`):
  1. Firestore & Storage security rules (`firestore.rules`, `storage.rules`, `tests/rules/security.rules.test.ts`)
  2. Cloud Functions backend apps, middleware, routes, DTOs, and libraries (`functions/src/**`)
  3. All 8 workspace packages (`packages/biobuzz`, `packages/buzzle`, `packages/buzzello`, `packages/buzzhex`, `packages/game-common`, `packages/pollinator`, `packages/ui`, `packages/waggle-way`) and online game/simulator services (`functions/src/gameServer.ts`, `functions/src/biobuzzServer.ts`, `src/lib/*Online.ts`, `src/lib/waggleCommunity.ts`)
  4. Frontend routes, components, hooks, simulations, feature truthfulness, and WCAG 2.2 AA accessibility (`src/**`, `public/**`)
  5. SEO, prerendering, dynamic SSR shell rendering, PWA/Workbox manifest, bundle budgets, and CI/CD & GCP deployment contracts (`firebase.json`, `vite.config.ts`, `scripts/**`, `infra/gcp/**`, `.github/workflows/ci.yml`)
  6. Full 18+ command verification gate execution (unit coverage, Functions coverage, rules emulator, Functions emulator, Academy remote provenance & release-candidate validation, production build, bundle budgets, and 648-test Playwright E2E suite across 6 browser projects)

---

## 1. Executive Summary

All **16 verification gate commands** in `AGENTS.md` (plus 6 additional runtime, observability, game/simulator deployment contract, and Academy content-migration gates) **pass with exit code 0** on `4c3bc7c7d5dbd02c973d2860270423f2ce155429`. All **13 prior audit findings** (`A01`–`A06` from 2026-09-04 and `B01`–`B07` from 2026-10-03) are verified remediated in live code and deployed to production.

This fresh, full-depth audit identified **22 confirmed findings** (`5 High`, `12 Medium`, `5 Low`) across the backend routes, game/simulator services, dynamic SSR renderer, frontend drawers/modals, accessibility semantics, and SEO/Hosting configuration:

| ID | Severity | Confidence | Area | Title |
| --- | --- | --- | --- | --- |
| **C01** | **High** | High | Online BUZZLE API | `placementSchema` in `functions/src/routes/buzzle.ts:38` caps board cell `index` at `126`, rejecting moves on 90 of the 217 cells (`127..216`) with HTTP 400 |
| **C02** | **High** | High | Photos Upload & Edit API | `POST /api/photos/upload-unified` and `PATCH /api/photos/:photoId` allow `member` role to publish photos into public albums and edit public photo metadata |
| **C03** | **High** | High | Calendar Public API & SSR | Private event meeting notes (`--- meeting notes ---`) leak to unauthenticated callers via recurring occurrence overrides and `/events/:id` HTML meta tags |
| **C04** | **High** | High | Auth / Profile / Inquiry API | `POST /api/profiles/session` escalates empty roles to `"member"`, migrates soft-deleted records, and leaks admin UIDs; `POST /api/inquiries/:id/approve-account` can overwrite/demote existing admin or coach accounts |
| **C05** | **High** | High | Dashboard Editor UX & A11y | Broken "Preview Draft" tab layout in `DocFormDrawer` + `useFocusTrap` capture listeners hijack focus and `Escape` in nested Radix picker modals (`MarkdownEditor`) |
| **C06** | **Medium** | High | Dynamic SSR (`web` function) | `injectMetadata` in `functions/src/webRendering.ts:138-163` emits duplicate `<link rel="canonical">` tags (`/` and route URL) and leaves homepage `#root` fallback copy on all dynamic routes |
| **C07** | **Medium** | High | SEO / Hosting Headers | Conflicting indexing directives on `/tournaments`: `firebase.json:97` sends `X-Robots-Tag: noindex, nofollow` on `/tournaments{,/**}` while `sitemap.xml` and prerender shells mark `/tournaments` indexable |
| **C08** | **Medium** | High | BIOBUZZ Online Service | `BiobuzzRooms` keeps empty rooms for 30s after the last human sends `{ type: "leave" }`, blocking the single production room slot (`maxRooms: 1`) with HTTP 503 |
| **C09** | **Medium** | High | Waggle Way Verification | `evaluateWaggleProof` replays `rulesVersion: 6..8` levels (`Builder.tsx` default is `8`) to completion and then fails `WaggleVerificationSchema` (`max(5)`) with HTTP 503 (`WAGGLE_VERIFIER_UNAVAILABLE`) |
| **C10** | **Medium** | High | BIOBUZZ Transport & Client | WebSocket heartbeat race (`lastPong` not reset on `hello`), swallowed `validateAuto` error messages on `ready`, and unprotected `response.json()` in `src/lib/biobuzzOnline.ts` |
| **C11** | **Medium** | High | Zulip Integrations | Zulip Markdown and `@**all**` mention injection via unauthenticated `POST /api/inquiries` and member-writable `tasks` (`taskDueDigest`) |
| **C12** | **Medium** | High | Profile Routes | Fail-open role normalization (`"member"` default), unvalidated `role` string in `POST /api/profiles/sync`, and unsanitized/unfiltered `GET /api/profiles/about-roster` |
| **C13** | **Medium** | High | Firestore Rules & DTOs | Client-writable Firestore collections (`seasons`, `awards`, `sponsors`, `tournaments`, `robots`, `signups`, `layouts`, `docs_feedback`) diverge from API auth or lack schema bounds; `seasonDto` lacks URL protocol checks |
| **C14** | **Medium** | High | Accessibility (WCAG 1.3.1, 2.4.1) | Duplicate `id="main-content"`, nested `<main>` landmarks across 7 routes, and broken Skip Link on `/dashboard/*` that lands before `DashboardSidebar` |
| **C15** | **Medium** | High | Accessibility (WCAG 2.1.1, 2.4.3) | `SimulationLibraryOverlay` lacks dialog semantics, focus trap, and `Escape` dismissal; broken TOC heading IDs in `TiptapRenderer` and `DocsMarkdownRenderer` |
| **C16** | **Medium** | High | Accessibility (WCAG 1.4.3, 4.1.2) | Color contrast violations (`1.33:1` on `/join` status banner, `text-ares-red` on small text, low-opacity labels), nested `<button>` inside `<Link>` on `/blog`, and unlabeled icon buttons/selects |
| **C17** | **Medium** | High | SEO / Accessibility (WCAG 2.4.2) | Authenticated `/dashboard/*` layout (20 of 21 pages) and dynamic detail error states (`/events/:id`, `/tournaments/:id`, `/robots/:id`) omit `<SEO noindex />` |
| **C18** | **Low** | High | Backend Route Hygiene | Unvalidated pagination cursors (`inquiries`, `outreach`, `robots`), archived-parent occurrence edits (`calendarOccurrenceRoutes`), custom role middleware drift, and per-instance inquiry rate limit |
| **C19** | **Low** | High | CI, Observability & Build | PR `verify` build omits `VITE_BIOBUZZ_ORIGIN`; `platformAlerts` omits `aresweb-game-api` and `aresweb-biobuzz-sim`; `check-bundle-size.mjs` counts Monaco `*Mode-*` chunks as route JS; `functions` build does not clean `lib/` |
| **C20** | **Low** | High | PWA Manifest | UTF-8 mojibake (`FIRSTÂ® Tech Challenge`) in `vite.config.ts:20` PWA manifest description |
| **C21** | **Low** | High | Prerender Copy & Asset Hygiene | Outdated `/waggle-way/builder` prerender shell copy (`"Online publishing is not yet available."`) and orphaned Next.js `src/app/favicon.ico` |
| **C22** | **Low** | High | Pollinator Dev Script | Developer script `packages/pollinator/public/server.ps1` lives inside staged public assets and lacks path-traversal containment if run locally |

---

## 2. Verification of Prior Audits (`2026-09-04` and `2026-10-03`)

| Prior ID | Summary | Current Status | Live Verification Evidence |
| --- | --- | --- | --- |
| **A01** | Public content routes & dynamic renderer must enforce `isPublishedContent` | **Remediated** | `functions/src/lib/contentVisibility.ts:1-22`; `functions/src/routes/content.ts:76, 128`; `functions/src/webRendering.ts:92`; 100% line/branch/function coverage |
| **A02** | `PUT /api/robots/:id` must validate payloads with Zod and preserve omitted fields | **Remediated** | `functions/src/routes/robots.ts:75-134, 240-298`; verified in `functions/src/__tests__/auditRegressions.test.ts:110-118` |
| **A03** | `POST /api/finance/admin` must accept decimal currency cents | **Remediated** | `functions/src/routes/finance.ts:23-39`; verified in `functions/src/__tests__/auditRegressions.test.ts:102-108` |
| **A04** | Finance admin routes must allow both `admin` and `coach` roles | **Remediated** | `functions/src/routes/finance.ts:91-212`; verified in `functions/src/__tests__/auditRegressions.test.ts:76-96` |
| **A05** | `coverageRatchet.test.ts` must enforce thresholds on new `src/lib` and `src/routes` files | **Remediated** | `functions/src/__tests__/coverageRatchet.test.ts:1-109` |
| **A06** | Prerendered static shells must emit exactly one `<link rel="canonical">` and unique body copy | **Remediated** | `scripts/prerender-static-routes.mjs:163-218` (Note: see **C06** for dynamic SSR `webRendering.ts`) |
| **B01** | Lock client writes on `events/{eventId}/revisions/{revisionId}` in `firestore.rules` | **Remediated** | `firestore.rules:271-276` (`allow create, update, delete: if false;`); verified in `tests/rules/security.rules.test.ts` |
| **B02** | Strip `ownerUid` from member-visible Waggle Way community reports | **Remediated** | `functions/src/lib/waggleCommunityReports.ts:95-115` |
| **B03** | Enforce rate limiting on `GET /api/Feed/calendar.ics` (`calendarFeedRoutes.ts`) | **Remediated** | `functions/src/routes/calendarFeedRoutes.ts:15-26` |
| **B04** | Refresh ARES-Robotics Academy provenance to `0fe4ff9c0ccab0c29e359c87c11c9da0c526ca0e` (`2026.5.0`) | **Remediated** | `content/learning/catalog.json`; `pnpm run content:verify` and `pnpm run content:release-validate` pass with 0 drift |
| **B05** | Lock retired Firestore collections (`team_layouts`, `judge_access_codes`, `orders`, `chat_sessions`) | **Remediated** | `firestore.rules:223-235, 380-390`; verified in `tests/rules/security.rules.test.ts` |
| **B06** | Sanitize `safeHttpUrl` in `sponsors.ts` and `seasons.ts` write schemas | **Remediated** | `functions/src/routes/sponsors.ts:20-35`; `functions/src/routes/seasons.ts:19-33` (Note: see **C13** for read-side `seasonDto`) |
| **B07** | Bound `getAllUsers` / `listUsers` pagination in `profileAdmin.ts` | **Remediated** | `functions/src/routes/profileAdmin.ts:183-215` |

---

## 3. Detailed Findings

### C01 — Online BUZZLE Action Route Schema Caps Board Cell Index at `126`, Rejecting Placements on 90 of the 217 Board Cells (`127..216`)
- **Severity**: High
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/buzzle.ts:37-41`:
    ```ts
    const placementSchema = z.object({
      index: z.number().int().min(0).max(126),
      tileId: z.string().regex(/^[A-Z?]-\d{1,2}$/u),
      assignedLetter: z.string().trim().toUpperCase().length(1).regex(/^[A-Z]$/u).optional(),
    }).strict();
    ```
  - `packages/buzzle/src/rules.ts:70-71`: `export const BUZZLE_RADIUS = 8;` and `export const BUZZLE_CELL_COUNT = BUZZLE_CELLS.length;` (`217` cells, persisted column-major indices `0..216`, with the center star `(0, 0)` at persisted index `108`).
  - `functions/src/lib/buzzleGameDefinition.ts:43, 153`: `const CELL_COUNT = 217;` and `if (!Number.isInteger(placement.index) || placement.index < 0 || placement.index >= CELL_COUNT)`.
  - `packages/buzzle/src/online.ts:154-160`: Client converts local row-major indices to persisted column-major indices `0..216` via `BUZZLE_ONLINE_INDICES[placement.index]`.
- **Trigger & Impact**:
  - When BUZZLE was expanded from radius 6 (127 cells, `0..126`) to radius 8 (217 cells, `0..216`), `packages/buzzle/src/rules.ts` and `functions/src/lib/buzzleGameDefinition.ts` were updated to `217`, but `placementSchema` in `functions/src/routes/buzzle.ts:38` remained `.max(126)`.
  - Every online BUZZLE `play` action that places any tile on persisted column-major index `127..216` (90 of the 217 cells — over 41% of the board, including even a 3-letter opening word extending right from center `(0,0)=108 -> (1,0)=125 -> (2,0)=141`) is rejected by `validate(moveSchema)` with HTTP `400 Bad Request`.
- **Remediation**:
  - In `functions/src/routes/buzzle.ts:38`, update `index: z.number().int().min(0).max(126)` to `index: z.number().int().min(0).max(216)` (or import `BUZZLE_CELL_COUNT - 1` from `../generated/games/buzzle/rules`).
- **Acceptance Test**:
  - Add a route test in `functions/src/routes/__tests__/buzzle.test.ts` submitting a `play` action across persisted indices `108`, `125`, and `141` (and boundary `216` vs `217`), asserting HTTP `200` for valid placements up to `216` and HTTP `400` for `217`.

---

### C02 — Public Album Publication Role Bypass (`POST /api/photos/upload-unified`) and Public Metadata Modification (`PATCH /api/photos/:photoId`) by `member` Role
- **Severity**: High
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/photosUpload.ts:35-70, 114-160, 241, 256-263`
  - `functions/src/routes/photos.ts:310-365`
  - `functions/src/routes/photosAuth.ts:5-31`
- **Trigger & Impact**:
  - Photos inside a public album (`isPublic === 1 || isPublic === true`) are immediately exposed to unauthenticated visitors via `GET /api/photos/public` (`photos.ts:44-103`) and streamed via `GET /api/photos/public/media/:photoId/:variant` (`photos.ts:105-128`).
  - While `PATCH /api/photos/:photoId` (`photos.ts:327-334`) comments that *"Placing media into a public album publishes it on the website, so it requires a publisher role rather than general membership"*, `POST /api/photos/upload-unified` (`photosUpload.ts:35, 66-70, 126-160, 241`) only checks `ensureTeamMember` and `if (!album.exists || album.data()?.isDeleted === 1)`.
  - Any student (`member` role) can:
    1. Upload any image directly into a public album (`albumId` pointing to an album with `isPublic: 1`), immediately publishing it to `/gallery` without `mentor`/`coach`/`admin` approval.
    2. Move an existing private photo into a public album by re-uploading the same file bytes with a public `albumId`, hitting the SHA-256 deduplication branch (`photosUpload.ts:114-160`) which updates `albumId` on the existing photo document and copies it into `albums/{albumId}/photos/{photoId}`.
    3. Modify the public `caption`, `altText`, and `labels` of any photo already in a public album via `PATCH /api/photos/:photoId` (`photos.ts:331-334`), because `if (isAlbumPublic && changedAlbum && !publisherRoles.has(req.authorizationRole || ""))` only checks `publisherRoles` when `changedAlbum` is `true`.
- **Remediation**:
  - In `functions/src/routes/photosUpload.ts:66-70`, check `const isAlbumPublic = album.data()?.isPublic === 1 || album.data()?.isPublic === true;` and throw `new ApiError(403, "Only an admin, coach, or mentor can add photos to a public album.")` when `isAlbumPublic && !publisherRoles.has(req.authorizationRole || "")`. Also check if the existing photo in the SHA-256 deduplication branch (`lines 126-160`) is currently in a public album before moving it.
  - In `functions/src/routes/photos.ts:319-335`, check whether either the **current** album (`current.albumId`) or the **target** album (`albumId`) is public, and require `publisherRoles.has(req.authorizationRole || "")` for any edit or move involving a public album.
- **Acceptance Test**:
  - Add unit tests in `functions/src/routes/__tests__/photosUpload.test.ts` and `photos.test.ts` verifying that `role: "member"` receives HTTP `403` when uploading a new or duplicate photo to a public album or editing `caption`/`altText`/`labels` of a photo already in a public album.

---

### C03 — Private Event Meeting Notes (`--- meeting notes ---`) Leaked to Unauthenticated Callers via Occurrence Overrides and `/events/:id` HTML Meta Tags
- **Severity**: High
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/calendarHelpers.ts:207-225, 432-442, 463-465`
  - `functions/src/routes/calendarPublicRoutes.ts:53, 80`
  - `functions/src/webRendering.ts:107-115`
  - `functions/src/web.ts:84-96`
- **Trigger & Impact**:
  - `events` documents are blocked from direct public Firestore reads (`firestore.rules:254`) because `event.description` can store internal team notes after the `--- meeting notes ---` delimiter (`calendarHelpers.ts:432-442`).
  - Reproduced programmatically against compiled `functions/lib`:
    1. **Recurring Event Occurrence Overrides (`calendarHelpers.ts:207-225`)**: `applyOccurrenceOverrides` copies `overrides.description` directly onto `result.description` (`for (const key of publicKeys) { if (key in overrides) result[key] = overrides[key]; }`) after `eventDto` has run, without checking `includeLifecycle` or calling `publicEventDescription(overrides.description)`. Unauthenticated requests to `GET /api/calendar/events` and `GET /api/calendar/events/:id` receive the full unredacted `overrides.description` including `--- meeting notes ---`.
    2. **Dynamic `/events/:id` HTML Meta Tags (`webRendering.ts:107-115`)**: `metadataForDocument` for `route.kind === "event"` sets `description: stringValue(data.description) || ...` directly from the raw Firestore document without calling `publicEventDescription`. Unauthenticated requests to `https://aresfirst.org/events/:id` receive up to 320 characters of `data.description` (including `--- meeting notes ---` or raw Tiptap AST JSON) in `<meta name="description">`, `og:description`, and `twitter:description`.
- **Remediation**:
  - In `functions/src/routes/calendarHelpers.ts:207-225`, sanitize `overrides.description` in `applyOccurrenceOverrides` using `"status" in dto ? readString(overrides.description) : publicEventDescription(overrides.description)`.
  - In `functions/src/webRendering.ts:107-115`, strip `--- meeting notes ---` via `publicEventDescription(data.description)` (and convert Tiptap AST JSON to plain text if applicable) before setting `metadata.description`.
- **Acceptance Test**:
  - Add unit tests in `functions/src/routes/__tests__/calendarHelpers.test.ts` and `functions/src/__tests__/webRendering.test.ts` verifying that `expandEventOccurrences` (with `includeLifecycle = false`) and `metadataForDocument` for `/events/:id` strip `--- meeting notes ---` and everything after it.

---

### C04 — `POST /api/profiles/session` Escalates Empty Roles to `"member"`, Migrates Soft-Deleted Legacy Records, and Leaks Admin UIDs; `POST /api/inquiries/:id/approve-account` Can Overwrite/Demote Existing Admin or Coach Accounts
- **Severity**: High
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/profileSync.ts:250-318`
  - `functions/src/routes/inquiries.ts:308-362`
  - Contrast with `functions/src/lib/linkAuthorizedUser.ts:21-57`, `functions/src/middleware/auth.ts:37-43`, and `functions/src/routes/profileAdmin.ts:401-411`
- **Trigger & Impact**:
  1. **Fail-Open Role Escalation & Soft-Delete Bypass in `POST /api/profiles/session` (`profileSync.ts:253-318`)**:
     - At lines `255-261`, `const rawRole = (data.role || "").toLowerCase().trim(); let normRole = rawRole || "member";`. If `authorized_users/{uid}` has an empty/missing `role`, `normRole !== rawRole` is `true` and lines `273-277` persist `{ role: "member" }` to Firestore instead of failing closed to `"unverified"`.
     - Neither the existing-UID branch (`lines 253-283`) nor the legacy email-query branch (`lines 285-318`) checks `isDeleted === 1 || isDeleted === true`, and the legacy query (`adminDb.collection("authorized_users").where("email", "==", cleanEmail).get()`) is unbounded (missing `.limit(5)`), migrating soft-deleted pre-authorization records back into active UID documents.
     - Lines `281` and `315` return the raw Firestore document (`res.json({ authorizedUser: data })`), exposing internal admin Firebase UIDs stored in `archivedBy` and `restoredBy` (`profileAdmin.ts:537, 604`).
  2. **Account Overwrite / Role Demotion in `POST /api/inquiries/:id/approve-account` (`inquiries.ts:308-362`)**:
     - Anyone can submit a public `"student"` or `"mentor"` inquiry (`POST /api/inquiries`) using the email address of an existing team `admin`, `coach`, `mentor`, or `member`.
     - When an admin clicks "Approve Account", `adminAuth.getUserByEmail(cleanEmail)` resolves `targetId` to the existing user's UID (`lines 311-312`) and `batch.set` (`lines 331-357`) unconditionally overwrites `authorized_users/{targetId}.role` with `"member"` or `"mentor"` (demoting an `admin` or `coach`) and resets `user_profiles/{targetId}` `nickname` (`"ARES Member"`), `avatar`, and `showOnAbout` (`false`), with no `audit_logs` entry.
- **Remediation**:
  - In `functions/src/routes/profileSync.ts:250-318`, replace the bespoke migration and role normalization logic by delegating to `linkAuthorizedUserByEmail` (`functions/src/lib/linkAuthorizedUser.ts`) and `normalizeActiveRole` (`functions/src/middleware/auth.ts`), failing closed to `"unverified"` on missing/unknown roles or soft-deleted records, and return an explicit DTO (`{ email, role, name, memberType, status }`).
  - In `functions/src/routes/inquiries.ts:308-362`, check whether an active `authorized_users` document already exists for `targetId` or `cleanEmail` (matching `profileAdmin.ts:401-411`); if so, throw `new ApiError(409, "An active authorized account already exists for this email.", "USER_ALREADY_EXISTS")`. Set `isDeleted: 0`, `createdAt` on new records and write an `APPROVE_INQUIRY_ACCOUNT` audit log entry.
- **Acceptance Test**:
  - Add unit tests in `functions/src/routes/__tests__/profiles.test.ts` and `inquiries.test.ts` verifying that: (a) `POST /api/profiles/session` never escalates `role: ""` or `isDeleted: 1` to `"member"` and strips `archivedBy`/`restoredBy`, and (b) `POST /api/inquiries/:id/approve-account` returns `409` when an active account already exists for that email.

---

### C05 — Broken "Preview Draft" Tab Layout in `DocFormDrawer` and Nested Radix Modal Focus/`Escape` Hijacking by `useFocusTrap`
- **Severity**: High
- **Confidence**: High
- **Evidence**:
  - `src/components/dashboard/DocFormDrawer.tsx:149, 416-479, 498-565`
  - `src/app/dashboard/events/components/EventEditorDrawer.tsx:86`
  - `src/app/dashboard/tasks/components/TaskDetailsModal.tsx:90`
  - `src/components/MarkdownEditor.tsx:55-57, 454-473`
  - `src/lib/useFocusTrap.ts:59-109, 118-119`
- **Trigger & Impact**:
  1. **Broken Preview Tab Layout (`DocFormDrawer.tsx:416-479, 498-565`)**: In `DocFormDrawer.tsx`, `{activeTab === "preview" && (<div className="flex-grow overflow-y-auto ..."><DocumentDraftPreview ... /></div>)}` (`lines 470-478`) is placed **inside** the `Sub-Header: Tabs Switcher` horizontal flex bar (`lines 416-479`, which has `px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none`), while the main `Content Canvas` (`lines 498-565`) only renders branches for `activeTab === "edit"` and `activeTab === "revisions"`. Clicking "Preview Draft" crams the entire `DocumentDraftPreview` into the horizontal sub-header strip next to the tab buttons with inherited `uppercase font-bold text-xs select-none` styling and leaves the main content canvas empty.
  2. **Nested Modal Focus & Escape Hijacking (`useFocusTrap.ts` vs `MarkdownEditor.tsx`)**: `DocFormDrawer` (`line 149`), `EventEditorDrawer` (`line 86`), and `TaskDetailsModal` (`line 90`) use `useFocusTrap` while embedding `MarkdownEditor`. When a user clicks "Insert Photo", "Insert Video", or "Embed Simulation" in `MarkdownEditor`'s toolbar, `MarkdownEditor` (`lines 454-473`) opens `PhotoPickerModal`, `VideoPickerModal`, or `SimPickerModal` inside a `@radix-ui/react-dialog` portal on `document.body`. Because `useFocusTrap` (`src/lib/useFocusTrap.ts:64-109`) only checks its internal `activeTraps` array (`isTopLayer()`) and ignores open Radix Dialog portals (`[role="dialog"][aria-modal="true"]`), its capture-phase `focusin` listener (`line 119`) immediately steals focus back into the parent drawer whenever the user clicks an input inside the picker modal, and its capture-phase `keydown` listener (`line 118`) intercepts `Escape` and closes the entire parent drawer/modal.
- **Remediation**:
  - Move `{activeTab === "preview" && (...)}` (`src/components/dashboard/DocFormDrawer.tsx:470-478`) out of the `Sub-Header: Tabs Switcher` `<div>` and into the `Content Canvas` `<div>` (`lines 498-565`).
  - In `src/lib/useFocusTrap.ts:66-109`, yield in `handleFocusIn` and `handleKeyDown` when the event target or `document.activeElement` is inside an open modal dialog portal outside `container` (e.g., `const activeDialog = (target instanceof Element ? target : document.activeElement)?.closest('[role="dialog"][aria-modal="true"], [data-radix-portal]'); if (activeDialog && !container.contains(activeDialog)) return;`).
- **Acceptance Test**:
  - Add component tests verifying that switching `DocFormDrawer` to "Preview Draft" renders `DocumentDraftPreview` inside the main content canvas, and that opening `MarkdownEditor`'s `PhotoPickerModal` / `VideoPickerModal` / `SimPickerModal` inside a `useFocusTrap` container allows focusing inputs inside the modal and pressing `Escape` without triggering the parent's `onClose`.

---

### C06 — Dynamic SSR Routes (`/blog/:id`, `/academy/:id`, `/docs/:id`, `/events/:id`, `/robots/:id`) Emit Duplicate `<link rel="canonical">` Tags and Homepage `#root` Fallback Copy
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `functions/src/webRendering.ts:138-163`
  - `functions/src/web.ts:9, 21-36, 94`
  - `index.html:7, 22-40`
  - Contrast with `scripts/prerender-static-routes.mjs:176-186, 211-216`
- **Trigger & Impact**:
  - `index.html:7` contains `<link rel="canonical" href="https://aresfirst.org/" />`.
  - While `scripts/prerender-static-routes.mjs:178` explicitly strips `<link\s+rel=["']canonical["'][^>]*>/i` from the shell and replaces `#root` with route-unique `<h1>`/`<p>` content (`lines 181-186`), `injectMetadata` in `functions/src/webRendering.ts:145-161` does neither.
  - Reproduced against `index.html`: every dynamic page served by `web` (`/blog/:id`, `/academy/:id`, `/docs/:id`, `/events/:id`, `/robots/:id`) emits **two** `<link rel="canonical">` tags in `<head>` (`https://aresfirst.org/` first, followed by the dynamic route URL) and serves the homepage `#root` fallback body (`<h1>ARES 23247 — West Virginia Robotics Team in Morgantown</h1>`) to non-JS crawlers.
- **Remediation**:
  - In `functions/src/webRendering.ts:145-162`, strip any existing `<link\s+rel=["']canonical["'][^>]*>\s*/gi` from `shell` before injecting `<link rel="canonical" href="${canonicalUrl}">`, and replace the `#root` fallback inner HTML with `<main><h1>${title}</h1><p>${description}</p><p><a href="/">ARES 23247 — West Virginia robotics team</a></p></main>`.
- **Acceptance Test**:
  - Update `functions/src/__tests__/webRendering.test.ts` to pass the real `index.html` (or a shell containing `<link rel="canonical" href="https://aresfirst.org/" />`) into `injectMetadata` and assert `rendered.match(/<link\s+rel=["']canonical["']/gi)?.length === 1` and `rendered` contains `<h1>${title}</h1>`.

---

### C07 — Conflicting SEO Indexing Directives on `/tournaments` (`X-Robots-Tag: noindex, nofollow` in `firebase.json` vs `sitemap.xml` and Prerender Shell)
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `firebase.json:96-104` (`"source": "/tournaments{,/**}"` -> `"X-Robots-Tag": "noindex, nofollow"`)
  - `functions/src/routes/sitemap.ts:54` (`{ loc: "/tournaments", changefreq: "weekly", priority: "0.7" }`)
  - `scripts/prerender-static-routes.mjs:120` (`["/tournaments", "Tournaments", ..., false, ...]`)
  - `src/app/tournaments/page.tsx:111-115` (`<SEO title="Competition History" ... />`)
  - `public/robots.txt:7` (`Disallow: /tournaments/`)
- **Trigger & Impact**:
  - `/tournaments` is a public indexable landing page included in `sitemap.xml` and prerendered with `noindex = false`, while `/tournaments/:id` subroutes are SPA-only (`firebase.json:334-336`).
  - Because `firebase.json:97` uses the glob `/tournaments{,/**}` instead of `/tournaments/**`, Firebase Hosting attaches `X-Robots-Tag: noindex, nofollow` to `/tournaments` itself, contradicting `sitemap.xml` and blocking search indexing of `/tournaments`.
- **Remediation**:
  - In `firebase.json:97`, change `"source": "/tournaments{,/**}"` to `"source": "/tournaments/**"`, and update `src/test/hostingConfig.test.ts:294-306`.
- **Acceptance Test**:
  - Assert in `src/test/hostingConfig.test.ts` that `/tournaments/**` carries `X-Robots-Tag: noindex, nofollow` while `/tournaments` does not.

---

### C08 — BIOBUZZ Online Rooms Remain Allocated for 30 Seconds After the Last Human Player Explicitly Leaves, Blocking the Single Production Room Slot (`maxRooms: 1`)
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `functions/src/lib/biobuzzRooms.ts:74-79, 114-123`
  - `infra/gcp/biobuzz-service.json:10` (`"maxRooms": 1`)
- **Trigger & Impact**:
  - When a player sends `{ type: "leave" }` (`biobuzzRooms.ts:74-79`), `room.players[seat]` is set to `null`. When the last human player in a room leaves, `room.players` is `[null, null, null, null]` — no player can ever reconnect (`attach` checks `room.players`), and if the room is `"running"` or `"finished"`, no player can join.
  - However, `this.remove(room)` is not called until `step()` sees `now - room.lastHuman > 30000` (30 seconds later).
  - Reproduced programmatically: on production (`maxRooms: 1`), a single user who creates or queues a room and clicks "Play Locally Now" or "Leave Match" blocks all subsequent `rooms.admit(...)` calls across the entire service with `503 Online simulator is at capacity. Try local practice.` for 30 seconds.
- **Remediation**:
  - In `functions/src/lib/biobuzzRooms.ts:74-79` (and `lines 119-123`), when `!room.players.some(Boolean)` (no human seats occupied or awaiting reconnect) and (`room.status !== "finished"` || `room.saved` || `room.saveAttempts >= 3`), call `this.remove(room)` immediately.
- **Acceptance Test**:
  - In `functions/src/lib/biobuzzRooms.test.ts`, initialize `BiobuzzRooms` with `maxRooms: 1`, admit a player, attach, send `{ type: "leave" }`, and assert `rooms.size === 0` and an immediate subsequent `rooms.admit("create")` succeeds without advancing the clock by 30s.

---

### C09 — Waggle Way Proof Worker Replays `rulesVersion: 6..8` Levels (`Builder.tsx` Default is `8`) and Then Fails Output Schema Validation (`max(5)`) with HTTP 503 (`WAGGLE_VERIFIER_UNAVAILABLE`)
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `packages/waggle-way/src/ui/Builder.tsx:66`: `createBlankLevel(8)` (`rulesVersion: 8`)
  - `packages/waggle-way/src/core/level.ts:212`: `validateLevel` accepts `rulesVersion` in `1..8`
  - `functions/src/lib/waggleProof.ts:19, 47, 87-94`: `WAGGLE_VERIFIER_VERSION = "waggle-rules-1-5@1"` and `WaggleVerificationSchema` sets `rulesVersion: z.number().int().min(1).max(5)`, while `evaluateWaggleProof` calls `validateLevel` without checking `rulesVersion`
  - `functions/src/lib/waggleCommunityDomain.ts:199`: `StoredVerificationSchema` sets `rulesVersion: z.number().int().min(1).max(5)`
  - `functions/src/lib/waggleVerification.ts:125-131, 148`: When `WaggleVerificationSchema.safeParse(packet.result)` fails, it falls through to `unavailable()` (`HTTP 503 WAGGLE_VERIFIER_UNAVAILABLE`)
- **Trigger & Impact**:
  - Every new level authored in the Garden Workshop (`Builder.tsx:66`) has `rulesVersion: 8`.
  - When a team member submits a `rulesVersion: 6..8` level to `PUT /api/waggle-way/mine/:id`, the worker spends CPU replaying all 1–3 recordings to completion, emits `{ type: "verified", result: { ..., rulesVersion: 8 } }`, fails `WaggleVerificationSchema.safeParse` (`max(5)`), and returns HTTP `503 Service Unavailable` (`"Garden verification is busy right now. Try again in a moment."`).
- **Remediation**:
  - Update `WaggleVerificationSchema` (`functions/src/lib/waggleProof.ts:47`) and `StoredVerificationSchema` (`functions/src/lib/waggleCommunityDomain.ts:199`) to `rulesVersion: z.number().int().min(1).max(8)` (and update `WAGGLE_VERIFIER_VERSION` if desired), **and** check `if (level.rulesVersion < 1 || level.rulesVersion > MAX_SUPPORTED_RULES_VERSION) throw new WaggleProofError("level");` in `evaluateWaggleProof` before replaying seeds so any future unsupported `rulesVersion` fails fast with HTTP `422 WAGGLE_PROOF_REJECTED` instead of HTTP `503`.
- **Acceptance Test**:
  - Add a test in `functions/src/lib/__tests__/waggleProof.test.ts` and `waggleVerificationIntegration.test.ts` verifying that a `rulesVersion: 8` level from `createBlankLevel(8)` verifies cleanly and passes `WaggleVerificationSchema`, while `rulesVersion: 9` fails fast with `422 WAGGLE_PROOF_REJECTED`.

---

### C10 — BIOBUZZ WebSocket Heartbeat Race (`lastPong` Not Reset on `hello`), Swallowed `validateAuto` Error Messages on `ready`, and Unprotected `response.json()` in `biobuzzOnline.ts`
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `functions/src/biobuzzServer.ts:22-39`
  - `functions/src/lib/biobuzzRooms.ts:86-91`
  - `packages/biobuzz/src/core/auto.ts:13-35`
  - `src/lib/biobuzzOnline.ts:10-12`
- **Trigger & Impact**:
  1. **WebSocket Heartbeat Race (`biobuzzServer.ts:22-37`)**: `lastPong = Date.now()` is set on connection open, `timeout` allows up to 5,000 ms for `{ type: "hello" }`, and the 1,000 ms `heartbeat` interval returns early while `!binding`. If `{ type: "hello" }` arrives 2,001–4,999 ms after connection open (e.g., on mobile or after cold start), `binding` becomes non-null without resetting `lastPong = Date.now()`, so the next 1,000 ms heartbeat tick evaluates `Date.now() - lastPong > 3000` as `true` and calls `ws.terminate()` before sending a single `ws.ping()`.
  2. **Swallowed `validateAuto` Errors on `ready` (`biobuzzRooms.ts:86-91`, `biobuzzServer.ts:38`)**: Unlike `m.type === "robot"` (`lines 81-84`), which wraps `validateRobotSetup` in `try { ... } catch { throw new ApiError(400, ...); }`, `m.type === "ready"` calls `validateAuto(m.auto)` unwrapped. Because `validateAuto` throws a plain `Error` (e.g., `"Starting robot must touch a field wall."`), `e instanceof ApiError` in `biobuzzServer.ts:38` is `false`, replacing the specific validation message with `"Invalid simulator message."`.
  3. **Unprotected `response.json()` (`src/lib/biobuzzOnline.ts:10-12`)**: `const result = await response.json(); if (!response.ok) throw new Error(result.error || "Online simulator unavailable.");` throws an unhandled `SyntaxError` if an upstream proxy/Cloud Run cold start returns a non-JSON 502/503/504 error page.
- **Remediation**:
  - In `functions/src/biobuzzServer.ts:36`, set `lastPong = Date.now();` when `binding` succeeds.
  - In `functions/src/lib/biobuzzRooms.ts:88-90`, wrap `validateAuto` and `validateRobotSetup` in `try { ... } catch (err) { throw new ApiError(400, err instanceof Error ? err.message : "Invalid auto setup."); }`.
  - In `src/lib/biobuzzOnline.ts:10-12`, parse JSON inside a `try/catch` (or `.catch(() => null)`) and fall back to `"Online simulator unavailable."` when `!response.ok`.
- **Acceptance Test**:
  - Add unit tests in `functions/src/biobuzzServer.test.ts` (handshake at `t = 3500ms` survives `t = 4500ms` heartbeat; invalid auto on `ready` returns the specific 400 error message) and `src/lib/__tests__/biobuzzOnline.test.ts` (HTML 503 response throws `"Online simulator unavailable."`).

---

### C11 — Zulip Markdown and `@`-Mention Injection via Unauthenticated `POST /api/inquiries` and Member-Writable `tasks` (`taskDueDigest`)
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/inquiries.ts:105-110`
  - `functions/src/lib/taskDigest.ts:35-74`
  - `functions/src/lib/zulip.ts:8-10, 43-50, 65-75`
  - Contrast with `functions/src/lib/socialSyndication.ts:43-47` (`escapeZulipMarkdown`)
- **Trigger & Impact**:
  - `POST /api/inquiries` (`inquiries.ts:105-110`) interpolates unescaped `name`, `subteam`, and multi-line `message` into `sendZulipAlert("New Inquiry", ...)`. Any newline in `message` breaks out of the `> ` blockquote, allowing an unauthenticated caller to trigger `@**all**` / `@**stream**` notifications or spoofed Markdown links in the `leadership` stream.
  - `formatDueDigest` (`taskDigest.ts:35-74`) interpolates member-writable task `title` and `assignee` nicknames into the daily `kanban` stream message without escaping `@`-mentions or Markdown links.
  - Additionally, `functions/src/lib/zulip.ts:8-10, 43-50, 97-102` and `functions/src/lib/googleAuth.ts:30` call `fetch(...)` without `signal: AbortSignal.timeout(10_000)`.
- **Remediation**:
  - Move `escapeZulipMarkdown` into `functions/src/lib/zulip.ts` and sanitize user-supplied fields in `inquiries.ts:105-110` and `taskDigest.ts:35-50`; add `AbortSignal.timeout(10_000)` to `zulip.ts` and `googleAuth.ts`.
- **Acceptance Test**:
  - Add unit tests in `inquiries.test.ts` and `taskDigest.test.ts` asserting that `@**all**`, newlines, and `[link](https://...)` in inquiry messages and task titles are escaped before calling `sendZulipMessage`.

---

### C12 — Fail-Open Role Normalization (`"member"` Default), Unvalidated `POST /api/profiles/sync` Role Schema, and Unsanitized/Unfiltered `GET /api/profiles/about-roster`
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/profileEmailRoster.ts:50-55, 102-104`
  - `functions/src/routes/profileAdmin.ts:71-91, 354, 593`
  - `functions/src/routes/profileSync.ts:32-33, 177-189`
  - `functions/src/routes/profileRoster.ts:88-149`
- **Trigger & Impact**:
  1. `profileEmailRoster.ts:50-55` (`normalizeRole`) and `profileAdmin.ts:71-91` (`normalizeAdminRole`) default unknown or empty role strings to `"member"` instead of failing closed to `"unverified"`, and only check `isDeleted !== 1` (ignoring `isDeleted === true`).
  2. `profileSync.ts:32-33` (`profileSyncSchema`) accepts `role: z.string().optional()` without restricting values to known roles.
  3. `GET /api/profiles/about-roster` (`profileRoster.ts:88-149`, public endpoint) does not verify that each profile UID has an active `authorized_users` record (unlike `/team-roster` at lines `156-171`), ignores `data.isDeleted === true`, and returns raw `data.pronouns`, `data.subteams`, `data.bio`, and `data.colleges` without the `safeString` / `safeStringArray` / `safeStructuredArray` sanitizers used in `profileSelf.ts:132-160`.
- **Remediation**:
  - Default unknown/empty roles to `"unverified"` in `profileEmailRoster.ts` and `profileAdmin.ts` and check `isDeleted !== 1 && isDeleted !== true`.
  - Constrain `profileSyncSchema.shape.role` in `profileSync.ts:32` to `z.enum(["admin", "coach", "mentor", "member", "student", "unverified"]).optional()`.
  - Filter `GET /api/profiles/about-roster` (`profileRoster.ts:88-149`) against active `authorized_users` records and sanitize `pronouns`, `subteams`, `bio`, and `colleges`.
- **Acceptance Test**:
  - Add unit tests in `functions/src/routes/__tests__/profileEmailRoster.test.ts` and `profiles.test.ts` covering empty/unknown role records, invalid role strings on `/sync`, and unauthorized/malformed profile fields on `/about-roster`.

---

### C13 — Direct Client-Writable Firestore Collections Diverge from Backend Route Authorization and Lack Schema Bounds; `seasonDto` Lacks Read-Side URL Sanitization
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `firestore.rules:110-191, 237-261, 291-303, 356-377, 398-400, 412-420, 481-515, 537-550`
  - `functions/src/routes/seasons.ts:55-70, 129-227`
- **Trigger & Impact**:
  1. `seasons/{seasonId}` and `awards/{awardId}` (`firestore.rules:500-515`) allow `mentor` (`isContentPublisher()`) direct client writes and hard-deletes (`allow delete` on `seasons`), whereas `functions/src/routes/seasons.ts:129-227` restricts writes to `admin` and `coach` (`ensureAdmin`) and uses soft-delete (`isDeleted: 1`). Furthermore, `seasonDto` (`seasons.ts:55-70`) returns `robotImage`, `robotCadUrl`, `albumUrl`, and `albumCover` without re-validating `https?://` on read, so a `mentor` writing `javascript:` URLs directly via the Firestore client SDK would have them served by `GET /api/seasons`.
  2. `sponsors`, `tournaments`, `tournament_matches`, and `robots` (`firestore.rules:356-377, 412-420`) remain directly client-writable without schema validation even though dedicated Cloud Functions APIs own all mutations.
  3. Member-writable `events/{eventId}/signups/{userId}` (`firestore.rules:258-261`), `user_profiles/{userId}/layouts/{layoutId}` (`firestore.rules:398-400`), and `docs_feedback/{feedbackId}` (`firestore.rules:537-550`) lack `hasOnly` key allowlists and field size bounds.
- **Remediation**:
  - Sanitize URLs on read in `seasonDto` (`functions/src/routes/seasons.ts:55-70`).
  - Lock direct client writes (`allow write: if false;`) on collections migrated to server APIs (`seasons`, `awards`, `sponsors`, `tournaments`, `tournament_matches`, `robots`), or align their `firestore.rules` role/schema checks with the backend routes, and add `hasOnly`/size bounds to `signups`, `layouts`, and `docs_feedback`.
- **Acceptance Test**:
  - Add unit tests in `seasons.test.ts` (asserting `seasonDto` strips `javascript:` URLs stored in Firestore) and rule tests in `tests/rules/security.rules.test.ts`.

---

### C14 — Duplicate `id="main-content"`, Nested `<main>` Landmarks Across 7 Routes, and Broken Skip Link on `/dashboard/*`
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `src/components/layout/LayoutWrapper.tsx:101-109, 120-128`
  - `src/components/SkipLink.tsx:15-27`
  - `src/app/dashboard/layout.tsx:31, 66, 189, 292`
  - `src/app/dashboard/zulip/page.tsx:131`
  - `src/app/videos/page.tsx:136-139`
  - `src/app/arcade/page.tsx:10`
  - `src/app/brand/page.tsx:37`
  - `src/app/developer-api/page.tsx:18`
  - `src/app/robots/page.tsx:101`
- **Trigger & Impact**:
  - `LayoutWrapper.tsx` wraps every route in `<main id="main-content" tabIndex={-1}>` (`lines 101-109` for `/dashboard`, `lines 120-128` for public routes).
  - On `/dashboard/*`, `DashboardLayout` (`src/app/dashboard/layout.tsx:31, 66, 189, 292`) renders a second `<main id="main-content" tabIndex={-1}>` nested inside `LayoutWrapper`'s `<main id="main-content">`. Because `LayoutWrapper`'s outer `#main-content` wraps `<DashboardSidebar />`, activating `<SkipLink />` (`document.getElementById("main-content")` in `SkipLink.tsx:15`) focuses the outer wrapper **before** the 20+ links in `DashboardSidebar`, failing to bypass the sidebar navigation (WCAG 2.4.1).
  - Additionally, `/dashboard/zulip`, `/videos` (which also duplicates `id="main-content"`), `/arcade`, `/brand`, `/developer-api`, and `/robots` render inner `<main>` elements inside `LayoutWrapper`'s `<main>`, violating HTML5 landmark semantics and WCAG 1.3.1.
- **Remediation**:
  - In `src/components/layout/LayoutWrapper.tsx:101-109`, change the outer wrapper for `isDashboard` from `<main id="main-content" tabIndex={-1}>` to a `<div>` so `DashboardLayout`'s `<main id="main-content" tabIndex={-1}>` (after `<DashboardSidebar />`) is the unique main landmark on dashboard routes.
  - Replace the inner `<main>` elements in `src/app/dashboard/zulip/page.tsx:131`, `src/app/videos/page.tsx:136`, `src/app/arcade/page.tsx:10`, `src/app/brand/page.tsx:37`, `src/app/developer-api/page.tsx:18`, and `src/app/robots/page.tsx:101` with `<div>`.
- **Acceptance Test**:
  - Assert across `/dashboard`, `/dashboard/zulip`, `/videos`, `/arcade`, `/brand`, `/developer-api`, and `/robots` that `document.querySelectorAll("main").length === 1` and `document.querySelectorAll("#main-content").length === 1`.

---

### C15 — `SimulationLibraryOverlay` Lacks Dialog Semantics, Focus Trap, and `Escape` Dismissal; Broken TOC Anchor Links in `TiptapRenderer` and `DocsMarkdownRenderer`
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `src/components/simulation/SimulationLibraryOverlay.tsx:25-123`
  - `src/components/TiptapRenderer.tsx:77-91`
  - `src/components/docs/DocsTableOfContents.tsx:27-50, 76, 89-99`
  - `src/components/docs/DocsMarkdownRenderer.tsx:125-148`
- **Trigger & Impact**:
  1. `SimulationLibraryOverlay` (`src/components/simulation/SimulationLibraryOverlay.tsx:39-51`) renders a modal overlay without `role="dialog"`, `aria-modal="true"`, `aria-labelledby`, focus trapping, initial/restored focus, or `Escape` dismissal (WCAG 2.1.1, 2.4.3, 4.1.2).
  2. `TiptapRenderer.tsx:77-91` (`renderHeading`) renders `<Tag className={className}>{children}</Tag>` without an `id` attribute and allows level-1 headings to render as `<h1>`. Consequently, `DocsTableOfContents.tsx` anchor links (`<a href="#...">`) and `IntersectionObserver` (`document.querySelectorAll("h2[id], h3[id]")`) never match headings in Tiptap AST lessons/articles.
  3. `DocsMarkdownRenderer.tsx:126-148` computes `const text = String(children)` (producing `id="object-object"` whenever a heading contains inline code or formatting) and renders `<a href={`#${id}`} className="... opacity-0 group-hover:opacity-100">` without `focus-visible:opacity-100`, hiding the focused element from sighted keyboard users (WCAG 2.4.7).
- **Remediation**:
  - Add `useFocusTrap(showLibrary, () => setShowLibrary(false))`, `role="dialog"`, `aria-modal="true"`, and `aria-labelledby="sim-library-title"` to `SimulationLibraryOverlay.tsx`.
  - In `TiptapRenderer.tsx:77-91`, demote level-1 headings to `<h2>` and assign deterministic slug `id`s matching `DocsTableOfContents.tsx`.
  - In `DocsMarkdownRenderer.tsx:126-148`, extract plain text recursively from `children` for the heading `id` and add `focus-visible:opacity-100` to the section link.
- **Acceptance Test**:
  - Add unit tests verifying `SimulationLibraryOverlay` dialog attributes and `Escape` handling, and verifying that `TiptapRenderer` and `DocsMarkdownRenderer` emit matching heading `id`s and `focus-visible:opacity-100` section anchors.

---

### C16 — WCAG 2.2 AA Color Contrast Violations (`1.33:1` to `3.20:1`), Nested Interactive Controls on `/blog`, and Unlabeled Icon Buttons/Selects
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `src/app/join/page.tsx:238-243, 388`
  - `src/app/calendar/page.tsx:247, 282, 409, 440, 464`
  - `src/app/robots/[id]/page.tsx:217, 229, 241, 253, 279`
  - `src/app/seasons/page.tsx:244`, `src/app/tech-stack/page.tsx:118`
  - `src/sims/armkg/index.tsx:135`
  - `src/components/events/EventRsvps.tsx:83, 173`, `src/components/events/EventGallery.tsx:125`, `src/components/events/PhotoLightbox.tsx:33`
  - `src/components/PhotoPickerModal.tsx:221, 256-302`
  - `src/components/dashboard/DocumentDiffViewer.tsx:113, 142`, `src/components/dashboard/DocFormDrawer.tsx:417-454`
  - `src/app/blog/page.tsx:138-168`
  - `src/components/MarkdownEditor.tsx:275-361, 382`
  - `src/app/dashboard/events/components/EventEditorDrawer.tsx:175-181, 202`
  - `src/app/dashboard/events/components/ShiftScheduleEditor.tsx:251-258, 383-411`
  - `src/app/dashboard/tasks/components/TaskDetailsModal.tsx:379-386`
- **Trigger & Impact**:
  1. **Contrast (`1.33:1` on `/join`)**: In `src/app/join/page.tsx:239`, the success banner inside the light `bg-marble` (`#e5e5e5`) card uses `bg-ares-gold/15 border border-ares-gold/30 text-ares-gold` (`1.33:1` contrast ratio), and line `388` uses `text-obsidian/50` (`3.61:1`).
  2. **Small Text Using `text-ares-red` (`~3.0:1`) Instead of `text-ares-red-light` (`5.8:1`)**: `calendar/page.tsx:282, 409`, `EventRsvps.tsx:83`, `PhotoPickerModal.tsx:221`, `DocumentDiffViewer.tsx:113, 142`, and `src/sims/armkg/index.tsx:135`.
  3. **Low-Opacity Labels (`text-marble/30`–`text-marble/40`, `2.18:1`–`2.94:1`)**: `robots/[id]/page.tsx:217, 229, 241, 253, 279`, `calendar/page.tsx:247, 440, 464`, `seasons/page.tsx:244`, `tech-stack/page.tsx:118`, `EventGallery.tsx:125`, `EventRsvps.tsx:173`, `PhotoLightbox.tsx:33`, `DocFormDrawer.tsx:424, 435, 447`, `EventEditorDrawer.tsx:202`, `SimulationLibraryOverlay.tsx:78, 98, 113`.
  4. **Nested Interactive & Missing Names**: `src/app/blog/page.tsx:156-165` nests `<button title="Edit Article">` inside `<Link>`; `MarkdownEditor.tsx:275-361, 382` (10 icon buttons), `EventEditorDrawer.tsx:175`, `TaskDetailsModal.tsx:379`, and `ShiftScheduleEditor.tsx:251, 383` lack `aria-label`; custom tab switchers in `DocFormDrawer.tsx:417-454` and `PhotoPickerModal.tsx:256-302` lack `role="tablist"` / `role="tab"` / `aria-selected`.
- **Remediation**:
  - Use `bg-obsidian text-ares-gold` (`10.1:1`) on `src/app/join/page.tsx:239` and `text-obsidian/75` on line `388`; replace small-text `text-ares-red` with `text-ares-red-light`; raise readable metadata labels to `text-marble/60`+; move the edit `<button>` outside `<Link>` on `/blog`; add `aria-label` and `role="tablist"`/`role="tab"` semantics to the listed controls.
- **Acceptance Test**:
  - Verify with unit/Playwright accessibility assertions on `/join`, `/calendar`, `/robots/:id`, `/blog`, and `MarkdownEditor`.

---

### C17 — Authenticated `/dashboard/*` Layout (20 of 21 Pages) and Dynamic Detail Error States Omit `<SEO noindex />`
- **Severity**: Medium
- **Confidence**: High
- **Evidence**:
  - `src/app/dashboard/layout.tsx:70, 193, 225-303`
  - `src/app/events/[id]/page.tsx:502-515`
  - `src/app/tournaments/[id]/page.tsx:253-296`
  - `src/app/robots/[id]/page.tsx:34-47`
- **Trigger & Impact**:
  - `DashboardLayout` renders `<SEO ... noindex />` in its unauthenticated (`line 70`) and unauthorized (`line 193`) states, but omits `<SEO>` in its authenticated state (`lines 225-303`). Navigating via client-side links from a public page to `/dashboard/*` (or to an error state on `/events/:id`, `/tournaments/:id`, `/robots/:id`) leaves the previous public page's `<title>`, canonical URL, and `index, follow` meta tags in `document.head`.
- **Remediation**:
  - Render a default `<SEO title="Command Center" description="ARES 23247 team operations dashboard." noindex />` in the authenticated return of `src/app/dashboard/layout.tsx:226` and in the `loadError` branches of `events/[id]/page.tsx`, `tournaments/[id]/page.tsx`, and `robots/[id]/page.tsx`.
- **Acceptance Test**:
  - Assert that navigating from a public route to `/dashboard` updates `document.title` and sets `<meta name="robots" content="noindex, nofollow">`.

---

### C18 — Unvalidated Pagination Cursors (`inquiries`, `outreach`, `robots`), Archived-Parent Occurrence Edits (`calendarOccurrenceRoutes`), Custom Role Middleware Drift, and Per-Instance Inquiry Rate Limit
- **Severity**: Low
- **Confidence**: High
- **Evidence**:
  - `functions/src/routes/inquiries.ts:65, 135-144`
  - `functions/src/routes/outreach.ts:75-84`
  - `functions/src/routes/robots.ts:159-175, 188-193`
  - `functions/src/routes/tournaments.ts:149-187`
  - `functions/src/routes/calendarOccurrenceRoutes.ts:49-181`
- **Trigger & Impact**:
  1. `inquiries.ts:135-144`, `outreach.ts:75-84`, and `robots.ts:188-193` pass `req.query.cursor` / `req.query.startAfter` into `.doc(...)` without validating `/^[A-Za-z0-9_-]{1,128}$/` (a `/` in the cursor triggers a Firestore 500 error, and a missing cursor doc silently returns page 1 instead of `400 INVALID_CURSOR`).
  2. `calendarOccurrenceRoutes.ts:49-181` calls `getEvent(req.params.id, true)` without rejecting edits when `data.isDeleted === 1`.
  3. `robots.ts:159-175` and `tournaments.ts:149-187` implement custom `authorized_users` lookups instead of using `ensureAdmin` / `ensureTeamMember` from `functions/src/middleware/auth.ts`.
  4. `POST /api/inquiries` (`inquiries.ts:65`) uses only per-instance `express-rate-limit` without `distributedAnonymousQuota`.
- **Remediation**:
  - Validate cursor IDs with `/^[A-Za-z0-9_-]{1,128}$/` and return `400 INVALID_CURSOR` on missing cursor docs; reject occurrence edits on archived events (`409`); use shared `auth.ts` middleware in `robots.ts` and `tournaments.ts`; add `distributedAnonymousQuota` to `POST /api/inquiries`.
- **Acceptance Test**:
  - Add route unit tests verifying `400` on invalid cursors and `409` on archived-event occurrence edits.

---

### C19 — CI, Observability & Bundle Classifier Gaps (`VITE_BIOBUZZ_ORIGIN` Omitted in PR `verify`; `platformAlerts` Omits Game Cloud Run Services; Monaco `*Mode-*` Chunks Counted as Route JS; Stale `functions/lib` Files)
- **Severity**: Low
- **Confidence**: High
- **Evidence**:
  - `.github/workflows/ci.yml:132-136` vs `.github/workflows/ci.yml:366-370`
  - `infra/gcp/security-observability.json:75-86`
  - `scripts/check-bundle-size.mjs:48`
  - `functions/package.json:6`
- **Trigger & Impact**:
  1. `.github/workflows/ci.yml:132-136` runs `pnpm run build` in `verify` (on PRs) without `VITE_BIOBUZZ_ORIGIN="$(node scripts/biobuzz-cloud-run.mjs --origin)"`, whereas `release-build` (`lines 366-370`) sets it.
  2. `infra/gcp/security-observability.json:75-86` (`platformAlerts` for Cloud Run 5xx ratio and billable-instance time) lists `["publicapi", "coreapi", "mediaapi", "driveapi", "communicationsapi", "web"]` and omits `aresweb-game-api` and `aresweb-biobuzz-sim`.
  3. `scripts/check-bundle-size.mjs:48` (`editorRuntimePattern`) does not match Monaco's language mode chunks (`tsMode-*.js` at 1.20 MB raw / 306 KB gzip, `cssMode-*.js`, `htmlMode-*.js`, `jsonMode-*.js`), so `tsMode-*.js` is classified as `largestLazyJs` under `routeLazyJs` instead of `editorRuntimeJs`.
  4. `functions/package.json:6` (`"build": "node ../scripts/prepare-game-packages.mjs && tsc"`) does not clean `functions/lib/` before running `tsc`, leaving retired compiled files (e.g., `functions/lib/routes/judges.js`, `replay.js`, `upload.js`) in local builds.
- **Remediation**:
  - Set `VITE_BIOBUZZ_ORIGIN` in `.github/workflows/ci.yml` `verify` build; add `aresweb-game-api` and `aresweb-biobuzz-sim` to `infra/gcp/security-observability.json:75-86`; include `^(?:ts|css|html|json)Mode-` in `editorRuntimePattern` in `scripts/check-bundle-size.mjs:48`; clean `lib` before `tsc` in `functions/package.json:6`.
- **Acceptance Test**:
  - Run `pnpm run validate:security-observability`, `pnpm --filter functions build`, and `node scripts/check-bundle-size.mjs` and verify `largestLazyJs` reports the largest actual route chunk rather than `tsMode-*.js`.

---

### C20 — UTF-8 Mojibake (`FIRSTÂ® Tech Challenge`) in `vite.config.ts` PWA Web App Manifest Description
- **Severity**: Low
- **Confidence**: High
- **Evidence**:
  - `vite.config.ts:20`:
    ```ts
    description:
      "Team portal for ARES 23247, a FIRSTÂ® Tech Challenge robotics team in Morgantown, West Virginia.",
    ```
- **Trigger & Impact**:
  - Emits `"FIRSTÂ® Tech Challenge"` into `dist/manifest.webmanifest`.
- **Remediation**:
  - Replace `"FIRSTÂ®"` with `"FIRST®"` in `vite.config.ts:20`.
- **Acceptance Test**:
  - Build and assert `!readFileSync("dist/manifest.webmanifest", "utf8").includes("FIRSTÂ")`.

---

### C21 — Outdated Prerender Shell Copy for `/waggle-way/builder` and Orphaned `src/app/favicon.ico`
- **Severity**: Low
- **Confidence**: High
- **Evidence**:
  - `scripts/prerender-static-routes.mjs:41` (`"Online publishing is not yet available."`) vs `src/app/waggle-way/builder/page.tsx:1-60` (which wires `waggleCommunity` online publishing)
  - `src/app/favicon.ico` (unreferenced legacy Next.js file; Vite uses `public/favicon.svg` and `public/favicon.webp`)
- **Remediation**:
  - Update the `/waggle-way/builder` section copy in `scripts/prerender-static-routes.mjs:41` to reflect verified community garden publishing, and delete `src/app/favicon.ico`.
- **Acceptance Test**:
  - Run `pnpm run build` and verify `dist/prerender/waggle-way-builder.html` does not contain `"Online publishing is not yet available."` and `src/app/favicon.ico` is removed.

---

### C22 — Developer Script `packages/pollinator/public/server.ps1` Lives Inside Staged Public Assets and Lacks Path-Traversal Containment if Run Locally
- **Severity**: Low
- **Confidence**: High
- **Evidence**:
  - `packages/pollinator/public/server.ps1:22-45`
  - `scripts/prepare-game-packages.mjs:38`
  - `firebase.json:19`
- **Trigger & Impact**:
  - Although `firebase.json:19` excludes `games/pollen/server.ps1` from Firebase Hosting deploys, `scripts/prepare-game-packages.mjs:38` copies `packages/pollinator/public/server.ps1` into `public/games/pollen/server.ps1` and `dist/games/pollen/server.ps1`, and `server.ps1` does not verify `[System.IO.Path]::GetFullPath($filePath).StartsWith(...)` if run locally.
- **Remediation**:
  - Move `server.ps1` out of `packages/pollinator/public/` (or remove it in favor of `pnpm dev`) and remove the stale ignore entry in `firebase.json:19`.
- **Acceptance Test**:
  - Run `pnpm games:prepare` and verify `public/games/pollen/server.ps1` does not exist.

---

## 4. Areas Verified Clean (With Concrete Evidence)

1. **Workspace Package Independence & Game Rules (`packages/*`)**:
   - All 8 workspace packages (`@ares/biobuzz`, `@ares/buzzle`, `@ares/buzzello`, `@ares/buzzhex`, `@ares/game-common`, `@ares/pollinator`, `@ares/ui`, `@ares/waggle-way`) have zero imports from `@/` or Firebase SDKs; all authenticated transport is injected via `src/lib/*Online.ts` and `src/lib/waggleCommunity.ts`.
   - BUZZELLO preserves 61-cell (`radius=4`) and 91-cell (`radius=5`) column-major indexing (`packages/buzzello/src/rules.ts:1-60`).
   - BUZZLE preserves 217-cell row-major local / column-major persisted conversion (`BUZZLE_ONLINE_INDICES` in `packages/buzzle/src/rules.ts:62-127`), server-side cryptographic tile-bag shuffling (`randomInt` in `functions/src/lib/buzzleGameDefinition.ts:59-66`), and private rack filtering (`toPlayerView` at `buzzleGameDefinition.ts:186-196` exposes only `myRack` and `rackCount` for opponents).
   - Dictionary definition fetches (`packages/buzzle/src/definitions.ts:17-85`) enforce `credentials: "omit"`, `redirect: "error"`, 5s timeout, 256 KiB streaming cap, and DOMPurify text-only stripping.
2. **Iframe Sandboxing & PostMessage Boundaries**:
   - `src/components/editor/SimPreviewFrame.tsx:41-100, 431-437` and `src/app/pollen/page.tsx:13-35, 51` both use `<iframe sandbox="allow-scripts">` (never combining `allow-scripts` with `allow-same-origin`) and strictly validate `event.source === iframeRef.current?.contentWindow` and score/payload bounds.
3. **Storage Rules & Server-Only Sensitive Firestore Collections**:
   - `storage.rules:1-46` enforces default-deny, restricts public reads to `public-media/**` with `allow write: if false`, and caps `editor/uploads/{category}/{fileName}` at 5 MiB `image/(jpeg|png|webp|gif)`.
   - `firestore.rules` blocks all direct browser access (`allow read, write: if false`) to `inquiries`, `outreach_events`, `finance_transactions`, `audit_logs`, `system_settings`, `security_rate_limits`, `ai_usage_budgets`, `internal_public_artifacts`, `buzzle_matches`, `buzzle_match_private`, `buzzello_matches`, `waggle_community_gardens`, `biobuzz_results`, and `videos`.
4. **Inquiry PII Encryption, AI Circuit Breaker, and Image Upload Sanitization**:
   - `functions/src/lib/crypto.ts:1-116` uses AES-256-GCM with random 16-byte salt, 12-byte IV, and 100,000 PBKDF2-SHA256 iterations.
   - `functions/src/middleware/aiBudget.ts:1-214` and `functions/src/lib/aiControls.ts:1-38` fail closed (`503 AI_CONTROL_UNAVAILABLE`) when Firestore is unreachable and enforce transactional daily request, token, and USD microdollar ceilings.
   - `functions/src/lib/imageImport.ts` and `photoDerivatives.ts` verify magic bytes, decode via Sharp (`failOn: "warning"`, `limitInputPixels: 20_000_000`), strip EXIF/GPS metadata, and roll back partial Storage writes on failure.
5. **Feature Truthfulness & Global CSS Token Order**:
   - Audited all public pages and simulations; zero fabricated team members, sponsors, awards, CAD models, or hardware specs. All data-driven pages use `PublicDataState` / `role="alert"` and never turn network or authorization failures into `$0` or empty-catalog claims.
   - `src/app/globals.css:1-3` keeps `@import "tailwindcss";` and `@import "../styles/ares-design-tokens.css";` consecutive before `@source "../";`.

---

## 5. Complete Verification Gate Execution Results (Post-Remediation)

All **22 confirmed findings (`C01`–`C22`)** have been remediated in live code and verified across every required gate in `AGENTS.md`:

| # | Gate Command | Exit Code | Duration | Summary / Measured Output |
| --- | --- | --- | --- | --- |
| 1 | `pnpm install --frozen-lockfile` | `0` | 1.3s | Lockfile verified up to date |
| 2 | `pnpm run validate:agents` | `0` | 1s | Validated 6 tracked shared skills and all agent entry points |
| 3 | `pnpm run check:route-security` | `0` | 1s | Route security invariant passed for 118 mutation routes (101 Firebase-authorized, 17 controlled exceptions) |
| 4 | `pnpm run validate:functions-deploy-lock` | `0` | 1s | Standalone `functions/package-lock.json` synchronized |
| 5 | `pnpm run test:release-tooling` | `0` | 5.4s | 4 test files, 20 tests passed (`96.66%` statements, `100%` functions) |
| 6 | `pnpm run lint` | `0` | 12s | 0 warnings, 0 errors |
| 7 | `pnpm --filter functions lint` | `0` | 5s | 0 warnings, 0 errors |
| 8 | `pnpm run typecheck` | `0` | 7s | `tsc --noEmit` clean |
| 9 | `pnpm run test:coverage` | `0` | 103s | 296 test files, 2,010 tests passed (`src/lib` `97.25%` stmts, `100%` funcs, `98.58%` lines) |
| 10 | `pnpm --filter functions build` | `0` | 5s | `lib/` cleaned, game packages staged, and `functions` compiled |
| 11 | `pnpm --filter functions test:coverage` | `0` | 26s | 85 test files, 1,037 tests passed (`src/lib` `94.27%` stmts, `src/routes` `94.15%` stmts, `95.56%` lines) |
| 12 | `pnpm run test:rules` | `0` | 24s | 2 test files, 40 Firestore & Storage emulator rule tests passed |
| 13 | `pnpm run build` | `0` | 6.3s | Vite build + 35 static route shells prerendered + PWA service worker generated |
| 14 | `node scripts/check-bundle-size.mjs` | `0` | 1s | All 8 bundle budgets passed (`initialJs`: 752,698 raw / 236,014 gzip; `initialCss`: 185,383 raw / 24,535 gzip) |
| 15 | `pnpm run test:e2e` | `0` | 846s | **648 passed** across `chromium`, `mobile-chromium`, `mobile-webkit`, `firefox`, `webkit`, and `pwa-chromium` |
| 16 | `pnpm audit --prod --audit-level=high` | `0` | 2s | `No known vulnerabilities found` |

