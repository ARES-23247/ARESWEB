DROP TABLE IF EXISTS posts;
CREATE TABLE posts (
    slug TEXT PRIMARY KEY,
    title TEXT,
    date TEXT,
    snippet TEXT,
    thumbnail TEXT,
    author TEXT,
    cf_email TEXT,
    ast TEXT,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published'
);

INSERT INTO posts (slug, title, date, snippet, thumbnail, ast) VALUES (
    'swerve-odometry-optimization',
    'Optimizing Swerve Odometry Paths',
    'March 12, 2026',
    'We overhauled our MARSLib swerve telemetry to prevent thread lock contention on standard loops and ensure maximum determinism.',
    '/news_1.png',
    '[{"type":"paragraph","content":"Welcome to our incredible robotics engineering blog! Building advanced deterministic systems requires precision, dedication, and teamwork."},{"type":"heading","level":2,"content":"The Power of Zero-Allocation Swerve Architecture"},{"type":"paragraph","content":"Last week, we completely overhauled our odometry calculations, mitigating the heap allocation issues that previously caused micro-stutters during high speed execution. By leveraging purely pre-allocated kinematics and direct state injection, our new teleop commands are blazing fast."},{"type":"image","src":"/gallery_1.png","alt":"Robotic Chassis inside our dark lab"},{"type":"heading","level":3,"content":"Final Thoughts"},{"type":"paragraph","content":"Our engineering codebase is strictly deterministic and ready for the championship arena. Stay tuned for more rapid autonomous updates as we approach the PNW District Championship. Support Team ARES 23247!"}]'
);

INSERT INTO posts (slug, title, date, snippet, thumbnail, ast) VALUES (
    'lab-upgrades-complete',
    'Lab Upgrades Complete',
    'March 05, 2026',
    'Our engineers finally integrated the new glowing high-tech robotic arms into our test environment.',
    '/news_2.png',
    '[{"type":"heading","level":2,"content":"Welcoming the New Equipment"},{"type":"paragraph","content":"The lab now features fully integrated industrial robotic manipulator test stands. This provides our CAD team and programmers instant verification mechanisms for their reverse-kinematic code!"},{"type":"image","src":"/gallery_3.png","alt":"Sparking machinery"},{"type":"paragraph","content":"Safety first, but speed close second."}]'
);

DROP TABLE IF EXISTS events;
CREATE TABLE events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date_start TEXT NOT NULL,
    date_end TEXT,
    location TEXT,
    description TEXT,
    cover_image TEXT,
    gcal_event_id TEXT,
    cf_email TEXT,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    category TEXT DEFAULT 'internal',
    is_potluck INTEGER DEFAULT 0,
    is_volunteer INTEGER DEFAULT 0
);

DROP TABLE IF EXISTS docs;
CREATE TABLE docs (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    content TEXT NOT NULL,
    cf_email TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published'
);

CREATE TABLE docs_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT,
    category TEXT,
    description TEXT,
    content TEXT,
    author_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE docs_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    is_helpful INTEGER,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);
CREATE INDEX IF NOT EXISTS idx_docs_history_slug ON docs_history(slug);
CREATE INDEX IF NOT EXISTS idx_docs_feedback_slug ON docs_feedback(slug);

DROP TABLE IF EXISTS settings;
CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);

DROP TABLE IF EXISTS media_tags;
CREATE TABLE media_tags (
    key TEXT PRIMARY KEY,
    folder TEXT DEFAULT 'Library',
    tags TEXT
);

DROP TABLE IF EXISTS user_profiles;
CREATE TABLE user_profiles (
    user_id TEXT PRIMARY KEY,
    first_name TEXT,
    last_name TEXT,
    nickname TEXT,
    phone TEXT,
    contact_email TEXT,
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
    favorite_robot_mechanism TEXT,
    pre_match_superstition TEXT,
    leadership_role TEXT,
    rookie_year TEXT,
    tshirt_size TEXT,
    emergency_contact_name TEXT,
    emergency_contact_phone TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Event Sign-Ups / Potluck / Attendance
CREATE TABLE IF NOT EXISTS event_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    bringing TEXT,
    notes TEXT,
    prep_hours REAL DEFAULT 0,
    attended INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_signups_event ON event_signups(event_id);

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
