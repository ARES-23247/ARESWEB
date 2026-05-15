# Requirements: Milestone v8.2 Native Photo Albums

## Active Requirements

### Album Core & Media
- [ ] **ALBUM-01**: Author can create, rename, update descriptions, and delete custom Albums.
- [ ] **ALBUM-02**: Author can link and unlink existing `media` records to an Album, defining a custom sort order.
- [ ] **ALBUM-03**: Author can bulk ingest photos via the Google Photo Picker, automatically creating local `media` records and linking them to the target Album.

### Dynamic Display Views
- [ ] **DISP-01**: Author can configure an Album's default display layout as either `masonry` or `moving`.
- [ ] **DISP-02**: System renders the Masonry layout dynamically, preventing layout shift by pre-allocating grid space using the stored aspect ratios of the `media` records.
- [ ] **DISP-03**: System renders the Moving layout as a seamless, GPU-accelerated infinite scrolling marquee.

## Future Requirements
- **FUT-01**: User-facing public gallery browsing with album categories.
- **FUT-02**: Video support inside moving carousels.

## Out of Scope
- Direct API coupling where the album reads dynamically from Google Photos. (Rationale: Albums must be deterministically backed by local R2 `media` records to prevent performance degradation and API quota limits).

## Traceability

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| ALBUM-01 | | Author can create, rename, update descriptions, and delete custom Albums. | pending | |
| ALBUM-02 | | Author can link and unlink existing media records to an Album. | pending | |
| ALBUM-03 | | Author can bulk ingest photos via the Google Photo Picker. | pending | |
| DISP-01 | | Author can configure an Album's default display layout. | pending | |
| DISP-02 | | System renders the Masonry layout dynamically. | pending | |
| DISP-03 | | System renders the Moving layout as a seamless marquee. | pending | |
