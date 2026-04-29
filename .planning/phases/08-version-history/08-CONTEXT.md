# Phase 08: Version History UI & Rollbacks

## Objective
Build the interface to view and restore historical document snapshots, mapped to requirements VER-01, VER-02, VER-03.

## Context
In Milestone v3.4, we established a `document_history` table that automatically logs snapshots of the editor's state when a Liveblocks room becomes empty (`RoomOutdated` webhook). This table schema is:
```sql
CREATE TABLE IF NOT EXISTS document_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## Decisions
1. **API Exposure:** We need a new backend endpoint `GET /api/liveblocks/history/:roomId` to retrieve these snapshots for the frontend.
2. **Preview Mechanism:** To allow previewing without altering the current document, we'll create a modal that renders the HTML content safely using a read-only instance or simple `dangerouslySetInnerHTML` with `prose` styling.
3. **Rollback Mechanism:** To "Restore", the frontend will simply call `editor.commands.setContent(snapshot.content)`. Because the editor is bound to a Yjs document mapped to a Liveblocks room, this update will instantly synchronize to all other connected clients and trigger the webhook logic, making it the new `content_draft`.
