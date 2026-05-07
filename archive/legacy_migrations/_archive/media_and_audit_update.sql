-- Migration: Media consistency update (Refined)
-- Description: Initializes the missing media_tags table. Tracking columns like author/cf_email are already present in this environment.

CREATE TABLE IF NOT EXISTS media_tags (
    key TEXT PRIMARY KEY,
    folder TEXT DEFAULT 'Library',
    tags TEXT
);
