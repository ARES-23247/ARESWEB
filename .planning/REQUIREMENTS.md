# Requirements: ARESWEB

**Defined:** 2026-05-12
**Core Value:** Providing a highly accessible, fast, and feature-rich unified portal for students, mentors, and administrators.

## v8.1 Requirements - Google Workspace Integrations

Requirements for Google Photos and Google Drive API integration with service account authentication.

### Authentication (AUTH)

- [ ] **AUTH-01**: Service account authenticates with Google Photos Library API and Drive API
- [ ] **AUTH-02**: Access tokens refresh automatically before expiration
- [ ] **AUTH-03**: D1 stores OAuth tokens and cached media metadata
- [ ] **AUTH-04**: Token refresh failures trigger alerts and retry logic

### Document Browsing (DOCS)

- [ ] **DOCS-01**: User can browse configured Google Drive folders
- [ ] **DOCS-02**: User can search and filter files by name
- [ ] **DOCS-03**: User can view file metadata (name, type, modified date, owner)
- [ ] **DOCS-04**: User can open Google Docs/Sheets/Slides/Drawings in new tab for editing
- [ ] **DOCS-05**: UI displays Google Workspace documents with appropriate icons
- [ ] **DOCS-06**: System excludes non-Google Workspace files from document browser

### Photo Browser (PHOTO)

- [ ] **PHOTO-01**: User can browse Google Photos media items
- [ ] **PHOTO-02**: User can filter by media type (photo only, no videos)
- [ ] **PHOTO-03**: User can view photo thumbnails and metadata
- [ ] **PHOTO-04**: System handles Photos API pagination (media items list)
- [ ] **PHOTO-05**: UI displays albums for organized browsing

### Album Structure (ALBUMS)

- [ ] **ALBUMS-01**: System fetches Google Photos albums structure
- [ ] **ALBUMS-02**: System mirrors albums as R2 folders (e.g., `photos/{albumName}/{filename}`)
- [ ] **ALBUMS-03**: System stores album metadata in D1 for lookup

### Image Import (IMG)

- [ ] **IMG-01**: System lists photos from Google Photos (not Drive images)
- [ ] **IMG-02**: User can select multiple photos for import
- [ ] **IMG-03**: System downloads selected photos from Google Photos API
- [ ] **IMG-04**: System validates images (magic bytes, size limits, format check)
- [ ] **IMG-05**: System uploads valid images to R2 with proper metadata
- [ ] **IMG-06**: System logs import audit trail (who, what, when)
- [ ] **IMG-07**: Import errors display clear messages and retry options

### File Manager (FILES)

- [ ] **FILES-01**: User can manually upload files (PDF, docs, etc.) through dashboard
- [ ] **FILES-02**: User can import files from Google Drive folders
- [ ] **FILES-03**: System validates file types (PDF, DOCX, etc.) and size limits
- [ ] **FILES-04**: System uploads files to R2 with metadata
- [ ] **FILES-05**: Blog editor can select and link to uploaded files
- [ ] **FILES-06**: System generates public download URLs for files
- [ ] **FILES-07**: User can view, search, and delete uploaded files
- [ ] **FILES-08**: System tracks file usage (which posts use which files)

### Photo Upload (UPLOAD)

- [ ] **UPLOAD-01**: User can upload photos through website to Google Photos
- [ ] **UPLOAD-02**: Upload requires write scope (`photoslibrary.edit` or `photoslibrary.appendonly`)
- [ ] **UPLOAD-03**: Upload flow includes file selection, metadata entry (title, description), and album selection

## Out of Scope

| Feature | Reason |
|---------|--------|
| Video import | YouTube already handles video storage |
| Google Docs editing in ARESWEB | Open in Google for editing maintains native experience |
| Real-time sync | Manual import sufficient for team workflow |
| Photo deletion | Admin manages photos in Google Photos |
| File editing | Files are downloaded and edited externally |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 73 | Pending |
| AUTH-02 | Phase 73 | Pending |
| AUTH-03 | Phase 73 | Pending |
| AUTH-04 | Phase 73 | Pending |
| DOCS-01 | Phase 74 | Pending |
| DOCS-02 | Phase 74 | Pending |
| DOCS-03 | Phase 74 | Pending |
| DOCS-04 | Phase 74 | Pending |
| DOCS-05 | Phase 74 | Pending |
| DOCS-06 | Phase 74 | Pending |
| PHOTO-01 | Phase 75 | Pending |
| PHOTO-02 | Phase 75 | Pending |
| PHOTO-03 | Phase 75 | Pending |
| PHOTO-04 | Phase 75 | Pending |
| PHOTO-05 | Phase 75 | Pending |
| UPLOAD-01 | Phase 75 | Pending |
| UPLOAD-02 | Phase 73 | Pending |
| UPLOAD-03 | Phase 75 | Pending |
| ALBUMS-01 | Phase 76 | Pending |
| ALBUMS-02 | Phase 76 | Pending |
| ALBUMS-03 | Phase 76 | Pending |
| IMG-01 | Phase 76 | Pending |
| IMG-02 | Phase 76 | Pending |
| IMG-03 | Phase 76 | Pending |
| IMG-04 | Phase 76 | Pending |
| IMG-05 | Phase 76 | Pending |
| IMG-06 | Phase 76 | Pending |
| IMG-07 | Phase 76 | Pending |
| FILES-01 | Phase 77 | Pending |
| FILES-02 | Phase 77 | Pending |
| FILES-03 | Phase 77 | Pending |
| FILES-04 | Phase 77 | Pending |
| FILES-05 | Phase 77 | Pending |
| FILES-06 | Phase 77 | Pending |
| FILES-07 | Phase 77 | Pending |
| FILES-08 | Phase 77 | Pending |

**Coverage:**
- v8.1 requirements: 36 total
- Mapped to phases: 36
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-12*
*Last updated: 2026-05-12 after milestone v8.1 initialization*
