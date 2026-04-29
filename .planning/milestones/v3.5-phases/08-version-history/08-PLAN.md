# Phase 08 Implementation Plan

## 1. Backend API (Liveblocks History)
- **File:** `functions/api/routes/liveblocks/index.ts`
- **Action:** Add `GET /history/:roomId`.
- **Logic:** Query `document_history` where `room_id = roomId`, ordered by `created_at DESC`. Return the JSON array.

## 2. Frontend UI Component
- **File:** `src/components/editor/VersionHistorySidebar.tsx` (or Modal)
- **Action:** Create a component that accepts `roomId` and the active `editor` instance.
- **Logic:** 
  - Fetch history via `api.liveblocks.history.useQuery`.
  - Display a list of versions by date.
  - "Preview" button opens a dialog showing the `content`.
  - "Restore" button calls `editor.commands.setContent(content)`.

## 3. Editor Integration
- **File:** `src/components/editor/EditorFooter.tsx` (or `RichEditorToolbar.tsx`)
- **Action:** Add a "History" button that toggles the `VersionHistorySidebar` (or opens a modal). Pass the `roomId` down from the `CollaborativeEditorRoom` context.
