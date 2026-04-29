# Phase 09 Implementation Plan

## 1. Schema Updates
- **File:** `schema.sql`
- **Action:** Add `document_contributors` table schema.

## 2. Webhook Event Processing
- **File:** `functions/api/routes/liveblocks/webhooks.ts`
- **Action:** Listen for `UserEntered`. 
- **Logic:** Upsert into `document_contributors`. 
  - `room_id = event.data.roomId`
  - `user_id = event.data.userId`
  - `user_name = event.data.info.name`
  - `user_avatar = event.data.info.avatar`
  - `last_contributed_at = CURRENT_TIMESTAMP`

## 3. Contributor Retrieval API
- **File:** `functions/api/routes/liveblocks/index.ts`
- **Action:** Add `GET /contributors/:roomId`.
- **Logic:** Query `document_contributors` for the room ID. Return as JSON array.
