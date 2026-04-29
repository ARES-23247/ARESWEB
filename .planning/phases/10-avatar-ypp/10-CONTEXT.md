# Phase 10: Public Avatar & YPP Integration

## Objective
Implement a public-facing dynamic avatar stack that displays student contributors to an event/post, while strictly enforcing YPP (Youth Protection Program) by omitting coach/mentor avatars from public view.

## Context
In Phase 09, we built the backend to track unique users entering a Collaborative Editor room. Now we need to query this data (`/api/liveblocks/contributors/:roomId`) and render it on public event/post pages.
However, ARES 23247's YPP rules require that adult mentors do not appear in public contributor lists or get public attribution. Therefore, the avatar stack must filter out users with a `mentor` or `coach` role.
Since `document_contributors` only stores `user_id`, `user_name`, and `user_avatar`, we must either:
1. Include `role` in the Liveblocks JWT (and `document_contributors`) when the user enters.
2. Join `document_contributors` with the `users` table on the backend when serving the API endpoint to filter by role.

Option 2 is safer and more reliable, as roles can change after an edit.

## Decisions
1. **API Enhancement:** We will modify `GET /api/liveblocks/contributors/:roomId` to perform a join on the `users` table and filter out rows where `role IN ('coach', 'mentor')`.
2. **UI Component:** A `ContributorStack` React component that accepts a `roomId` and fetches the filtered contributors, displaying overlapping avatar images.
3. **Integration:** Embed `ContributorStack` into the public event page (`src/pages/events/EventDetails.tsx`) and public post page (`src/pages/blog/PostDetails.tsx`).
