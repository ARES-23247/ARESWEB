# Comprehensive ARESWEB Repository Audit & Remediation Report

- **Date:** 2026-10-14 / 2026-10-15
- **Audited Commit:** `1587790086982616288d8b04f0699ca0f9eff5aa` (`master`)
- **Worktree State at Start:** Clean (`master`)
- **Runtime Environment:** Node.js `v24.18.0`, pnpm `11.21.0`, Windows 11
- **Scope:** Full-stack audit of frontend routes and React 19 UI (`src/`), Cloud Functions and Express API routes (`functions/src/`), BIOBUZZ and game servers (`functions/src/biobuzzServer.ts`, `functions/src/gameServer.ts`, `packages/*`), Firestore and Storage security rules (`firestore.rules`, `storage.rules`), and SEO/syndication metadata.

---

## 1. Executive Summary

We conducted a multi-domain security, privacy, correctness, data-contract, and UX audit across the ARESWEB repository. No fabricated team data, mock sponsors, or synthetic student records were found in production surfaces. All 118 Express mutation routes passed the automated route-security invariant (`scripts/check-route-security.mjs`).

Eight confirmed defects and defense-in-depth gaps (`F01–F08`) were identified and remediated across authentication/authorization, Firestore security rules, inquiry dashboard visibility, team role (`coach`) normalization, BIOBUZZ room capacity protection, pagination/state preservation, and public API documentation. In addition, five high-impact portal and public-site feature improvements were implemented and verified.

---

## 2. Confirmed Findings & Remediations (`F01–F08`)

### F01 — Pre-Authorized User Linking Orphans Profile Documents and Fails Closed on Robot/Tournament Routes
- **Severity:** High
- **Confidence:** Confirmed
- **Evidence:**
  - `functions/src/lib/linkAuthorizedUser.ts:28-56` migrated `authorized_users/{legacyId}` to `authorized_users/{uid}` in a Firestore batch without migrating the paired `user_profiles/{legacyId}` document created during `POST /api/inquiries/:id/approve-account` (`functions/src/routes/inquiries.ts:696-711`).
  - `functions/src/routes/robots.ts:272-292` (`ensureRobotEditor`) and `functions/src/routes/tournaments.ts:110-126` (`ensureAdminOrCoach`) read `authorized_users/{uid}` directly without invoking `linkAuthorizedUserByEmail` when a newly invited user's first authenticated request hit those endpoints before `/api/profiles/session`.
  - `functions/src/routes/inquiries.ts:624-662` queried `.where("email", "==", decryptedEmail).limit(1)` when checking existing `authorized_users` records, allowing an older archived record to mask an active account and omitting `isDeleted: 0` when reactivating an archived record.
- **Impact:** Pre-authorized applicants lost their pre-populated profile metadata (`memberType`, `grade`, `subteams`, `bio`) upon first sign-in, and invited coaches/mentors could receive `403 Forbidden` on robot or tournament endpoints before visiting the dashboard home.
- **Remediation:**
  - Updated `linkAuthorizedUserByEmail` (`functions/src/lib/linkAuthorizedUser.ts`) to atomically migrate `user_profiles/{orphanId}` $\rightarrow$ `user_profiles/{uid}` alongside `authorized_users/{orphanId}` $\rightarrow$ `authorized_users/{uid}`.
  - Wired `linkAuthorizedUserByEmail` fallback into `ensureRobotEditor` (`functions/src/routes/robots.ts`) and `ensureAdminOrCoach` (`functions/src/routes/tournaments.ts`).
  - Updated `POST /api/inquiries/:id/approve-account` (`functions/src/routes/inquiries.ts`) to inspect up to 5 email-matched `authorized_users` documents and explicitly set `isDeleted: 0` on reactivation.
- **Acceptance Test:** `functions/src/routes/__tests__/inquiries.test.ts` and `functions/src/routes/__tests__/profiles.test.ts`.

---

### F02 — Session Sync Mutates Archived User Roles in Firestore and Drops Structured Alumni College Objects
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `functions/src/routes/profileSync.ts:95-115` overwrote `authorized_users/{uid}.role` in Firestore with `"unverified"` whenever an archived user (`isDeleted: true`) hit `/api/profiles/session`, destroying the stored role needed by `PATCH /api/profiles/admin/users/:id/restore`.
  - `functions/src/routes/profileRoster.ts:53` filtered `colleges` with `safeStringArray(data.colleges, 12, 120)`, dropping structured `{ name, domain, years, degree }` objects written by `PUT /api/profiles/me` (`functions/src/routes/profileSelf.ts:55-60`) and expected by `/about` (`src/app/about/page.tsx:53-70`).
- **Impact:** Restoring a revoked admin/mentor account could restore them as `"unverified"` if they attempted to sign in while revoked; alumni college details were omitted on the public `/about` page.
- **Remediation:**
  - Updated `functions/src/routes/profileSync.ts` to return `role: "unverified"` in the session response for archived users without mutating the stored `role` in `authorized_users/{uid}`.
  - Added `safeRosterColleges` in `functions/src/routes/profileRoster.ts` to preserve both string entries and structured `{ name, domain, years, degree }` college objects.
- **Acceptance Test:** `functions/src/routes/__tests__/profiles.test.ts`.

---

### F03 — Sponsor & Demo Inquiry Details Omitted in Dashboard Inquiries Hub & Zulip Notifications
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `src/app/dashboard/inquiries/page.tsx:30-37` and `359-384` only rendered `phone`, `school`, `grade`, `occupation`, `interests`, and `additional`, omitting `metadata.level` (Sponsorship Tier), `metadata.organization`, and `metadata.message` submitted by `/sponsors` and `/outreach`.
  - `src/app/dashboard/inquiries/page.tsx:297-302` lacked `<option value="demo">Demos</option>` in the type filter dropdown.
  - `functions/src/routes/inquiries.ts:505` linked Zulip alerts to `/admin/inquiries` (a 404 route) instead of `/dashboard/inquiries`.
- **Impact:** Admins reviewing sponsor or STEM demo inquiries in `/dashboard/inquiries` could not see the sponsor's message, selected sponsorship tier, or organization name.
- **Remediation:**
  - Rendered `metadata.level`, `metadata.organization`, and `metadata.message` in `src/app/dashboard/inquiries/page.tsx` and added `Demos` (`value="demo"`) to the type filter.
  - Updated the Zulip notification in `functions/src/routes/inquiries.ts` to include `metadata.level` and link to `https://ares-ftc.org/dashboard/inquiries`.
- **Acceptance Test:** `functions/src/routes/__tests__/inquiries.test.ts` and `src/test/`.

---

### F04 — Team Role (`memberType`) Rejects `"coach"` Despite `/about` Expecting a Dedicated Coaches Section
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `src/app/about/page.tsx:396-411` filters roster members by `m.memberType === "coach"` to populate the `"Coaches"` tab on `/about`.
  - However, `functions/src/routes/profileSelf.ts:44`, `functions/src/routes/profileRoster.ts:127-137`, `functions/src/routes/profileAdmin.ts:53-62`, `src/app/dashboard/users/components/UserRosterTable.tsx:177-183`, `src/app/dashboard/users/components/UserInviteForm.tsx:156-162`, and `src/app/dashboard/profile/components/SubteamsTab.tsx:90-95` excluded `"coach"` from `memberType`, coercing coaches to `"mentor"` or `"student"`.
- **Impact:** The `"Coaches"` section on `/about` could never be populated through normal profile or user-management workflows.
- **Remediation:**
  - Normalized legacy `role: "coach"` to `role: "admin"` for portal permissions while supporting `"coach"` as a first-class `memberType` across `profileSync.ts`, `profileSelf.ts`, `profileRoster.ts`, `profileAdmin.ts`, `UserRosterTable.tsx`, `UserInviteForm.tsx`, and `SubteamsTab.tsx`.
- **Acceptance Test:** `functions/src/routes/__tests__/profiles.test.ts`.

---

### F05 — Defense-in-Depth Gaps in `firestore.rules` for Server-Mediated Collections and Member Draft Updates
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `firestore.rules:296-299` allowed direct client reads on `inquiries/{inquiryId}` for `admin`/`coach` even though inquiries store AES-256-GCM ciphertext that is decrypted exclusively by `/api/inquiries`.
  - `firestore.rules:301-320` allowed direct client writes on `tournaments`, `tournament_matches`, and `sponsors` for `admin`/`coach` despite all application mutations flowing through audited `/api/tournaments` and `/api/sponsors` endpoints.
  - `firestore.rules:115-133` (`canUpdateContent`) allowed a `member` updating their own unapproved draft in `posts/{postSlug}` to mutate `authorId`, `isDeleted`, or approval metadata fields unless constrained by `isSafeMemberDraftWrite()`.
- **Impact:** Bypassing the Express API via direct Firestore SDK calls could skip server-side Zod validation, audit logging, and artifact cache invalidation, or allow a member to alter draft ownership metadata.
- **Remediation:**
  - Updated `src/context/DashboardNotificationsContext.tsx` to poll `/api/inquiries/pending-exists` instead of attaching a direct Firestore `onSnapshot` listener to `inquiries`.
  - Locked `inquiries/{inquiryId}` to `allow read, write: if false;` and locked client writes on `tournaments`, `tournament_matches`, and `sponsors` to `allow write: if false;` in `firestore.rules`.
  - Enforced `isSafeMemberDraftWrite()` in `canUpdateContent()` (`firestore.rules`) so member draft updates preserve `authorId == request.auth.uid`, `isApproved == false`, unchanged `isDeleted`, and no `approvedBy`/`approvedAt` fields.
- **Acceptance Test:** `tests/rules/security.rules.test.ts` (`40/40` passing via `pnpm run test:rules`) and `src/test/DashboardNotificationsContext.test.tsx`.

---

### F06 — BIOBUZZ Single-Room Capacity Exhaustion via Unattached HTTP Reservations & Preview WebSocket Origin Rejection
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `functions/src/lib/biobuzzRooms.ts:11-12` and `112-135` granted newly admitted HTTP room reservations (`POST /api/biobuzz/create|queue`) the full `RECONNECT_LEASE_MS` (`30,000 ms`) before a WebSocket ever connected, and did not evict stale `local-offer` rooms when `maxRooms` (`1` in production) was reached.
  - `functions/src/biobuzzServer.ts:116` only accepted `allowedOrigin` (`https://aresfirst.org`) on WebSocket `/play` upgrades, whereas HTTP routes in `functions/src/apps/biobuzz.ts:27` also allowed Firebase Hosting preview origins (`/^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/`).
- **Impact:** A single unattached HTTP admission could block room capacity for 30 seconds, and Firebase Hosting preview channels could pass HTTP admission but fail WebSocket upgrade with `403 Forbidden`.
- **Remediation:**
  - Added `BIOBUZZ_HANDSHAKE_LEASE_MS = 6_000` and `connectedOnce` tracking in `functions/src/lib/biobuzzRooms.ts`, plus automatic eviction of `local-offer` rooms when `admit` is at `maxRooms` capacity.
  - Allowed Firebase Hosting preview origins (`/^https:\/\/aresfirst-portal--[a-z0-9-]+\.web\.app$/`) on WebSocket `/play` upgrade in `functions/src/biobuzzServer.ts`.
- **Acceptance Test:** `functions/src/lib/biobuzzRooms.test.ts` and `functions/src/biobuzzServer.test.ts`.

---

### F07 — API Pagination, Ordering, and Archive State Preservation Bugs in Seasons, Outreach, Tournaments, and Calendar
- **Severity:** Medium
- **Confidence:** Confirmed
- **Evidence:**
  - `functions/src/routes/seasons.ts:95-115` and `185-205` unconditionally wrote `isDeleted: 0` on `POST /api/seasons` and `POST /api/awards`, inadvertently unarchiving an archived record if edited.
  - `functions/src/routes/outreach.ts:96-135` fetched a single batch of `limit + 1` documents before filtering `isDeleted !== 1` in memory, returning under-filled pages or premature `hasMore: false` when archived outreach logs were present.
  - `functions/src/routes/tournaments.ts:327` queried `adminDb.collection("tournaments").limit(limit + 1)` without `.orderBy("date", "desc")`, paginating in document-ID order before sorting in memory.
  - `functions/src/routes/tournaments.ts:198` (`GET /api/tournaments/public/results`) ignored stored `data.status` overrides when computing tournament status.
  - `functions/src/routes/calendarHelpers.ts:154-166` failed to clear `result.coverImage = null` when a recurring event exception explicitly cleared `coverPhotoId: null`.
- **Remediation:**
  - Preserved existing `isDeleted` state when updating seasons and awards in `functions/src/routes/seasons.ts`.
  - Implemented bounded batch scanning (`MAX_OUTREACH_SCAN_DOCUMENTS = 300`) in `functions/src/routes/outreach.ts`.
  - Added `.orderBy("date", "desc")` before `.limit()` in `GET /api/tournaments` and honored stored `data.status` in `GET /api/tournaments/public/results` (`functions/src/routes/tournaments.ts`).
  - Cleared `result.coverImage = null` when an occurrence overrides `coverPhotoId` to `null` in `functions/src/routes/calendarHelpers.ts`.
- **Acceptance Test:** `functions/src/routes/__tests__/seasons.test.ts`, `outreach.test.ts`, `tournaments.test.ts`, `tournamentsPublic.test.ts`, and `calendarHelpers.test.ts`.

---

### F08 — Public API Reference Missing Supported Public Endpoints & Blog Page Missing Direct RSS Discovery
- **Severity:** Low
- **Confidence:** Confirmed
- **Evidence:**
  - `src/app/developer-api/page.tsx:5-14` omitted `/api/seasons`, `/api/awards`, `/api/tournaments/public/results`, `/api/finance`, `/api/announcements`, and `/feed.xml` from `publicEndpoints`.
  - `src/app/blog/page.tsx:87-112` lacked a visible RSS Feed link button for readers to subscribe to `/feed.xml`.
- **Remediation:**
  - Added all supported public read endpoints to `src/app/developer-api/page.tsx`.
  - Added a direct `RSS Feed` link button (`/feed.xml`) to the header of `src/app/blog/page.tsx`.

---

## 3. Feature Improvements Implemented

1. **Inquiries Hub CSV Export & Rich Metadata View (`src/app/dashboard/inquiries/page.tsx`):**
   - Added CSV export (`buildInquiriesCsv`) with formula-injection neutralization (`escapeCsvCell`), plus full display of sponsor tiers (`metadata.level`), organizations (`metadata.organization`), and messages (`metadata.message`).
2. **Security & Operations Audit Log Viewer (`functions/src/routes/profileAdmin.ts`, `src/app/dashboard/users/page.tsx`):**
   - Added `GET /api/profiles/admin/audit-logs` (`ensureAdmin`) returning sanitized `audit_logs` DTOs and an interactive **Security & Operations Audit Log** panel in `/dashboard/users`.
3. **ARES Robotics Studio Notebook Drafts Workflow (`src/hooks/useDocumentSync.ts`, `src/app/dashboard/blog/page.tsx`, `src/components/dashboard/DocListGrid.tsx`):**
   - Preserved `importedFrom`, `studioEntryId`, `studioRevision`, and `studioWorkspace` on `posts` documents, added a dedicated **Studio Drafts** tab in `/dashboard/blog`, and rendered a `Studio Notebook r<N>` badge on Studio-imported posts.
4. **Interactive Sponsorship Tiers & Impact Matrix (`src/app/sponsors/page.tsx`):**
   - Added a 5-tier partnership showcase (`Titanium`, `Gold`, `Silver`, `Bronze`, `In-Kind`) with one-click tier selection that pre-fills the sponsorship inquiry form.
5. **Developer API Reference & Blog RSS Discovery (`src/app/developer-api/page.tsx`, `src/app/blog/page.tsx`):**
   - Completed the public endpoint inventory and added a visible RSS 2.0 subscription button to `/blog`.
