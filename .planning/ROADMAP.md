# Roadmap

## Phase 79: Album Database & API
**Goal**: Establish the D1 schema and Hono API handlers for the core Album entity.
**Requirements**: ALBUM-01

**Success Criteria**:
1. Author can create a new Album and provide a title and description.
2. Author can rename or update an existing Album's metadata.
3. Author can delete an Album and it unlinks associated media.

## Phase 80: Media Association & Ingestion
**Goal**: Build the bridging layer between local R2 `media` records, Google Photos ingestion, and the Album object.
**Requirements**: ALBUM-02, ALBUM-03

**Success Criteria**:
1. Author can select local media from the Media Manager and link it to an Album.
2. Author can define a custom sort order for media within an Album.
3. Author can use the Google Photo Picker directly inside the Album context to bulk-ingest photos, automatically generating `media` records and linking them.
4. Ingestion process deduplicates media; if a photo already exists in R2/`media` table, it is linked to the Album without redundant storage.

## Phase 81: Dynamic Display Layouts
**Goal**: Develop the frontend gallery view supporting responsive Masonry and GPU-accelerated Moving modes.
**Requirements**: DISP-01, DISP-02, DISP-03

**Success Criteria**:
1. Author can toggle an Album's default display mode in the Admin settings.
2. The Masonry layout renders seamlessly without layout shift by consuming pre-calculated grid dimensions.
3. The Moving layout renders an infinite, horizontally scrolling carousel using CSS `translate3d`.

## Backlog
*(Future phases or deferred items will be documented here)*

### Phase 82: Tournaments and Robot Pages

**Goal:** [To be planned]
**Requirements**: TBD
**Depends on:** Phase 81
**Plans:** 0 plans

Plans:
- [ ] TBD (run /gsd-plan-phase 82 to break down)
