# Phase 79: Album Database & API - Implementation Plan

## 1. Database Schema (`src/db/schema.ts`)
- [ ] Add `albums` table:
  - `id`: text/UUID (PK)
  - `title`: text (Not Null)
  - `description`: text
  - `coverImageId`: text (references `importedPhotos.id`)
  - `isDeleted`: integer (default 0)
  - `createdAt`: text (timestamp)
  - `updatedAt`: text (timestamp)
  - `createdBy`: text (references `user.id`)
- [ ] Add `albumMedia` table (many-to-many join):
  - `albumId`: text (references `albums.id`)
  - `mediaId`: text (references `importedPhotos.id`)
  - `sortOrder`: integer (default 0)
  - `createdAt`: text (timestamp)
- [ ] Export both tables.

## 2. Drizzle Migrations
- [ ] Generate migration: `pnpm run db:generate`
- [ ] Apply migration: `pnpm run db:migrate`

## 3. API Routes (`src/api/albums.ts`)
- [ ] Set up Hono router with D1 bindings.
- [ ] `GET /api/albums`: List all non-deleted albums (include cover image data).
- [ ] `GET /api/albums/:id`: Get album details.
- [ ] `POST /api/albums`: Create an album (title, description).
- [ ] `PUT /api/albums/:id`: Update album (title, description, coverImageId).
- [ ] `DELETE /api/albums/:id`: Soft delete album (`isDeleted = 1`).

## 4. API Integration (`src/api/index.ts`)
- [ ] Mount `/albums` router in the main Hono app.
