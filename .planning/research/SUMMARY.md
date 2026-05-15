# Research: Summary

## Stack Additions
- **Masonry Layout**: Utilize CSS multi-column or CSS Grid (or lightweight `react-photo-album` if complexity demands it) to handle varying aspect ratios.
- **Moving Layout**: Pure CSS `@keyframes` with GPU acceleration (`transform: translate3d`) for infinite scrolling marquees.
- **Database**: Drizzle ORM schemas for `albums` and a join table `album_media`.

## Feature Table Stakes
- Native Album CRUD operations and media linking.
- Google Photo Picker integration for bulk ingestion into local R2-backed `media`.
- Toggleable display views (Masonry vs. Moving).

## Watch Out For
- **Cumulative Layout Shift (CLS)**: Masonry grids require exact aspect ratios. We must ensure the `media` table captures width/height during the Google Photo import to allocate space before the image loads.
- **Domain Leaks**: Ensure Albums only know about local ARESWEB `media` items, not Google Photos directly. The Picker should ingest to `media`, and the `media` joins to the `album`.
