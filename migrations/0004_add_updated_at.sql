-- Migration: Add updated_at columns to events and posts tables
-- Required for incremental RAG indexing (TD-03)
-- D1 does not support triggers, so updated_at must be set explicitly in application code.
-- idempotent: tracked in d1_migrations table, won't re-execute

ALTER TABLE events ADD COLUMN updated_at TEXT DEFAULT NULL;
ALTER TABLE posts ADD COLUMN updated_at TEXT DEFAULT NULL;

-- Backfill: set updated_at to published_at (or current time) for existing rows
UPDATE events SET updated_at = COALESCE(published_at, datetime('now')) WHERE updated_at IS NULL;
UPDATE posts SET updated_at = COALESCE(published_at, datetime('now')) WHERE updated_at IS NULL;
