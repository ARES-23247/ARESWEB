# ARESWEB Roadmap

**Current Milestone:** v8.1 Google Workspace Integrations
**Last Updated:** 2026-05-12

---

## Phases

- [ ] **Phase 73: Service Account Authentication** - OAuth tokens for Google Photos and Drive APIs
- [ ] **Phase 74: Google Drive Document Browser** - Browse and open Google Workspace documents
- [ ] **Phase 75: Google Photos Browser** - Browse albums and photos from Google Photos
- [ ] **Phase 76: Image Import Pipeline** - Import photos from Google Photos to R2 storage
- [ ] **Phase 77: File Manager** - Upload and manage PDFs/docs with blog editor integration

---

## Phase Details

### Phase 73: Service Account Authentication

**Goal**: Service account authenticates with Google Photos and Drive APIs with automatic token refresh

**Depends on**: Nothing

**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04

**Success Criteria** (what must be TRUE):
1. Service account can authenticate with Google Photos Library API and Drive API
2. Access tokens refresh automatically before expiration
3. D1 stores OAuth tokens and cached media metadata
4. Token refresh failures trigger alerts and retry logic

**Plans**: TBD

---

### Phase 74: Google Drive Document Browser

**Goal**: Users can browse, search, and open Google Workspace documents from Drive

**Depends on**: Phase 73

**Requirements**: DOCS-01, DOCS-02, DOCS-03, DOCS-04, DOCS-05, DOCS-06

**Success Criteria** (what must be TRUE):
1. User can browse configured Google Drive folders
2. User can search and filter files by name
3. User can view file metadata (name, type, modified date, owner)
4. User can open Google Docs/Sheets/Slides/Drawings in new tab for editing
5. UI displays Google Workspace documents with appropriate icons
6. System excludes non-Google Workspace files from document browser

**Plans**: TBD

**UI hint**: yes

---

### Phase 75: Google Photos Browser

**Goal**: Users can browse Google Photos albums and filter photos by media type

**Depends on**: Phase 73

**Requirements**: PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05

**Success Criteria** (what must be TRUE):
1. User can browse Google Photos media items
2. User can filter by media type (photo only, no videos)
3. User can view photo thumbnails and metadata
4. System handles Photos API pagination (media items list)
5. UI displays albums for organized browsing

**Plans**: TBD

**UI hint**: yes

---

### Phase 76: Image Import Pipeline

**Goal**: Users can select and import photos from Google Photos to R2 storage

**Depends on**: Phase 75

**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, IMG-06, IMG-07

**Success Criteria** (what must be TRUE):
1. System lists photos from Google Photos (not Drive images)
2. User can select multiple photos for import
3. System downloads selected photos from Google Photos API
4. System validates images (magic bytes, size limits, format check)
5. System uploads valid images to R2 with proper metadata
6. System logs import audit trail (who, what, when)
7. Import errors display clear messages and retry options

**Plans**: TBD

**UI hint**: yes

---

### Phase 77: File Manager

**Goal**: Users can upload and manage PDFs/docs with blog editor integration

**Depends on**: Phase 74

**Requirements**: FILES-01, FILES-02, FILES-03, FILES-04, FILES-05, FILES-06, FILES-07, FILES-08

**Success Criteria** (what must be TRUE):
1. User can manually upload files (PDF, docs, etc.) through dashboard
2. User can import files from Google Drive folders
3. System validates file types (PDF, DOCX, etc.) and size limits
4. System uploads files to R2 with metadata
5. Blog editor can select and link to uploaded files
6. System generates public download URLs for files
7. User can view, search, and delete uploaded files
8. System tracks file usage (which posts use which files)

**Plans**: TBD

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 73. Service Account Authentication | 0/4 | Not started | - |
| 74. Google Drive Document Browser | 0/6 | Not started | - |
| 75. Google Photos Browser | 0/5 | Not started | - |
| 76. Image Import Pipeline | 0/7 | Not started | - |
| 77. File Manager | 0/8 | Not started | - |

---

## Milestone v8.1 Summary

**Goal**: Integrate Google Drive API for browsing documents and importing images to R2

**Total Requirements**: 30
- Authentication: 4 requirements
- Document Browsing: 6 requirements
- Photo Browser: 5 requirements
- Image Import: 7 requirements
- File Manager: 8 requirements

**Coverage**: 30/30 requirements mapped ✓

---

*Roadmap created: 2026-05-12*
