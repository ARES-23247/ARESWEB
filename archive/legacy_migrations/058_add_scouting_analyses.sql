-- Migration: 058_add_scouting_analyses
-- Description: Creates a table to persist AI scouting analyses so they can be retrieved instantly.

CREATE TABLE IF NOT EXISTS scouting_analyses (
    id TEXT PRIMARY KEY,
    mode TEXT NOT NULL,
    team_number INTEGER,
    event_key TEXT,
    season_key TEXT NOT NULL,
    markdown TEXT NOT NULL,
    model TEXT NOT NULL,
    tokens_used INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scouting_analyses_team ON scouting_analyses(team_number);
CREATE INDEX IF NOT EXISTS idx_scouting_analyses_event ON scouting_analyses(event_key);
