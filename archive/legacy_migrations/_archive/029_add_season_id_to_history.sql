-- Migration 029: Add season_id to posts_history

-- RESOLVED: Column already exists in production schema.sql
SELECT 1;
CREATE INDEX IF NOT EXISTS idx_posts_history_season ON posts_history(season_id);