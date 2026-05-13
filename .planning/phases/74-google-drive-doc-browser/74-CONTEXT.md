# Phase 74: Google Drive Document Browser - Context

**Gathered:** 2026-05-12 (autonomous mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a Google Drive document browser that allows users to browse configured Google Drive folders, search and filter Google Workspace documents, view file metadata, and open documents for editing in Google's web interface.

**Scope:** Read-only browsing of Google Workspace documents (Docs, Sheets, Slides, Drawings). No file editing within ARESWEB — documents open in Google's native interface.
</domain>

<decisions>
## Implementation Decisions (Autonomous Mode Defaults)

### Drive Folder Configuration
- **D-01:** Configure a single root folder ID via environment variable (`GOOGLE_DRIVE_FOLDER_ID`)
- **Rationale:** Simple, secure, prevents browsing entire Drive
- **Future:** Can add multiple folder support if needed

### File Type Filtering
- **D-02:** Filter server-side by Google Workspace MIME types only
- **D-03:** Supported MIME types: `application/vnd.google-apps.document` (Docs), `application/vnd.google-apps.spreadsheet` (Sheets), `application/vnd.google-apps.presentation` (Slides), `application/vnd.google-apps.drawing` (Drawings)
- **Rationale:** Per DOCS-06, non-Google Workspace files excluded from document browser

### Search and Filter
- **D-04:** Server-side search using Drive API `q` parameter with `name contains '{query}'`
- **D-05:** Filter by name only (not content search) for Phase 74
- **Rationale:** Simple, fast, meets DOCS-02 requirement

### Document Opening
- **D-06:** Open documents in new tab using Google's web UI format: `https://docs.google.com/document/d/{fileId}/edit`
- **D-07:** URL patterns per file type:
  - Docs: `https://docs.google.com/document/d/{fileId}/edit`
  - Sheets: `https://docs.google.com/spreadsheets/d/{fileId}/edit`
  - Slides: `https://docs.google.com/presentation/d/{fileId}/edit`
  - Drawings: `https://docs.google.com/drawings/d/{fileId}/edit`
- **Rationale:** Native editing experience, no need to build editor

### UI Display
- **D-08:** Use list/table view with columns: Name, Type, Modified Date, Owner
- **D-09:** Icons per file type using Lucide React icons (FileText, Spreadsheet, Presentation, PenTool)
- **D-10:** Click row to open document, hover shows link preview
- **Rationale:** Standard file browser UI, familiar to users

### Metadata Display
- **D-11:** Display metadata from Drive API: `name`, `mimeType`, `modifiedTime`, `owners[0].displayName`
- **Rationale:** Matches DOCS-03 requirement exactly

### Pagination
- **D-12:** Use Drive API pagination (`nextPageToken`) with page size of 50
- **Rationale:** Balance between UI responsiveness and API quota

### Caching
- **D-13:** No D1 caching for Phase 74 (defer to Phase 77 if needed)
- **Rationale:** Document browser is low-volume, direct API calls sufficient
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `.planning/research/ARCHITECTURE.md` — Architecture patterns for Drive API integration
- `.planning/research/STACK_GOOGLE_DRIVE.md` — Stack research (no new dependencies needed)
- `.planning/REQUIREMENTS.md` — Full v8.1 requirements (DOCS-01 through DOCS-06)

### Existing Patterns
- `functions/api/routes/google-drive/index.ts` — Drive API router with service account auth (Phase 73)
- `functions/utils/googleAuth.ts` — Token management with lazy refresh (Phase 73)
- `functions/api/routes/youtube/index.ts` — Reference for OpenAPI patterns

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/api/routes/google-drive/index.ts` — Drive router skeleton from Phase 73, has `/health` endpoint, needs `/files` endpoint implementation
- `functions/utils/googleAuth.ts` — `getDriveAccessToken()` for authenticated API calls
- `src/routes/dashboard/` — Existing dashboard pages for routing

### Integration Points
- Environment variable: `GOOGLE_DRIVE_FOLDER_ID` (new, root folder to browse)
- Drive API v3 endpoint: `https://www.googleapis.com/drive/v3/files`
- Query parameters: `q='{folderId}' in parents and trashed=false and mimeType in ('application/vnd.google-apps.document', ...)`

</code_context>

<specifics>
## Specific Ideas

- Extend `functions/api/routes/google-drive/index.ts` with GET /files endpoint
- Use Drive API `files.list` method with `q` query for folder and mime type filtering
- Dashboard page at `/dashboard/drive-docs` with search input and file table
- Use existing Lucide React icons for file type indicators
</specifics>

<deferred>
## Deferred Ideas

- **Multiple folder support:** Single folder configured via env var for Phase 74
- **Content search:** Name-only search for Phase 74, content search deferred
- **D1 caching:** Deferred to Phase 77 if needed for performance
- **File download actions:** Deferred to File Manager phase (Phase 77)
</deferred>

---

*Phase: 74-Google Drive Document Browser*
*Context generated: 2026-05-12 (autonomous mode)*
