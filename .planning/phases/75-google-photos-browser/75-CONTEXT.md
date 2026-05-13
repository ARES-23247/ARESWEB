# Phase 75: Google Photos Browser - Context

**Gathered:** 2026-05-13 (autonomous mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers a Google Photos browser that allows users to browse photos (not videos), view thumbnails and metadata, browse albums, and upload photos to Google Photos.

**Scope:** Read-only browsing of Google Photos media items (photos only, no videos per PHOTO-02) plus upload capability (write scope from Phase 73). Albums display for organized navigation.
</domain>

<decisions>
## Implementation Decisions (Autonomous Mode Defaults)

### Media Type Filtering
- **D-01:** Filter server-side by `mimeType` — include only image types, exclude videos
- **D-02:** Exclude MIME types: `video/mp4`, `video/quicktime`, `video/x-msvideo`, etc.
- **Rationale:** Per PHOTO-02 requirement, photo-only browsing

### Thumbnail Display
- **D-03:** Use Photos API `baseUrl` field for thumbnails (no separate thumbnail call needed)
- **D-04:** Display thumbnails at 200x200px in grid view
- **Rationale:** Photos API provides baseUrl that works as thumbnail, efficient

### Metadata Display
- **D-05:** Display metadata from Photos API: `filename`, `mediaMetadata` (width, height, creation time), `description`
- **Rationale:** Matches PHOTO-03 requirement

### Pagination
- **D-06:** Use Photos API `pageToken` pagination with page size of 25
- **R-07:** Grid view loads next page on scroll (infinite scroll)
- **Rationale:** Better UX for visual content than traditional pagination

### Albums Display
- **D-08:** Fetch albums using Photos Library API `albums.list()` endpoint
- **D-09:** Display albums as cards with cover image and title
- **D-10:** Click album to filter media items by `albumId`
- **Rationale:** Per PHOTO-05, albums for organized browsing

### Upload Flow
- **D-11:** File input accepts multiple image files (JPG, PNG, WEBP)
- **D-12:** Upload form includes: title (text input), description (textarea), album select dropdown
- **D-13:** Upload to Google Photos using `mediaItems:batchCreate` endpoint
- **D-14:** On success, refresh media list to show new uploads
- **Rationale:** Per UPLOAD-01 and UPLOAD-03 requirements

### Upload Authentication
- **D-15:** Use service account with `photoslibrary.appendonly` scope (from Phase 73)
- **Rationale:** Write scope already configured in AUTH-02/UPLOAD-02

### UI Layout
- **D-16:** Left sidebar: albums list (clickable filters)
- **D-17:** Main area: photo grid with infinite scroll
- **D-18:** Top bar: search input, upload button
- **Rationale:** Standard photo gallery UI pattern

### Search
- **D-19:** Use Photos API search via `mediaItems:search` with `query` parameter
- **D-20:** Search by filename and description (content search available in Photos API)
- **Rationale:** Simple search implementation using Photos API capabilities

### Error Handling
- **D-21:** Display upload errors inline (file too large, unsupported format, API failure)
- **D-22:** Retry failed uploads with "Retry" button per failed file
- **Rationale:** Good UX for bulk upload operations
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `.planning/research/ARCHITECTURE.md` — Architecture patterns for Photos API integration
- `.planning/research/STACK_GOOGLE_DRIVE.md` — Stack research (mentions Photos Library API)
- `.planning/REQUIREMENTS.md` — Full v8.1 requirements (PHOTO-01 through PHOTO-05, UPLOAD-01, UPLOAD-03)

### Existing Patterns
- `functions/api/routes/google-photos/index.ts` — Photos API router skeleton from Phase 73
- `functions/utils/googleAuth.ts` — `getPhotosAccessToken()` for authenticated API calls
- `functions/api/routes/google-drive/index.ts` — Reference for file listing endpoint pattern (Phase 74)
- `src/routes/dashboard/drive-docs.tsx` — Reference for dashboard page layout (Phase 74)

### Google Photos API Reference
- Library API v1: `https://photoslibrary.googleapis.com/v1`
- Key endpoints: `mediaItems:list`, `mediaItems:search`, `albums:list`, `mediaItems:batchCreate`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/api/routes/google-photos/index.ts` — Photos router skeleton from Phase 73, has `/health` endpoint, needs `/media` and `/albums` endpoints
- `functions/utils/googleAuth.ts` — `getPhotosAccessToken()` for authenticated API calls
- `src/routes/dashboard/` — Existing dashboard pages for routing
- `src/components/ui/` — Reusable UI components (button, input, card)

### Integration Points
- Photos API v1 endpoint: `https://photoslibrary.googleapis.com/v1`
- Authentication: Bearer token from getPhotosAccessToken()
- Upload requires `photoslibrary.appendonly` scope (already in Phase 73)

### Photos API Response Format
```typescript
// mediaItems:list response
{
  "mediaItems": [
    {
      "id": "string",
      "filename": "string",
      "mimeType": "image/jpeg",
      "baseUrl": "https://...",  // Use for thumbnail
      "mediaMetadata": {
        "width": "3024",
        "height": "4032",
        "creationTime": "2024-01-15T10:30:00Z"
      },
      "description": "optional string"
    }
  ],
  "nextPageToken": "optional token"
}
```

</code_context>

<specifics>
## Specific Ideas

- Extend `functions/api/routes/google-photos/index.ts` with GET /media and GET /albums endpoints
- Use Photos API `mediaItems:list` for browsing, `mediaItems:search` for filtering
- Dashboard page at `/dashboard/photos` with album sidebar and photo grid
- Upload button opens modal with file input, title, description, album select
- Infinite scroll for photo grid using Intersection Observer
</specifics>

<deferred>
## Deferred Ideas

- **Video support:** Explicitly excluded per PHOTO-02 requirement
- **Photo editing:** Deferred to future phase (use Google Photos editor)
- **Album creation:** Deferred — can only add to existing albums in Phase 75
- **Bulk operations:** Select multiple photos deferred to Phase 76 (import pipeline)
- **Face recognition/tagging:** Not in scope for Phase 75
</deferred>

---

*Phase: 75-Google Photos Browser*
*Context generated: 2026-05-13 (autonomous mode)*
