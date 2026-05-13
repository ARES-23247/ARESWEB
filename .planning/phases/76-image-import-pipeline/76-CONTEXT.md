# Phase 76: Image Import Pipeline - Context

**Gathered:** 2026-05-13 (autonomous mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers an image import pipeline that allows users to select photos from Google Photos and import them to R2 storage. The pipeline includes validation, album structure preservation, and audit logging.

**Scope:** Import photos from Google Photos (not Drive) to R2. Preserve album structure as R2 folders. Track import history in D1.
</domain>

<decisions>
## Implementation Decisions (Autonomous Mode Defaults)

### Photo Selection
- **D-01:** Reuse Google Photos browser from Phase 75 for photo listing
- **D-02:** Add checkbox selection to PhotoGrid component for multi-select
- **D-03:** Add "Import Selected" button in photos dashboard
- **Rationale:** IMG-01 and IMG-02, reuse existing UI

### Download Strategy
- **D-04:** Download from Photos API `baseUrl`=d (full resolution download)
- **D-05:** Download server-side in Workers, not client-side (avoid CORS, keep bandwidth under Workers)
- **D-06:** Process imports sequentially (one at a time) to avoid overwhelming memory limits
- **Rationale:** Workers have 128MB memory limit, sequential processing safer

### Image Validation
- **D-07:** Validate magic bytes for JPG (FF D8 FF), PNG (89 50 4E 47), WEBP (52 49 46 46)
- **D-08:** Size limit: 50MB per image (configurable via env var `MAX_IMPORT_IMAGE_SIZE_MB`)
- **D-09:** Reject invalid formats with clear error message
- **Rationale:** IMG-04, security and resource protection

### R2 Storage Structure
- **D-10:** Import without album: `photos/imported/{YYYY-MM-DD}/{originalFilename}`
- **D-11:** Import with album: `photos/albums/{sanitizedAlbumName}/{originalFilename}`
- **D-12:** Sanitize album names: lowercase, replace spaces with hyphens, remove special chars
- **Rationale:** ALBUMS-02, organized folder structure

### Metadata Storage
- **D-13:** Store D1 record per imported photo in `imported_photos` table
- **D-14:** Schema: `id`, `r2Key`, `originalFilename`, `googleMediaItemId`, `albumId` (nullable), `importedBy`, `importedAt`
- **D-15:** Store album metadata in `photo_albums` table: `id`, `googleAlbumId`, `name`, `r2Folder`, `syncedAt`
- **Rationale:** ALBUMS-03, IMG-06, audit trail

### Audit Trail
- **D-16:** Log all import attempts to `import_audit_log` table
- **D-17:** Schema: `id`, `mediaItemId`, `filename`, `status` (success/failed), `error` (nullable), `importedBy`, `importedAt`
- **D-18:** Display audit log in dashboard for admin review
- **Rationale:** IMG-06

### Error Handling
- **D-19:** Return detailed error response: `{ success: false, error: "reason", mediaItemId }`
- **D-20:** UI displays errors per photo with "Retry" button for failed items
- **D-21:** Batch import continues even if individual photos fail
- **Rationale:** IMG-07

### API Endpoint
- **D-22:** POST /api/google-photos/import with body: `{ mediaItemIds: string[], albumId?: string }`
- **D-23:** Response: `{ imported: count, failed: count, results: [{ mediaItemId, status, error?, r2Key? }] }`
- **Rationale:** Batch import efficiency

### Album Sync
- **D-24:** On first import from album, fetch album details and store in D1
- **D-25:** Album mapping cached in D1, reused for subsequent imports
- **Rationale:** ALBUMS-01, one-time sync per album
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research & Requirements
- `.planning/research/ARCHITECTURE.md` — Architecture patterns for R2 storage
- `.planning/REQUIREMENTS.md` — Full v8.1 requirements (IMG-01 through IMG-07, ALBUMS-01 through ALBUMS-03)

### Existing Patterns
- `functions/api/routes/google-photos/index.ts` — Photos API router from Phase 75
- `functions/utils/googleAuth.ts` — `getPhotosAccessToken()` available
- `src/routes/dashboard/photos.tsx` — Photo grid UI from Phase 75 (extend for selection)
- `functions/api/routes/media.ts` — Reference for R2 upload patterns

### R2 Storage Reference
- Bucket binding: `c.env.ARES_STORAGE`
- Put method: `await c.env.ARES_STORAGE.put(key, body, { httpMetadata: contentType })`
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `functions/api/routes/google-photos/index.ts` — GET /media, /albums, POST /upload from Phase 75
- `src/routes/dashboard/photos.tsx` — PhotoGrid component (extend for checkboxes)
- `src/api/google-photos.ts` — React Query hooks (extend with import mutation)

### New Tables Needed
- `imported_photos` — Track successfully imported photos
- `photo_albums` — Album metadata for R2 folder mapping
- `import_audit_log` — Audit trail for all import attempts

### Photos API Download
```typescript
// Full resolution download URL
const downloadUrl = `${baseUrl}=d`;  // =d suffix for full resolution
const response = await fetch(downloadUrl);
if (!response.ok) throw new Error(...);
const arrayBuffer = await response.arrayBuffer();
```

### Magic Byte Validation
```typescript
function validateImageMagicBytes(buffer: ArrayBuffer): { valid: boolean; format: string } {
  const bytes = new Uint8Array(buffer.slice(0, 4));
  // JPG: FF D8 FF
  if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return { valid: true, format: "jpg" };
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return { valid: true, format: "png" };
  // WEBP: 52 49 46 46 ... 57 45 42 50
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return { valid: true, format: "webp" };
  return { valid: false, format: "unknown" };
}
```

</code_context>

<specifics>
## Specific Ideas

- Add `POST /import` endpoint to google-photos router
- Create D1 tables: `imported_photos`, `photo_albums`, `import_audit_log`
- Extend PhotoGrid with checkbox mode (toggle with "Select Photos" button)
- Add "Import Selected" bulk action
- Show import progress with toast notifications
- Display import history in admin panel
</specifics>

<deferred>
## Deferred Ideas

- **Background processing:** Sequential processing for Phase 76, queue system deferred
- **Import from Drive:** Explicitly out of scope (IMG-01: Google Photos only)
- **Image optimization:** Deferred to media pipeline
- **Duplicate detection:** Deferred to future phase
- **Export from R2:** Deferred to File Manager phase (Phase 77)
</deferred>

---

*Phase: 76-Image Import Pipeline*
*Context generated: 2026-05-13 (autonomous mode)*
