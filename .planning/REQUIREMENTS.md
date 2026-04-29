# Requirements

## REQ-1: History Sidebar Accessibility
The VersionHistorySidebar must be accessible and closable from any editor.
- **AC-1**: EditorToolbar must have a button to toggle `isHistoryOpen`.
- **AC-2**: VersionHistorySidebar `z-index` must be elevated (`z-[100]`) to ensure the close button is not overlapped by the global Navbar.

## REQ-2: Snapshot Rate-Limiting
The Liveblocks webhook must not insert a new snapshot on every continuous `ydocUpdated` event to prevent database bloat.
- **AC-1**: Queries the most recent snapshot in `document_history` for the given `roomId`.
- **AC-2**: Rejects `ydocUpdated` insertions if the most recent snapshot is less than 10 minutes old.

## REQ-3: Draft Auto-Purging
The database must not retain unnamed historical snapshots indefinitely.
- **AC-1**: Implement an auto-purging function or cron trigger to delete snapshots from `document_history` that are older than 30 days.
