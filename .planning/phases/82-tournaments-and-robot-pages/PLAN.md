# Phase 82: Tournaments and Robot Pages

## Objective
Implement `Tournaments` and `Robot Pages` entities to manage FTC events, robot specifications, matches, and awards tracking. Incorporate the FTC Events API for synchronization and provide a seamless public gallery and detail view for both entities.

## Schema Additions (`src/db/schema.ts`)
1. **`robots` table**: Stores robot profile, Tiptap AST, Album, CAD links, Reveal Video, and Spec Card data (weight, drivetrain, programming language).
2. **`tournaments` table**: Stores event metadata, Tiptap AST, Album, FTC API mapping code (`ftcEventCode`), linked robot (`robotId`), and high-level performance metrics (Rank, OPR, Alliance Status).
3. **`tournament_matches` table**: Stores scheduled/played matches mapped from FTC Events API, with an optional admin-added `youtubeVideoId`.
4. **`tournament_awards` table**: Stores awards won at a specific tournament (e.g., "Inspire Award Winner").

## Backend API
1. `functions/api/routes/tournaments/index.ts`: CRUD + `POST /sync-from-ftc` endpoint to pull matches and rankings.
2. `functions/api/routes/robots/index.ts`: CRUD for robots.
3. Shared Zod schemas in `shared/schemas/tournamentSchema.ts` and `robotSchema.ts`.

## Frontend Admin UI
1. `RobotsManager.tsx`: Dashboard with Tiptap, Album Picker, CAD embedding, Reveal video, and Specs.
2. `TournamentsManager.tsx`: Dashboard with Tiptap, Album Picker, FTC Sync button, and sub-forms for YouTube Match Video linking and Awards input.

## Frontend Public UI
1. `/robots`: Gallery view of all team robots.
2. `/robots/:id`: Public Robot Detail page (Specs Card, CAD Iframe, Reveal Video, Album, AST).
3. `/tournaments/:id`: Public Tournament Detail page (Linked Robot, Performance Metrics, AST, Match List with YouTube buttons, Awards, Album).

## Verification
- Local D1 migration applied.
- FTC proxy correctly caches and pulls data for a valid event code.
- Null states (no video, no CAD) fail gracefully.
