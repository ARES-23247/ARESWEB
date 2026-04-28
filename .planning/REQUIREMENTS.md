# Requirements: v3.4 Collaborative Editing Ecosystem

## Active Requirements

### Collaboration
- [ ] **COL-01**: System provides secure Liveblocks token minting endpoint via Hono API to authorize users based on their Better-Auth session.
- [ ] **COL-02**: User can collaboratively edit rich-text documents in real-time via Tiptap and Liveblocks Yjs bindings.
- [ ] **COL-03**: User can see live cursors, selection highlights, and presence avatars of other active editors in the document.
- [ ] **COL-04**: System correctly persists the CRDT Yjs document state back to the D1 database as static HTML/AST for read-only rendering without WebSockets.
- [ ] **COL-05**: System utilizes Liveblocks Webhooks (`YjsDocumentUpdated` or `RoomOutdated`) to automatically sync the Liveblocks room state back to the D1 database when users disconnect, preventing data loss if a user leaves without explicitly saving.

## Traceability
*(To be populated by Roadmap)*

## Future Requirements (Deferred)
- Threaded inline comments
- Version history snapshotting

## Out of Scope
- Full migration to BlockNote (rejected to preserve existing Tiptap AST compatibility and custom extensions).
