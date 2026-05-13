-- Phase 76: Image Import Pipeline - Import Tracking Tables
-- These tables track imported photos from Google Photos to R2 storage
-- and maintain an audit trail per D-16/D-17

-- Photo albums for Google Photos import (per D-15)
-- Stores album metadata for R2 folder mapping
CREATE TABLE IF NOT EXISTS photo_albums (
  id TEXT PRIMARY KEY,
  google_album_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  r2_folder TEXT NOT NULL,
  synced_at TEXT NOT NULL,
  media_items_count TEXT
);

CREATE INDEX IF NOT EXISTS idx_photo_albums_google_id ON photo_albums(google_album_id);

-- Imported photos from Google Photos to R2 (per D-14)
-- Tracks successfully imported photos with R2 storage key
CREATE TABLE IF NOT EXISTS imported_photos (
  id TEXT PRIMARY KEY,
  r2_key TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  google_media_item_id TEXT NOT NULL UNIQUE,
  album_id TEXT REFERENCES photo_albums(id),
  imported_by TEXT NOT NULL,
  imported_at TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_imported_photos_google_id ON imported_photos(google_media_item_id);
CREATE INDEX IF NOT EXISTS idx_imported_photos_album ON imported_photos(album_id);

-- Import audit log for all photo import attempts (per D-16/D-17)
-- Maintains audit trail for all import attempts (success and failure)
CREATE TABLE IF NOT EXISTS import_audit_log (
  id TEXT PRIMARY KEY,
  media_item_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  status TEXT NOT NULL, -- 'success' or 'failed'
  error TEXT,
  r2_key TEXT,
  imported_by TEXT NOT NULL,
  imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_import_audit_imported_at ON import_audit_log(imported_at);
