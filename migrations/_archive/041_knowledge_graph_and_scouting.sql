-- Migration 041: Knowledge Graph and Scouting Evolution
-- This migration transforms ARESWEB into a relational knowledge base.

-- 1. Polymorphic Entity Links (The "Knowledge Graph")
CREATE TABLE IF NOT EXISTS entity_links (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL, -- 'doc', 'task', 'event', 'post', 'outreach'
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    link_type TEXT DEFAULT 'reference', -- 'references', 'blocks', 'implements', 'scouted_at'
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(source_type, source_id, target_type, target_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id);

-- 2. Scouting Module (Competition Intelligence)
CREATE TABLE IF NOT EXISTS pit_scouting (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    team_number TEXT NOT NULL,
    team_name TEXT,
    drive_train TEXT,
    scoring_capabilities TEXT, -- JSON or structured text
    notes TEXT,
    image_url TEXT, -- Photo of the robot
    scouted_by TEXT REFERENCES user(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_pit_scouting_event_team ON pit_scouting(event_id, team_number);

CREATE TABLE IF NOT EXISTS match_strategy (
    id TEXT PRIMARY KEY,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    our_role TEXT, -- 'carrier', 'finisher', 'defense'
    partner_team TEXT,
    strategy_notes TEXT,
    post_match_result TEXT, -- JSON with rank/scores
    created_at TEXT DEFAULT (datetime('now'))
);

-- 3. Strategic Goals (Connect & Impact Award KPIs)
CREATE TABLE IF NOT EXISTS season_goals (
    id TEXT PRIMARY KEY,
    season_id INTEGER NOT NULL REFERENCES seasons(start_year) ON DELETE CASCADE,
    category TEXT NOT NULL, -- 'outreach_hours', 'mentoring_teams', 'fundraising_total'
    target_value REAL NOT NULL,
    current_value REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_season_goals_lookup ON season_goals(season_id, category);
