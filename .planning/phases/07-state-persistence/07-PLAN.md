# Phase 07: State Persistence & Webhook Automation

This phase ensures that the collaborative CRDT state in Liveblocks is safely synced back to our Cloudflare D1 database. Liveblocks webhooks will trigger automatically to keep our read-optimized endpoints up-to-date with the "draft" state, while allowing for explicit "publishing" and history snapshotting.

## Proposed Changes

### 1. Database Schema Updates
Add separation between draft and published states, and create a history snapshot table.

#### [MODIFY] `src/db/schema.ts` (or equivalent migration)
- **Docs, Posts, Events Tables:**
  - Add `content_draft` column to store the auto-saved Yjs/Tiptap AST.
  - The existing `content` column will represent the strictly "published" state.
- **[NEW] History Table:**
  - Create a new table `document_history` (id, room_id, content, created_at, created_by) to store snapshots generated on `RoomOutdated` webhooks.

### 2. Liveblocks Webhook Handler

#### [MODIFY] `functions/api/routes/liveblocks/index.ts`
- Add a new `POST /webhooks` endpoint.
- Use `WebhookHandler` from `@liveblocks/node` initialized with `LIVEBLOCKS_WEBHOOK_SECRET` to verify signatures.
- Handle two primary events:
  - `YjsDocumentUpdated`: Triggered periodically. Fetch the room's Yjs document via the Liveblocks REST API, parse the fragment, and update the corresponding record's `content_draft` column in D1.
  - `RoomOutdated`: Triggered when the last user leaves the room. Update the `content_draft` and create an immutable record in the `document_history` table.

### 3. Yjs Document Extraction Utility

#### [NEW] `functions/api/routes/liveblocks/yjsExtraction.ts`
- A utility to convert the raw Liveblocks YDoc binary state into standard Tiptap JSON or HTML.
- Uses `Y.Doc`, `Y.applyUpdate`, and the `y-prosemirror` or Tiptap Transformer utilities to derive the AST without a DOM.

### 4. Explicit Publish Mechanism

#### [MODIFY] `functions/api/routes/docs.ts` (and Posts/Events)
- Add a `POST /:slug/publish` endpoint.
- When called, copies the `content_draft` to `content`, and creates a new history snapshot in `document_history` marked as a "publish" event.

## Verification Plan

### Automated Tests
- Write a unit test in `functions/api/routes/liveblocks/index.test.ts` to simulate an incoming `YjsDocumentUpdated` webhook payload with a mocked Liveblocks signature and verify that the `content_draft` in the D1 mock is updated.
- Verify AST extraction logic works correctly with a mock Yjs binary payload.

### Manual Verification
- Deploy to a preview branch and connect to the live webhook from the Liveblocks dashboard.
- Edit a document with another user.
- Verify the D1 `content_draft` column updates in the background.
- Close all browser tabs and verify `RoomOutdated` fires, creating a snapshot in `document_history`.
- Click the "Publish" button on the UI and ensure the public-facing content updates.
