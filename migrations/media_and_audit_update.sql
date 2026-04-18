-- Migration: Media and Audit Consistency Update
-- Description: Adds missing audit columns and the media_tags table.

-- Add missing columns to 'posts'
-- (Note: SQLite handles multiple ALTER TABLE statements separately)
ALTER TABLE posts ADD COLUMN author TEXT;
ALTER TABLE posts ADD COLUMN cf_email TEXT;

-- Add missing columns to 'events'
ALTER TABLE events ADD COLUMN cf_email TEXT;

-- Create the media_tags table for vaulted assets
CREATE TABLE IF NOT EXISTS media_tags (
    key TEXT PRIMARY KEY,
    folder TEXT DEFAULT 'Library',
    tags TEXT
);
