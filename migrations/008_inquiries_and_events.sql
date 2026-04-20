-- Migration 008: Add inquiries table and event flags

ALTER TABLE events ADD COLUMN is_potluck INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN is_volunteer INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- 'student', 'mentor', 'sponsor'
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    metadata TEXT, -- JSON for school, grade, occupation, interests, tiers, etc
    status TEXT DEFAULT 'pending', -- 'pending', 'contacted', 'resolved'
    created_at TEXT DEFAULT (datetime('now'))
);
