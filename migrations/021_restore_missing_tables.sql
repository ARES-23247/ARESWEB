-- 021_restore_missing_tables.sql
-- Restores tables found in live database but missing from migrations/schema

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    zulip_message_id TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);

CREATE TABLE IF NOT EXISTS outreach_logs (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT,
    hours REAL DEFAULT 0,
    people_reached INTEGER DEFAULT 0,
    students_count INTEGER DEFAULT 0,
    impact_summary TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS page_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL UNIQUE,
    views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    last_updated TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_page_analytics_path ON page_analytics(path);

CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    icon_type TEXT DEFAULT 'trophy',
    created_at TEXT DEFAULT (datetime('now'))
);
