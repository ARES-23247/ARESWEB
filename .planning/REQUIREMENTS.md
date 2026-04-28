# Requirements: v3.4 Collaborative Editing Ecosystem

## Active Requirements

### Collaboration
- [ ] **COL-01**: System provides secure Liveblocks token minting endpoint via Hono API to authorize users based on their Better-Auth session.
- [ ] **COL-02**: User can collaboratively edit rich-text documents in real-time via Tiptap and Liveblocks Yjs bindings.
- [ ] **COL-03**: User can see live cursors, selection highlights, and presence avatars of other active editors in the document.
- [ ] **COL-04**: System correctly persists the CRDT Yjs document state back to the D1 database as static HTML/AST for read-only rendering without WebSockets.
- [ ] **COL-05**: System utilizes Liveblocks Webhooks (`YjsDocumentUpdated` and `RoomOutdated`) to automatically back up the draft state to the D1 database periodically during active editing sessions and definitively when the last user leaves the room.
- [ ] **COL-06**: System maintains separation between "draft" (Liveblocks CRDT state/auto-saves) and "published" (public D1 database state), ensuring webhook auto-saves only update the draft revision until a user explicitly clicks "Publish Changes".
- [ ] **COL-07**: Periodic auto-saves perform in-place updates to prevent database spam. However, a new history snapshot is explicitly created when the room empties (`RoomOutdated` webhook) to preserve the state at the end of each editing session, or when explicitly published.

## Traceability
*(To be populated by Roadmap)*

## Future Requirements (Deferred)
- Threaded inline comments
- Version history snapshotting

## Out of Scope
- Full migration to BlockNote (rejected to preserve existing Tiptap AST compatibility and custom extensions).
