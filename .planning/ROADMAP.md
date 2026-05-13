# ARESWEB Roadmap

**Current Milestone:** v8.1 Google Workspace Integrations
**Last Updated:** 2026-05-13

---

## Phases

- [x] **Phase 73: Service Account Authentication** - OAuth tokens for Google Photos and Drive APIs ✅
- [x] **Phase 74: Google Drive Document Browser** - Browse and open Google Workspace documents ✅
- [ ] **Phase 75: Google Photos Browser** - Browse albums and photos from Google Photos
- [ ] **Phase 76: Image Import Pipeline** - Import photos from Google Photos to R2 storage
- [ ] **Phase 77: File Manager** - Upload and manage PDFs/docs with blog editor integration
- [ ] **Phase 78: Onshape CAD Integration** - Browse CAD models, export STL/STEP files, and sync BOM data

---

## Phase Details

### Phase 73: Service Account Authentication

**Goal**: Service account authenticates with Google Photos and Drive APIs with automatic token refresh

**Depends on**: Nothing

**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04, UPLOAD-02

**Success Criteria** (what must be TRUE):
1. Service account can authenticate with Google Photos Library API and Drive API
2. Access tokens refresh automatically before expiration
3. D1 stores OAuth tokens and cached media metadata
4. Token refresh failures trigger alerts and retry logic
5. Service account has write scope for Google Photos upload (`photoslibrary.edit` or `photoslibrary.appendonly`)

**Plans**: 3 plans (all complete ✅)

**Plan List**:
- [x] 73-01-PLAN.md — Extend JWT scope for Photos and Drive APIs ✅
- [x] 73-02-PLAN.md — Create token management utilities with lazy refresh ✅
- [x] 73-03-PLAN.md — Create Photos and Drive API routers with health checks ✅

**Completed:** 2026-05-12

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

**Plans**: 4 plans (all complete ✅)

**Plan List**:
- [x] 74-01-PLAN.md — Create OpenAPI route contracts for Drive files endpoint ✅
- [x] 74-02-PLAN.md — Implement GET /files endpoint with TDD ✅
- [x] 74-03-PLAN.md — Create frontend React Query hooks ✅
- [x] 74-04-PLAN.md — Build dashboard UI with search and file table ✅

**Completed:** 2026-05-13

**UI hint**: yes ✅

---

### Phase 75: Google Photos Browser

**Goal**: Users can browse Google Photos albums and filter photos by media type, with upload capability

**Depends on**: Phase 73

**Requirements**: PHOTO-01, PHOTO-02, PHOTO-03, PHOTO-04, PHOTO-05, UPLOAD-01, UPLOAD-03

**Success Criteria** (what must be TRUE):
1. User can browse Google Photos media items
2. User can filter by media type (photo only, no videos)
3. User can view photo thumbnails and metadata
4. System handles Photos API pagination (media items list)
5. UI displays albums for organized browsing
6. User can upload photos through website to Google Photos
7. Upload flow includes file selection, metadata entry (title, description), and album selection

**Plans**: 7 plans

**Plan List**:
- [ ] 75-01-PLAN.md — Create OpenAPI route contracts for Photos API endpoints
- [ ] 75-02-PLAN.md — Implement GET /media endpoint with TDD
- [ ] 75-03-PLAN.md — Implement GET /albums endpoint with TDD
- [ ] 75-04-PLAN.md — Create frontend React Query hooks
- [ ] 75-05-PLAN.md — Implement POST /upload endpoint with TDD
- [ ] 75-06-PLAN.md — Create frontend upload mutation
- [ ] 75-07-PLAN.md — Build dashboard UI with albums sidebar and photo grid

**UI hint**: yes

---

### Phase 76: Image Import Pipeline

**Goal**: Users can select and import photos from Google Photos to R2 storage with album structure preservation

**Depends on**: Phase 75

**Requirements**: IMG-01, IMG-02, IMG-03, IMG-04, IMG-05, IMG-06, IMG-07, ALBUMS-01, ALBUMS-02, ALBUMS-03

**Success Criteria** (what must be TRUE):
1. System lists photos from Google Photos (not Drive images)
2. User can select multiple photos for import
3. System downloads selected photos from Google Photos API
4. System validates images (magic bytes, size limits, format check)
5. System uploads valid images to R2 with proper metadata
6. System logs import audit trail (who, what, when)
7. Import errors display clear messages and retry options
8. System fetches Google Photos albums structure
9. System mirrors albums as R2 folders (e.g., `photos/{albumName}/{filename}`)
10. System stores album metadata in D1 for lookup

**Plans**: 4 plans

**Plan List**:
- [ ] 76-01-PLAN.md — Define database schema and API contracts
- [ ] 76-02-PLAN.md — Implement import pipeline with TDD
- [ ] 76-03-PLAN.md — Build photo selection UI
- [ ] 76-04-PLAN.md — Connect import mutation with error handling

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

### Phase 78: Onshape CAD Integration

**Goal**: Enable browsing Onshape CAD models, exporting STL/STEP files, and synchronizing Bill of Materials data

**Depends on**: Phase 73 (OAuth token pattern reference)

**Requirements**: ONSHAPE-01, ONSHAPE-02, ONSHAPE-03, ONSHAPE-04, ONSHAPE-05, ONSHAPE-06, ONSHAPE-07, ONSHAPE-08, ONSHAPE-09, ONSHAPE-10, ONSHAPE-11, ONSHAPE-12

**Success Criteria** (what must be TRUE):
1. User can authenticate with Onshape via OAuth2 flow
2. User can browse their Onshape documents through the web portal
3. Public CAD documents accessible to all visitors (no authentication)
4. Private documents require user OAuth token to access
5. User can export parts to STL format for 3D printing
6. User can export assemblies to STEP format for manufacturing
7. User can view Bill of Materials for assemblies
8. BOM includes part names, quantities, and materials
9. BOM sync history is tracked in database
10. Zero Trust compliance: all API calls proxied through backend

**Plans**: 4 plans

**Plan List**:
- [ ] 78-01-PLAN.md — OAuth2 authentication and D1 schema setup
- [ ] 78-02-PLAN.md — Document browsing and display UI
- [ ] 78-03-PLAN.md — STL/STEP export functionality
- [ ] 78-04-PLAN.md — Bill of Materials synchronization

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 73. Service Account Authentication | 3/3 | Complete ✅ | 2026-05-12 |
| 74. Google Drive Document Browser | 4/4 | Complete ✅ | 2026-05-13 |
| 75. Google Photos Browser | 1/7 | In Progress|  |
| 76. Image Import Pipeline | 0/4 | Not started | - |
| 77. File Manager | 0/8 | Not started | - |
| 78. Onshape CAD Integration | 0/4 | Not started | - |

---

## Milestone v8.1 Summary

**Goal**: Integrate Google Drive API for browsing documents and importing images to R2, with Google Photos upload capability

**Total Requirements**: 36
- Authentication: 5 requirements (includes UPLOAD-02 for write scope)
- Document Browsing: 6 requirements
- Photo Browser: 7 requirements (includes upload features)
- Image Import: 10 requirements (includes album structure preservation)
- File Manager: 8 requirements

**Coverage**: 36/36 requirements mapped ✓

---
*Roadmap created: 2026-05-12*
*Last updated: 2026-05-13 (Phase 76: Image Import Pipeline plans created)*

---

## Backlog

### Phase 999.1: Embedded Robot Telemetry (AdvantageScope Web) (BACKLOG)
**Goal:** [Captured for future planning] Embed AdvantageScope viewer for reviewing robot `.wpilog` pathing and telemetry in-browser
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.2: Live Scouting & Pick-List Engine (PWA) (BACKLOG)
**Goal:** [Captured for future planning] Touch-optimized PWA scouting module with Statbotics integration and auto-generated pick lists
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.3: Inventory & CAD BOM Synchronization (BACKLOG)
**Goal:** [Captured for future planning] Sync Onshape API BOMs and use barcode scanning for inventory checkouts
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.4: Sponsor ROI & Parent Portals (BACKLOG)
**Goal:** [Captured for future planning] Dedicated portals for sponsors (ROI reports) and parents (YPP consent, itineraries)
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.5: Gamification & Progression System (BACKLOG)
**Goal:** [Captured for future planning] XP economy based on ARESWEB contributions to unlock Discord roles and themes
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.6: AI-Assisted Impact Award Drafter (BACKLOG)
**Goal:** [Captured for future planning] Scan team history and draft FIRST Impact Award essays meeting rubric criteria
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)

### Phase 999.7: Embedded FFmpeg Web Video Trimmer (BACKLOG)
**Goal:** [Captured for future planning] Implement a client-side Wasm video trimmer with COOP/COEP isolation for fast local clipping
**Requirements:** TBD
**Plans:** 0 plans
- [ ] TBD (promote with /gsd-review-backlog when ready)
