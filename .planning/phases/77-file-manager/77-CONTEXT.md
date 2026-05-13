# Phase 77: File Manager - Context

**Gathered:** 2026-05-13 (autonomous mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a file manager that allows users to upload files (PDF, docs), import from Google Drive, manage uploaded files, and integrate with the blog editor for file linking.

**Scope:** Document file management (PDF, DOCX, etc.) with blog editor integration. Public URL generation for downloads. Usage tracking for files.
</domain>

<decisions>
## Implementation Decisions (Autonomous Mode Defaults)

### File Types
- **D-01:** Supported formats: PDF, DOCX, XLSX, PPTX, TXT
- **D-02:** MIME type validation: `application/pdf`, `application/vnd.openxmlformats-officedocument.*`
- **D-03:** Size limit: 25MB per file (configurable via env var `MAX_FILE_SIZE_MB`)
- **Rationale:** FILES-03, common document formats

### R2 Storage Structure
- **D-04:** Store at `documents/{YYYY-MM-DD}/{sanitizedFilename}`
- **D-05:** Sanitize filenames: remove special chars, keep extension
- **Rationale:** FILES-04, organized structure

### Manual Upload
- **D-06:** File input in dashboard: `/dashboard/files` page
- **D-07:** Drag-and-drop upload zone with progress indication
- **D-08:** Upload form fields: title (optional), description (optional)
- **Rationale:** FILES-01

### Google Drive Import
- **D-09:** Reuse Google Drive browser from Phase 74
- **D-10:** Add "Import to Files" button to file list items
- **D-11:** Import downloads file from Drive and uploads to R2
- **Rationale:** FILES-02, reuse existing UI

### File Metadata
- **D-12:** D1 table `uploaded_files` with columns: `id`, `r2Key`, `filename`, `mimeType`, `size`, `title`, `description`, `uploadedBy`, `uploadedAt`
- **D-13:** Generate UUID for public URL: `/api/files/download/{id}`
- **Rationale:** FILES-04, FILES-06

### Blog Editor Integration
- **D-14:** Add file browser modal to blog editor (similar to image picker)
- **D-15:** Insert link as markdown: `[File Title](/api/files/download/{id})`
- **D-16:** Display file icon and size in picker
- **Rationale:** FILES-05

### File Management UI
- **D-17:** List view with columns: Name, Type, Size, Uploaded, Actions
- **D-18:** Search by filename (client-side filter for Phase 77)
- **D-19:** Actions: Download, Delete, Copy Link
- **Rationale:** FILES-07

### Usage Tracking
- **D-20:** D1 table `file_usage` with columns: `id`, `fileId`, `postId`, `postTitle`, `linkedAt`
- **D-21:** Track when file is linked in blog post content
- **D-22:** Display usage count in file manager
- **Rationale:** FILES-08

### Public Download Endpoint
- **D-23:** GET /api/files/download/:id — serves file from R2 with correct Content-Type
- **D-24:** Require authentication for download (no public anonymous access)
- **Rationale:** FILES-06, security

### Error Handling
- **D-25:** Display upload errors inline (file too large, invalid format)
- **D-26:** Confirm delete action with modal dialog
- **D-27:** Show toast notifications for upload success/failure
- **Rationale:** Good UX
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `.planning/research/ARCHITECTURE.md` — Architecture patterns for R2 storage
- `.planning/REQUIREMENTS.md` — Full v8.1 requirements (FILES-01 through FILES-08)

### Existing Patterns
- `functions/api/routes/google-drive/index.ts` — Drive file listing from Phase 74
- `functions/api/routes/media.ts` — Reference for R2 upload patterns
- `src/routes/dashboard/drive-docs.tsx` — Reference for file list UI (Phase 74)
- `src/components/editor/` — Blog editor components

### Blog Editor Integration
- Look for existing image picker patterns
- Extend editor toolbar with file link button
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/api/routes/google-drive/index.ts` — GET /files endpoint from Phase 74
- `src/routes/dashboard/drive-docs.tsx` — File list component pattern (Phase 74)
- R2 storage patterns in existing media router

### New Tables Needed
- `uploaded_files` — File metadata
- `file_usage` — Track which posts use which files

### Drive Import Pattern
```typescript
// Download from Drive and upload to R2
const driveFile = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
  headers: { Authorization: `Bearer ${token}` }
});
const buffer = await driveFile.arrayBuffer();
await env.ARES_STORAGE.put(r2Key, buffer, { httpMetadata: { contentType } });
```

</code_context>

<specifics>
## Specific Ideas

- New dashboard page: `/dashboard/files` for file management
- New API router: `functions/api/routes/files/index.ts`
- Blog editor: Add file link button next to image picker
- File browser modal similar to image picker
- Usage tracking scans blog post content for file URLs
</specifics>

<deferred>
## Deferred Ideas

- **File versioning:** Not in scope for Phase 77
- **Folder organization:** Flat structure for Phase 77
- **Bulk operations:** Single file operations only
- **File preview:** No in-browser preview for Phase 77 (download required)
- **Search by content:** Filename-only search for Phase 77
</deferred>

---

*Phase: 77-File Manager*
*Context generated: 2026-05-13 (autonomous mode)*
