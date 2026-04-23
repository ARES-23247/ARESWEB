-- Migration 029: Add season_id to posts_history

ALTER TABLE posts_history ADD COLUMN season_id TEXT;
CREATE INDEX IF NOT EXISTS idx_posts_history_season ON posts_history(season_id);