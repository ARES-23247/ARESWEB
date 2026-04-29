# Phase 06: Real-time Editor Sync & Presence UI

## Goal
Implement the multiplayer editing experience using Tiptap and Liveblocks.

## Proposed Changes
1. Configured LiveblocksProvider at the root (`main.tsx`).
2. Refactored `getEditorExtensions` to conditionally inject `@tiptap/extension-collaboration`.
3. Developed `CollaborativeEditorRoom.tsx` to manage Yjs/Liveblocks lifecycle.
4. Implemented `PresenceAvatars.tsx` for visual presence.
5. Wrapped `DocsEditor`, `BlogEditor`, and `EventEditor` in `CollaborativeEditorRoom`.

## Verification
- Verified multiple users can connect and type simultaneously.
- Verified cursor presence correctly syncs.
