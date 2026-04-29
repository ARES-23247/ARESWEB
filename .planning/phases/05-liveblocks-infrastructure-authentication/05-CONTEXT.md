# Phase 05 Context: Liveblocks Infrastructure & Authentication

## Domain
Establish the foundational Liveblocks connection and secure backend token minting.

## Canonical References
*No external references provided. Implementing based on ROADMAP.md.*

## Decisions

### Endpoint Location
- **Decision**: Create a dedicated `routes/liveblocks/index.ts` router.
- **Rationale**: `auth.ts` has a wildcard `/*` route that proxies directly to Better-Auth. Keeping Liveblocks in its own router prevents routing conflicts and provides a clean namespace (`/api/liveblocks/auth` and eventually `/api/liveblocks/webhooks`).

### User Presence Data
- **Decision**: The Liveblocks JWT `info` payload will only expose the user's `nickname` and `avatar`.
- **Rationale**: Keeps PII (like email) hidden from the presence stack while providing enough info for UI avatars and cursors.

### Room Authorization Model
- **Decision**: Users must have "author abilities" to receive a token for a document room.
- **Rationale**: Verifying the Better-Auth session role/permissions before minting the Liveblocks token ensures that only users with write access can join the collaborative session.

## Code Context
- Better-Auth is initialized via `getAuth()` in `functions/utils/auth.ts`.
- API endpoints are mounted in `functions/api/[[route]].ts`.
