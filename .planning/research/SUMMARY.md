# Research Summary: Liveblocks & Tiptap Yjs Integration

## Stack Additions
- `@liveblocks/client`, `@liveblocks/react`, `@liveblocks/react-ui` for WebSocket connections, presence UI, and React hooks.
- `@liveblocks/yjs` for the official Yjs binding to Liveblocks.
- `yjs` as the core CRDT algorithm.
- `y-prosemirror` to bridge Yjs with Tiptap/Prosemirror.
- `@tiptap/extension-collaboration` and `@tiptap/extension-collaboration-cursor` to enable multiplayer in our existing Tiptap editor.
- Better-Auth custom endpoints or Cloudflare API route to securely mint Liveblocks JWT access tokens.

## Feature Table Stakes
- **Multiplayer Typing:** Real-time text syncing using CRDTs (Yjs).
- **Live Cursors & Presence:** Visual indicators showing who is currently editing and where their cursor is.
- **Conflict Resolution:** Automatic merging of offline or concurrent edits without locking the document.
- **Auth & Authorization:** Secure access tokens preventing unauthorized read/write to the websocket room.

## Differentiators
- **Version History:** Storing snapshots of the CRDT state over time.
- **Threaded Comments:** Inline comments anchored to specific text ranges.
- **Multiplayer UI beyond the editor:** Using Liveblocks Presence to show who is currently viewing the page, even outside the Tiptap editor.

## Watch Out For
- **AST Storage Migration:** Yjs stores its state as a binary CRDT update array or a base64 encoded string, NOT standard Tiptap JSON. We must ensure the `aresweb-ast-migration` skill or our backend can convert the YDoc back to HTML/JSON when saving to Cloudflare D1 for static rendering.
- **Token Minting on the Edge:** Cloudflare Workers/Pages run on the edge. Ensure the Liveblocks JWT signing works in the V8 isolate environment (Liveblocks provides `@liveblocks/node` which handles this via standard Web Crypto APIs).
- **Editor Initialization Race Conditions:** The Tiptap editor must wait for the Liveblocks `RoomProvider` to connect and initialize the YDoc before mounting, otherwise local state overwrites remote state.
