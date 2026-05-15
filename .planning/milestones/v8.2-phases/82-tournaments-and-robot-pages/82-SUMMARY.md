# Phase 82: Tournaments and Robot Pages — Summary

## What We Did

### Database Schema (`src/db/schema.ts`)
- Added 4 new D1 tables: `robots`, `tournaments`, `tournament_matches`, `tournament_awards`.
- `robots` stores robot profile data: name, season, weight, drivetrain, primary mechanism, programming language, Tiptap AST body, album link, CAD URLs (Onshape + embeddable viewer), and reveal video ID.
- `tournaments` stores event metadata: name, season, linked robot, FTC Event Code for API sync, Tiptap AST body, album link, and performance stats (rank, OPR, alliance role, elimination status).
- `tournament_matches` stores match-level data synced from the FTC Events API: match number, match type, red/blue scores, and optional YouTube video ID for match recordings.
- `tournament_awards` stores awards won at each tournament (name + description).
- Generated and applied the D1 migration (`drizzle/20260515135616_tournaments_robots/migration.sql`).

### Shared Types & Route Definitions
- Created `shared/schemas/robotSchema.ts` — Zod schemas for `Robot`, `RobotPayload`.
- Created `shared/schemas/tournamentSchema.ts` — Zod schemas for `Tournament`, `TournamentPayload`, `TournamentMatch`, `TournamentAward`, `TournamentAwardPayload`.
- Created `shared/routes/robots.ts` — OpenAPI route definitions for robot CRUD.
- Created `shared/routes/tournaments.ts` — OpenAPI route definitions for tournament CRUD, match sync, match video update, and award management.

### Backend API (`functions/api/routes/`)
- Created `robots.ts` — Full CRUD router for robots with centralized `ensureAdmin` middleware. Includes `serializeRobot` helper to bridge Drizzle model → Zod response schema.
- Created `tournaments.ts` — Full CRUD router for tournaments plus:
  - `POST /{id}/sync-matches` — Pulls match data from the FTC Events API via the existing FTC proxy, upserts match records into `tournament_matches`.
  - `PATCH /{id}/matches/{matchId}` — Updates YouTube video ID on a match record.
  - `POST /{id}/awards` — Creates/updates tournament awards.
  - `DELETE /{id}/awards/{awardId}` — Deletes a tournament award.
  - Uses centralized `ensureAdmin` middleware (not per-route manual calls).

### Frontend Admin UI
- Created `RobotsManager.tsx` — Dashboard manager with:
  - Robot listing grid with edit/delete actions.
  - Modal editor form: name, season selector, weight, drivetrain, primary mechanism, programming language, CAD URLs, reveal video ID.
  - Integrated `RichTextEditor` (Tiptap) for robot description body.
  - `AlbumPickerModal` integration for photo gallery attachment.
- Created `TournamentsManager.tsx` — Dashboard manager with:
  - Tournament listing with "Manage Matches" detail view and edit/delete actions.
  - `TournamentDetailEditor` sub-component: displays match table with red/blue scores, YouTube video IDs, and a "Sync from FTC Events" button.
  - Modal editor form: name, FTC Event Code, season, robot selector, rank, OPR, alliance role.
  - Integrated `RichTextEditor` (Tiptap) for tournament recap body.
  - `AlbumPickerModal` integration for photo gallery attachment.
- Registered both managers as dashboard routes (`src/routes/dashboard/robots.tsx`, `src/routes/dashboard/tournaments.tsx`).
- Added sidebar navigation entries in `DashboardSidebar.tsx`.

### Frontend Public Pages
- Created `/robots` (`src/routes/robots.tsx`) — Gallery page listing all robots with spec badges (weight, drivetrain, language) and season labels. Uses ARES brand gradient styling.
- Created `/robots/:id` (`src/routes/robots.$id.tsx`) — Robot detail page featuring:
  - Robot Spec Card (weight, drivetrain, mechanism, language) in Pokémon-card style layout.
  - Reveal video embed (YouTube iframe, conditional).
  - CAD viewer iframe (Onshape embeddable viewer, conditional).
  - Tiptap AST body rendering.
  - Linked album display (conditional).
- Created `/tournaments` (`src/routes/tournaments.tsx`) — Gallery page listing all tournaments with rank badges, alliance roles, and OPR stats.
- Created `/tournaments/:id` (`src/routes/tournaments.$id.tsx`) — Tournament detail page featuring:
  - Performance metrics dashboard (rank, OPR, alliance role, elimination status).
  - Match schedule sidebar with score display and YouTube video buttons.
  - Tiptap AST body rendering.
  - Awards display section.
  - Linked album display (conditional).

### Client API Hooks (`src/api/`)
- Created `robots.ts` — TanStack Query hooks: `useGetRobots`, `useGetRobot`, `useCreateRobot`, `useUpdateRobot`, `useDeleteRobot` with `withMutationCallbacks` integration.
- Created `tournaments.ts` — TanStack Query hooks: `useGetTournaments`, `useGetTournament`, `useCreateTournament`, `useUpdateTournament`, `useDeleteTournament`, `useSyncTournamentMatches`, `useUpdateMatchVideo`, `useCreateTournamentAward`, `useDeleteTournamentAward`.

### Type-Safety & Lint Hardening
- Fixed all `tsc --noEmit` errors by providing explicit `name` defaults in Drizzle insert operations (required fields in partial payload schemas).
- Replaced all `no-explicit-any` violations with proper types: `Partial<Robot>`, `Partial<Tournament>`, `Record<string, unknown>`.
- Removed dead code (broken `mutateAsync` hook reassignment that violated `react-hooks/immutability`).
- Removed unused imports (`ChevronRight`, `MapPin`, `useUpdateTournament`, `useUpdateRobot`).
- Replaced `catch(error: any)` with `catch(error: unknown)` + `instanceof Error` guard.
- Prefixed unused destructured variables with underscore convention.

## Decisions & Learnings
- **Centralized Middleware Pattern**: Migrated from manual `ensureAdmin()` calls inside every OpenAPI route handler to router-level `_router.use("*", ensureAdmin)` middleware. This reduces boilerplate and guarantees all admin routes are protected without developer oversight.
- **FTC Events API Proxy**: Reused the existing `getFtcData()` proxy function for match synchronization rather than building a new HTTP client. This centralizes API key management and caching.
- **Upsert-on-Sync Strategy**: Match sync uses a "check existing → update or insert" pattern keyed on `tournamentId + matchNumber` to prevent duplicate match records on repeated syncs.
- **Partial Payload Schemas**: Made `name` field partial in `robotPayloadSchema` and `tournamentPayloadSchema` to support PATCH operations, but provided explicit defaults (`"New Robot"`, `"New Tournament"`) in POST handlers to satisfy Drizzle's `NOT NULL` constraint.
- **Direct Fetch Fallback for Updates**: Both managers use `fetch()` + `window.location.reload()` for update operations instead of the `useUpdateX("")` hooks (which require the ID at hook initialization time). This is a pragmatic MVP pattern to be refined with per-ID mutation hooks later.

## Files Changed (28 files, ~11k lines)

### New Files
- `drizzle/20260515135616_tournaments_robots/migration.sql`
- `shared/schemas/robotSchema.ts`
- `shared/schemas/tournamentSchema.ts`
- `shared/routes/robots.ts`
- `shared/routes/tournaments.ts`
- `functions/api/routes/robots.ts`
- `functions/api/routes/tournaments.ts`
- `src/api/robots.ts`
- `src/api/tournaments.ts`
- `src/components/RobotsManager.tsx`
- `src/components/TournamentsManager.tsx`
- `src/components/RichTextEditor.tsx`
- `src/routes/dashboard/robots.tsx`
- `src/routes/dashboard/tournaments.tsx`
- `src/routes/robots.tsx`
- `src/routes/robots.$id.tsx`
- `src/routes/tournaments.tsx`
- `src/routes/tournaments.$id.tsx`

### Modified Files
- `src/db/schema.ts` — Added 4 new table definitions.
- `functions/api/[[route]].ts` — Registered new routers.
- `src/api/index.ts` — Re-exported new API modules.
- `src/components/dashboard/DashboardSidebar.tsx` — Added sidebar nav links.
- `src/routeTree.gen.ts` — Auto-generated route tree update.

## Next Steps
- Refine the update hook pattern (per-ID mutation hooks instead of direct `fetch()`).
- Add award management sub-form in `TournamentDetailEditor`.
- Implement robot version tracking (e.g., "Phobos 1.0", "Phobos 1.1").
- Add YouTube match video search/link UI in the match detail view.
- Link existing awards database to tournament awards table for cross-referencing.
