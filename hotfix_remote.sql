-- Add missing columns to Events
ALTER TABLE events ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE events ADD COLUMN is_potluck INTEGER DEFAULT 0;
ALTER TABLE events ADD COLUMN is_volunteer INTEGER DEFAULT 0;

-- Add missing columns to Docs
ALTER TABLE docs ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE docs ADD COLUMN is_portfolio INTEGER DEFAULT 0;
ALTER TABLE docs ADD COLUMN is_executive_summary INTEGER DEFAULT 0;
ALTER TABLE docs ADD COLUMN cf_email TEXT;

-- Add missing columns to Posts
ALTER TABLE posts ADD COLUMN status TEXT DEFAULT 'published';
ALTER TABLE posts ADD COLUMN is_portfolio INTEGER DEFAULT 0;

-- Add missing columns to Event Sign-Ups
ALTER TABLE event_signups ADD COLUMN prep_hours REAL DEFAULT 0;
ALTER TABLE event_signups ADD COLUMN attended INTEGER DEFAULT 0;

-- Create Badges tables
CREATE TABLE IF NOT EXISTS badges (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    icon TEXT DEFAULT 'Award',
    color_theme TEXT DEFAULT 'ares-gold',
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    badge_id TEXT NOT NULL,
    awarded_by TEXT,
    awarded_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES user_profiles(user_id) ON DELETE CASCADE,
    FOREIGN KEY(badge_id) REFERENCES badges(id) ON DELETE CASCADE,
    UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- Create Inquiries table
CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    assigned_to TEXT,
    metadata TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
