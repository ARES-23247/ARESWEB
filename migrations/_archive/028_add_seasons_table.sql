-- Migration 028: Add seasons table and relationship links

-- Create the central seasons table for the Legacy hub
CREATE TABLE IF NOT EXISTS seasons (
    id TEXT PRIMARY KEY, -- e.g. '2025-2026'
    challenge_name TEXT NOT NULL, -- e.g. 'DECODE'
    robot_name TEXT,
    robot_image TEXT,
    robot_description TEXT, -- JSON AST for rich text
    robot_cad_url TEXT,
    summary TEXT,
    start_date TEXT,
    end_date TEXT,
    status TEXT DEFAULT 'published',
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Add season relationship columns to existing content tables
-- RESOLVED: Columns already exist in production schema.sql
-- This is kept as a no-op so wrangler marks it as applied and proceeds.
SELECT 1;

-- Create indexes for performance filtering
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);
CREATE INDEX IF NOT EXISTS idx_awards_season ON awards(season_id);
CREATE INDEX IF NOT EXISTS idx_outreach_season ON outreach_logs(season_id);
CREATE INDEX IF NOT EXISTS idx_posts_season ON posts(season_id);
