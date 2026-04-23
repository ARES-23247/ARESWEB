-- ── Platform Settings ──────────────────────────────────────────────────────
-- ── Better Auth Core Tables ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified BOOLEAN NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    role TEXT DEFAULT 'user',
    twoFactorEnabled INTEGER DEFAULT 0,
    twoFactorSecret TEXT,
    twoFactorBackupCodes TEXT
);
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
);


-- ── Content: Blog Posts ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS posts (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT,
    snippet TEXT,
    thumbnail TEXT,
    author TEXT,
    cf_email TEXT,
    ast TEXT NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    revision_of TEXT,
    published_at TEXT,
    is_portfolio INTEGER DEFAULT 0,
    season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_season ON posts(season_id);
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, is_deleted);

CREATE TABLE IF NOT EXISTS posts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    author TEXT,
    thumbnail TEXT,
    snippet TEXT,
    ast TEXT NOT NULL,
    author_email TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_history_slug ON posts_history(slug);
CREATE INDEX IF NOT EXISTS idx_posts_history_season ON posts_history(season_id);


-- ── Content: Events ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date_start TEXT NOT NULL,
    date_end TEXT,
    location TEXT,
    description TEXT,
    cover_image TEXT,
    gcal_event_id TEXT,
    tba_event_key TEXT,
    cf_email TEXT,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    category TEXT DEFAULT 'internal',
    is_potluck INTEGER DEFAULT 0,
    is_volunteer INTEGER DEFAULT 0,
    revision_of TEXT,
    published_at TEXT,
    season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);

-- ── Seasons ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS seasons (
    start_year INTEGER PRIMARY KEY, -- e.g. 2025
    end_year INTEGER, -- e.g. 2026
    challenge_name TEXT NOT NULL, -- e.g. 'INTO THE DEEP'
    robot_name TEXT,
    robot_image TEXT,
    robot_description TEXT, -- JSON AST for rich text
    robot_cad_url TEXT,
    summary TEXT,
    album_url TEXT,
    album_cover TEXT,
    status TEXT DEFAULT 'published',
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date_start);

CREATE TABLE IF NOT EXISTS event_signups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    bringing TEXT,
    notes TEXT,
    prep_hours REAL DEFAULT 0,
    attended INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(event_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_signups_event ON event_signups(event_id);
CREATE INDEX IF NOT EXISTS idx_signups_user ON event_signups(user_id);


-- ── Content: Documentation ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS docs (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    content TEXT NOT NULL,
    cf_email TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    is_portfolio INTEGER DEFAULT 0,
    is_executive_summary INTEGER DEFAULT 0,
    revision_of TEXT
);
CREATE INDEX IF NOT EXISTS idx_docs_category ON docs(category);

CREATE TABLE IF NOT EXISTS docs_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT,
    category TEXT,
    description TEXT,
    content TEXT,
    author_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_history_slug ON docs_history(slug);

CREATE TABLE IF NOT EXISTS docs_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL REFERENCES docs(slug) ON DELETE CASCADE,
    is_helpful INTEGER,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_feedback_slug ON docs_feedback(slug);


-- ── User Profiles ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_profiles (
    user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
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
    parents_name TEXT,
    parents_email TEXT,
    students_name TEXT,
    students_email TEXT,
    updated_at TEXT DEFAULT (datetime('now'))
);


-- ── Gamification: Badges ─────────────────────────────────────────────────

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
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    badge_id TEXT NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
    awarded_by TEXT,
    awarded_at TEXT DEFAULT (datetime('now')),
    UNIQUE(user_id, badge_id)
);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);


-- ── Sponsors ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sponsors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL,
    logo_url TEXT,
    website_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sponsor_metrics (
    id TEXT PRIMARY KEY,
    sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    year_month TEXT NOT NULL,
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(sponsor_id, year_month)
);
CREATE INDEX IF NOT EXISTS idx_sponsor_metrics_sponsor ON sponsor_metrics(sponsor_id);

CREATE TABLE IF NOT EXISTS sponsor_tokens (
    token TEXT PRIMARY KEY,
    sponsor_id TEXT NOT NULL REFERENCES sponsors(id) ON DELETE CASCADE,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsor_tokens_sponsor ON sponsor_tokens(sponsor_id);


-- ── Inquiries (Contact Form) ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    metadata TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);


-- ── Locations ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    maps_url TEXT,
    is_deleted INTEGER DEFAULT 0
);


-- ── Awards ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    icon_type TEXT DEFAULT 'trophy',
    is_deleted INTEGER DEFAULT 0,
    season_id TEXT REFERENCES seasons(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_awards_season ON awards(season_id);

CREATE INDEX IF NOT EXISTS idx_awards_date ON awards(date);


-- ── Outreach ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS outreach_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT,
    hours INTEGER,
    people_reached INTEGER,
    students_count INTEGER DEFAULT 0,
    impact_summary TEXT,
    cf_email TEXT,
    is_deleted INTEGER DEFAULT 0,
    season_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_outreach_season ON outreach_logs(season_id);

CREATE INDEX IF NOT EXISTS idx_outreach_date ON outreach_logs(date);


-- ── Comments ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    zulip_message_id TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);


-- ── Notifications ────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    priority TEXT DEFAULT 'low',
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);


-- ── Analytics ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS page_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    category TEXT DEFAULT 'system',
    referrer TEXT,
    user_agent TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_page_analytics_path ON page_analytics(path);
CREATE INDEX IF NOT EXISTS idx_page_analytics_timestamp ON page_analytics(timestamp);


-- ── Media ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS media_tags (
    key TEXT PRIMARY KEY,
    folder TEXT DEFAULT 'Library',
    tags TEXT
);


-- ── Platform Settings ────────────────────────────────────────────────────

-- ── Judge Access Codes ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS judge_access_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    label TEXT DEFAULT 'Judge Access',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_judge_codes_code ON judge_access_codes(code);


CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now'))
);


-- ── Audit Log ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
    id TEXT PRIMARY KEY,
    actor TEXT NOT NULL,
    action TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT,
    details TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_audit_log_actor ON audit_log(actor);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);


-- ── Full-Text Search (FTS5) Virtual Tables + Sync Triggers ───────────────

CREATE VIRTUAL TABLE IF NOT EXISTS docs_fts USING fts5(
    slug UNINDEXED, title, category, description, content,
    status UNINDEXED, is_deleted UNINDEXED
);

CREATE TRIGGER IF NOT EXISTS docs_fts_insert AFTER INSERT ON docs BEGIN
    INSERT INTO docs_fts (slug, title, category, description, content, status, is_deleted)
    VALUES (new.slug, new.title, new.category, new.description, new.content, new.status, new.is_deleted);
END;

CREATE TRIGGER IF NOT EXISTS docs_fts_delete AFTER DELETE ON docs BEGIN
    DELETE FROM docs_fts WHERE slug = old.slug;
END;

CREATE TRIGGER IF NOT EXISTS docs_fts_update AFTER UPDATE ON docs BEGIN
    DELETE FROM docs_fts WHERE slug = old.slug;
    INSERT INTO docs_fts (slug, title, category, description, content, status, is_deleted)
    VALUES (new.slug, new.title, new.category, new.description, new.content, new.status, new.is_deleted);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
    slug UNINDEXED, title, snippet, author, ast
);

CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts (slug, title, snippet, author, ast)
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast);
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
    INSERT INTO posts_fts (slug, title, snippet, author, ast)
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
    id UNINDEXED, title, description, location,
    status UNINDEXED, is_deleted UNINDEXED
);

CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
    INSERT INTO events_fts (id, title, description, location, status, is_deleted)
    VALUES (new.id, new.title, new.description, new.location, new.status, new.is_deleted);
END;

CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
    DELETE FROM events_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
    DELETE FROM events_fts WHERE id = old.id;
    INSERT INTO events_fts (id, title, description, location, status, is_deleted)
    VALUES (new.id, new.title, new.description, new.location, new.status, new.is_deleted);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS user_profiles_fts USING fts5(
    user_id UNINDEXED, nickname, first_name, last_name, bio,
    show_on_about UNINDEXED
);

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_insert AFTER INSERT ON user_profiles BEGIN
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about)
    SELECT new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about
    WHERE new.show_on_about = 1;
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_delete AFTER DELETE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_update AFTER UPDATE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about)
    SELECT new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about
    WHERE new.show_on_about = 1;
END;


-- -- Rate Limits ---------------------------------------------------------

CREATE TABLE IF NOT EXISTS rate_limits (
    ip TEXT PRIMARY KEY, 
    count INTEGER NOT NULL, 
    expires_at INTEGER NOT NULL
);

-- -- Missing Indexes from Migrations --------------------------------------

CREATE INDEX IF NOT EXISTS idx_events_visibility ON events(is_deleted, status, published_at, date_start);
CREATE INDEX IF NOT EXISTS idx_events_category ON events(category);
CREATE INDEX IF NOT EXISTS idx_user_profiles_member_type ON user_profiles(member_type);
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
CREATE INDEX IF NOT EXISTS idx_docs_status_deleted ON docs(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);

