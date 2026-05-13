---
phase: 77-file-manager
plan: 01
subsystem: File Manager
tags: [database, api-contracts, schema, typescript]
key_decisions:
  - Use uploaded_files and file_usage D1 tables for metadata tracking
  - R2 key format: documents/{YYYY-MM-DD}/{sanitizedFilename}
  - UUID-based public URLs: /api/files/download/{id}
  - MIME type allowlist: PDF, DOCX, XLSX, PPTX, TXT
  - Size limit: 25MB per file (configurable via MAX_FILE_SIZE_MB)
tech_stack:
  - added: ["Drizzle ORM", "D1 database", "OpenAPI/Zod contracts"]
key_files:
  - created: ["src/db/schema.ts", "shared/routes/files.ts"]
metrics:
  duration: "15 minutes"
  completed_date: "2026-05-13T11:42:00Z"
---

# Phase 77 Plan 01: Database Schema and API Contracts Summary

## Objective Completed

Defined database schema and OpenAPI/Zod contracts for the file management system, creating the foundation for type-safe end-to-end development from backend handler through Hono client to frontend.

## Implementation

### Database Schema (src/db/schema.ts)

**uploadedFiles table:**
- `id` (text, primary key): UUID for public URL generation
- `r2Key` (text): R2 storage key path
- `filename` (text): Original filename
- `mimeType` (text): Validated MIME type
- `size` (integer): File size in bytes
- `title` (text, optional): Title override
- `description` (text, optional): File description
- `uploadedBy` (text): CF email of uploader
- `uploadedAt` (text): Upload timestamp
- `source` (text): Upload source ("manual" or "google-drive")
- Indexes on: uploadedAt, uploadedBy, r2Key

**fileUsage table:**
- `id` (text, primary key)
- `fileId` (text, foreign key to uploadedFiles)
- `postId` (text, foreign key to posts.slug)
- `postTitle` (text): Denormalized for display
- `linkedAt` (text): Link timestamp
- Indexes on: fileId, postId, linkedAt
- Cascade delete configured for referential integrity

### API Contracts (shared/routes/files.ts)

**Route contracts defined:**
1. `uploadFileRoute` - POST /upload (multipart/form-data)
2. `listFilesRoute` - GET / with search query
3. `downloadFileRoute` - GET /download/:id (binary)
4. `deleteFileRoute` - DELETE /:id
5. `importFromDriveRoute` - POST /import-from-drive
6. `scanUsageRoute` - POST /scan-usage

**Allowed MIME types array:**
- application/pdf
- application/vnd.openxmlformats-officedocument.wordprocessingml.document (DOCX)
- application/vnd.openxmlformats-officedocument.spreadsheetml.sheet (XLSX)
- application/vnd.openxmlformats-officedocument.presentationml.presentation (PPTX)
- text/plain

**uploadedFileSchema** includes all file metadata with downloadUrl and usageCount.

## Deviations from Plan

None - plan executed exactly as written.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_endpoint | shared/routes/files.ts | New API endpoints for file management |

## Verification

- [x] uploadedFiles and fileUsage tables added to schema.ts
- [x] Foreign key relationships defined with cascade deletes
- [x] OpenAPI contracts file created at shared/routes/files.ts
- [x] All 6 routes defined with proper validation
- [x] Allowed MIME types array matches D-01
- [x] TypeScript compilation successful

## Self-Check: PASSED

- Files created: src/db/schema.ts (modified), shared/routes/files.ts
- Commit exists: 083dd975
