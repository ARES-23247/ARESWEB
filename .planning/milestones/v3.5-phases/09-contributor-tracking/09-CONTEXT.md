# Phase 09: Contributor Tracking Backend

## Objective
Develop a backend system to track unique contributors to collaborative document rooms.

## Context
We need to attribute document edits to specific users and display their avatars publicly (if they are students). Liveblocks provides presence and webhook events. We have a webhook endpoint `/api/liveblocks/webhooks` that currently listens to `StorageUpdated` and `RoomOutdated`.
There's also a `UserEntered` webhook event that Liveblocks triggers when a user enters a room.

## Data Storage
We need a `document_contributors` table in the database.
```sql
CREATE TABLE IF NOT EXISTS document_contributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    last_contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, user_id)
);
```

## Implementation Strategy
1. **Schema Update:** Add the table to `schema.sql`.
2. **Webhook Listener:** Update `functions/api/routes/liveblocks/webhooks.ts` to process `UserEntered` events. When a user enters a room, upsert their info into `document_contributors`.
3. **API Endpoint:** Create an endpoint `GET /api/liveblocks/contributors/:roomId` to return the list of contributors for a room.
