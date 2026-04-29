# Roadmap: v3.4 Collaborative Editing Ecosystem

This roadmap breaks down the integration of Liveblocks and Tiptap Yjs bindings into discrete, verifiable phases.

## Summary
- **Phase 05**: Liveblocks Infrastructure & Authentication
- **Phase 06**: Real-time Editor Sync & Presence UI
- **Phase 07**: State Persistence & Webhook Automation

---

## Phase 05: Liveblocks Infrastructure & Authentication
**Goal:** Establish the foundational Liveblocks connection and secure backend token minting.
**Requirements:** 
- COL-01

**Success Criteria:**
1. Hono API provides a `/api/liveblocks-auth` endpoint.
2. Endpoint successfully validates Better-Auth sessions and returns a signed Liveblocks JWT.
3. Client can initialize a Liveblocks `RoomProvider` and connect to a room without unauthorized errors.

---

## Phase 06: Real-time Editor Sync & Presence UI
**Goal:** Implement the multiplayer editing experience using Tiptap and Liveblocks.
**Requirements:** 
- COL-02, COL-03

**Success Criteria:**
1. Multiple users in the same room can type simultaneously and see text sync via Yjs.
2. Live cursors and highlight colors are visible for all active users.
3. User avatars (based on auth data) are displayed in a presence stack above the editor.

---

## Phase 07: State Persistence & Webhook Automation
**Goal:** Ensure CRDT state is safely persisted to D1 drafts and explicitly promoted to published.
**Requirements:** 
- COL-04, COL-05, COL-06, COL-07

**Success Criteria:**
1. `YjsDocumentUpdated` webhook triggers in-place draft saves to D1 without adding history spam.
2. `RoomOutdated` webhook triggers a draft save AND creates a snapshot in the history table.
3. Draft changes do not affect the public-facing published document until explicitly requested.
4. Database AST converts correctly from the Liveblocks YDoc structure for static rendering.
