-- Badges System
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
