-- User Profiles Extension
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY,
    nickname TEXT,
    phone TEXT,
    show_email INTEGER DEFAULT 0,
    show_phone INTEGER DEFAULT 0,
    pronouns TEXT,
    grade_year TEXT,
    subteams TEXT DEFAULT '[]',
    member_type TEXT DEFAULT 'student',
    bio TEXT,
    favorite_food TEXT,
    dietary_restrictions TEXT,
    favorite_first_thing TEXT,
    fun_fact TEXT,
    colleges TEXT DEFAULT '[]',
    employers TEXT DEFAULT '[]',
    show_on_about INTEGER DEFAULT 1,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Comments
CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);

-- Event Sign-Ups / Potluck
CREATE TABLE IF NOT EXISTS event_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    bringing TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_signups_event ON event_signups(event_id);
