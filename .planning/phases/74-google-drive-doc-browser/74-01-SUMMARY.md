# Phase 74 Plan 01: Create OpenAPI route contracts

**Plan:** 74-01
**Type:** Execute
**Wave:** 1
**Status:** Complete

## Summary

Defined OpenAPI/Zod contracts for Google Drive file listing endpoint with search, pagination, and Google Workspace MIME type filtering. Created type-safe route contracts that enable end-to-end type inference from server handler through Hono client to frontend usage.

## Tasks Completed

### Task 1: Create shared/routes/google-drive.ts with OpenAPI contracts
- Created new file shared/routes/google-drive.ts following pattern in shared/routes/youtube.ts
- Imported zod and createRoute from "@hono/zod-openapi"
- Imported standardErrors from "./common"

- Defined driveFileSchema with z.object containing:
  - id: z.string().openapi({ example: "1AbcDefGhiJklmnoPqrsTuvWxYz" })
  - name: z.string().openapi({ example: "Team Meeting Notes" })
  - mimeType: z.string().openapi({ example: "application/vnd.google-apps.document" })
  - modifiedTime: z.string().datetime().openapi({ example: "2024-05-12T10:30:00.000Z" })
  - owner: z.string().optional().openapi({ example: "mentor@aresfirst.org" })
  - webViewLink: z.string().url().optional().openapi({ example: "https://docs.google.com/document/d/1AbcDef/edit" })

- Defined documentType enum discriminating Google Workspace types per D-03:
  - "document" (Docs)
  - "spreadsheet" (Sheets)
  - "presentation" (Slides)
  - "drawing" (Drawings)

- Defined listDriveFilesQuerySchema with z.object containing:
  - q: z.string().optional() for search query
  - pageToken: z.string().optional() for pagination
  - pageSize: z.coerce.number().min(1).max(100).default(50).optional()

- Defined listDriveFilesResponseSchema with z.object containing:
  - files: z.array(driveFileSchema)
  - nextPageToken: z.string().optional()

- Defined listDriveFilesRoute using createRoute with:
  - method: "get", path: "/files"
  - request.query: listDriveFilesQuerySchema
  - responses: 200 with listDriveFilesResponseSchema, plus standardErrors
  - tags: ["google-drive", "admin"]

- No @ts-ignore or type assertions used per TypeScript Safety SKILL.md

## Files Modified

- `shared/routes/google-drive.ts` - Created with route contracts and schemas

## Deviations from Plan

None - plan executed exactly as written.

## Verification

1. Route contract file exists at shared/routes/google-drive.ts
2. listDriveFilesRoute exported with proper OpenAPI metadata
3. driveFileSchema defines all required fields per DOCS-03
4. Query schema supports search (q) and pagination (pageToken, pageSize)
5. TypeScript compilation succeeds with zero errors

## Success Criteria Met

- [x] OpenAPI contract defines file listing endpoint with query parameters for search and pagination
- [x] Response schema includes all metadata fields required by DOCS-03
- [x] File type enum represents Google Workspace MIME types per D-03
- [x] Contract ready for use by backend handler (74-02) and frontend client (74-03)

## Commits

- `bedd3eaf`: feat(74-01): add OpenAPI route contracts for Google Drive files endpoint
