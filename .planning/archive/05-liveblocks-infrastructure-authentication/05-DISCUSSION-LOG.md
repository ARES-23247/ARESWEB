# Phase 05 Discussion Log

> **Note:** This log is for human reference and retrospective audits. Downstream AI agents read `05-CONTEXT.md` instead.

## 1. Endpoint Location
**Options presented:** Should the token minting endpoint live inside the existing `auth.ts` router, or get its own dedicated `liveblocks.ts` router?
**User selection:** "which would be better?"
**Resolution:** the agent recommended a dedicated `liveblocks.ts` router to avoid wildcard conflicts with the `auth.ts` Better-Auth proxy.

## 2. User Presence Data
**Options presented:** What specific Better-Auth user information should be embedded into the Liveblocks token?
**User selection:** "nickname, avatar"
**Resolution:** Liveblocks token will only expose nickname and avatar to protect PII.

## 3. Room Authorization Model
**Options presented:** Can any logged-in user connect to a Liveblocks room, or do we need to verify admin/editor permissions per room?
**User selection:** "they need to have author abilities."
**Resolution:** The endpoint will verify the user's role has author abilities before issuing the token.
