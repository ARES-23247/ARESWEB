# Phase 10 Implementation Plan

## 1. YPP-Filtered API
- **File:** `functions/api/routes/liveblocks/index.ts`
- **Action:** Modify the `/contributors/:roomId` endpoint.
- **Logic:** Perform a `db.selectFrom("document_contributors").innerJoin("user", "user.id", "document_contributors.user_id").where("user.role", "not in", ["coach", "mentor"])`.
Wait, the table is named `user` in BetterAuth.
Let's verify the `user` table name. 

## 2. ContributorStack UI
- **File:** `src/components/ui/ContributorStack.tsx`
- **Action:** Create a component using `@tanstack/react-query` to fetch contributors.
- **Logic:** Render an overlapping row of circular `<img src={avatar}>` tags. Limit to 5 with a "+N" badge.

## 3. Page Integration
- **Files:** `src/pages/events/EventDetails.tsx`, `src/pages/blog/PostDetails.tsx`, `src/pages/docs/DocDetails.tsx`.
- **Action:** Embed `<ContributorStack roomId="event_123" />` near the title or author section.
