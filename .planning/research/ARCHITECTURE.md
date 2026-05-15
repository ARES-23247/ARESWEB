# Research: Architecture

## Database Schema (Drizzle + D1)
- `albums` table: `id`, `title`, `description`, `cover_media_id` (FK to media), `created_at`
- `album_media` join table: `album_id`, `media_id`, `sort_order`

## API Routes
- `POST /api/albums`: Create album
- `GET /api/albums/:id`: Fetch album and joined media
- `POST /api/albums/:id/media`: Bulk link media IDs

## Frontend Components
- `AlbumGallery`: Container component with layout switching prop.
- `MasonryLayout`: Relies on `aspect_ratio` from DB to prevent layout shift.
- `MovingLayout`: Uses CSS animation (`translate3d`) for an infinite marquee.
