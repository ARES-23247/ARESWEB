# Roadmap

## Phase 79: Album Database & API ✅
**Goal**: Establish the D1 schema and Hono API handlers for the core Album entity.
**Requirements**: ALBUM-01
**Status**: Complete

**Success Criteria**:
1. ✅ Author can create a new Album and provide a title and description.
2. ✅ Author can rename or update an existing Album's metadata.
3. ✅ Author can delete an Album and it unlinks associated media.

## Phase 80: Media Association & Ingestion ✅
**Goal**: Build the bridging layer between local R2 `media` records, Google Photos ingestion, and the Album object.
**Requirements**: ALBUM-02, ALBUM-03
**Status**: Complete

**Success Criteria**:
1. ✅ Author can select local media from the Media Manager and link it to an Album.
2. ✅ Author can define a custom sort order for media within an Album.
3. ✅ Author can use the Google Photo Picker directly inside the Album context to bulk-ingest photos, automatically generating `media` records and linking them.
4. ✅ Ingestion process deduplicates media; if a photo already exists in R2/`media` table, it is linked to the Album without redundant storage.

## Phase 81: Dynamic Display Layouts ✅
**Goal**: Develop the frontend gallery view supporting responsive Masonry and GPU-accelerated Moving modes.
**Requirements**: DISP-01, DISP-02, DISP-03
**Status**: Complete

**Success Criteria**:
1. ✅ Author can toggle an Album's default display mode in the Admin settings.
2. ✅ The Masonry layout renders seamlessly without layout shift by consuming pre-calculated grid dimensions.
3. ✅ The Moving layout renders an infinite, horizontally scrolling carousel using CSS `translate3d`.

## Phase 82: Tournaments and Robot Pages ✅
**Goal**: Implement Tournaments and Robot Pages entities to manage FTC events, robot specifications, matches, and awards.
**Requirements**: TOURN-01, ROBOT-01
**Depends on**: Phase 81
**Status**: Complete

**Success Criteria**:
1. ✅ Admin can create/edit/delete robots with specs, Tiptap body, album, CAD links, and reveal video.
2. ✅ Admin can create/edit/delete tournaments with Tiptap body, album, FTC Event Code, and performance metrics.
3. ✅ Admin can sync match data from the FTC Events API and link YouTube match videos.
4. ✅ Public `/robots` and `/robots/:id` pages display robot gallery and detail views.
5. ✅ Public `/tournaments` and `/tournaments/:id` pages display tournament gallery and detail views with match schedule.
6. ✅ `tsc --noEmit` passes with 0 errors. ESLint passes with 0 errors on all new files.

## Backlog
*(Future phases or deferred items will be documented here)*

### Phase 83: Tournament Awards Integration
**Goal**: Link existing awards database to tournament pages and build award management sub-forms.
**Requirements**: TBD
**Depends on**: Phase 82

### Phase 84: Robot Version Tracking
**Goal**: Support multiple versions of a robot within a season (e.g., "Phobos 1.0", "Phobos 1.1").
**Requirements**: TBD
**Depends on**: Phase 82

### Phase 85: Match Video Discovery
**Goal**: Add YouTube match video search/linking UI in the tournament match detail view.
**Requirements**: TBD
**Depends on**: Phase 82
