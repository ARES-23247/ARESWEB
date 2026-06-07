-- â”€â”€ Platform Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
-- â”€â”€ Better Auth Core Tables â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Content: Blog Posts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS posts (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date TEXT,
    snippet TEXT,
    thumbnail TEXT,
    author TEXT,
    cf_email TEXT,
    ast TEXT NOT NULL,
    content_draft TEXT,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    revision_of TEXT,
    published_at TEXT,
    is_portfolio INTEGER DEFAULT 0,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,


    updated_at TEXT DEFAULT (datetime('now'))
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
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_history_slug ON posts_history(slug);
CREATE INDEX IF NOT EXISTS idx_posts_history_season ON posts_history(season_id);


-- â”€â”€ Content: Events â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS events (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date_start TEXT NOT NULL,
    date_end TEXT,
    location TEXT,
    description TEXT,
    content_draft TEXT,
    cover_image TEXT,
    gcal_event_id TEXT,
    tba_event_key TEXT,
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    category TEXT DEFAULT 'internal',
    is_potluck INTEGER DEFAULT 0,
    is_volunteer INTEGER DEFAULT 0,
    revision_of TEXT,
    published_at TEXT,
    meeting_notes TEXT,
    recurring_group_id TEXT,
    rrule TEXT,
    recurring_exception INTEGER DEFAULT 0,
    zulip_stream TEXT,
    zulip_topic TEXT,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_events_season ON events(season_id);

-- â”€â”€ Seasons â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Content: Documentation â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS docs (
    slug TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    description TEXT,
    content TEXT NOT NULL,
    content_draft TEXT,
    cf_email TEXT,
    updated_at TEXT DEFAULT (datetime('now')),
    is_deleted INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published',
    is_portfolio INTEGER DEFAULT 0,
    is_executive_summary INTEGER DEFAULT 0,
    display_in_areslib INTEGER DEFAULT 0,
    display_in_math_corner INTEGER DEFAULT 0,
    display_in_science_corner INTEGER DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS document_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    content TEXT NOT NULL,
    created_by TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS document_contributors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    user_name TEXT NOT NULL,
    user_avatar TEXT,
    last_contributed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_document_history_room ON document_history(room_id);

CREATE TABLE IF NOT EXISTS docs_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL REFERENCES docs(slug) ON DELETE CASCADE,
    is_helpful INTEGER,
    comment TEXT,
    is_resolved INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_docs_feedback_slug ON docs_feedback(slug);


-- â”€â”€ User Profiles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    hours INTEGER DEFAULT 0 NOT NULL,
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


-- â”€â”€ Gamification: Badges â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Sponsors â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Inquiries (Contact Form) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS inquiries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    metadata TEXT,
    status TEXT DEFAULT 'pending',
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    zulip_message_id TEXT,
    notes TEXT
);
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);


-- â”€â”€ Locations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    maps_url TEXT,
    is_deleted INTEGER DEFAULT 0
);


-- â”€â”€ Awards â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    icon_type TEXT DEFAULT 'trophy',
    is_deleted INTEGER DEFAULT 0,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_awards_season ON awards(season_id);

CREATE INDEX IF NOT EXISTS idx_awards_date ON awards(date);


-- â”€â”€ Outreach â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
    is_mentoring INTEGER DEFAULT 0,
    mentored_team_number TEXT,
    metadata TEXT,
    is_deleted INTEGER DEFAULT 0,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_outreach_season ON outreach_logs(season_id);

CREATE INDEX IF NOT EXISTS idx_outreach_date ON outreach_logs(date);


-- â”€â”€ Comments â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Notifications â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

CREATE TABLE IF NOT EXISTS points_ledger (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    points_delta INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_by TEXT REFERENCES user(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_points_ledger_user ON points_ledger(user_id);


-- â”€â”€ Analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
CREATE INDEX IF NOT EXISTS idx_analytics_path_time ON page_analytics(path, timestamp);


-- â”€â”€ Media â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS media_tags (
    key TEXT PRIMARY KEY,
    folder TEXT DEFAULT 'Library',
    tags TEXT
);


-- â”€â”€ Platform Settings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

-- â”€â”€ Judge Access Codes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Tasks (Native Kanban Board) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'normal',
    subteam TEXT,
    sort_order INTEGER DEFAULT 0,
    assigned_to TEXT,
    parent_id TEXT,
    time_spent_seconds INTEGER DEFAULT 0,
    created_by TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    due_date TEXT,
    start_date TEXT,
    estimated_minutes INTEGER,
    cover_image TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_sort ON tasks(status, sort_order);

CREATE TABLE IF NOT EXISTS task_assignments (
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);


-- â”€â”€ Audit Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ Full-Text Search (FTS5) Virtual Tables + Sync Triggers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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


-- â”€â”€ E-Commerce Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    price_cents INTEGER NOT NULL,
    image_url TEXT,
    active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    stripe_session_id TEXT UNIQUE,
    customer_email TEXT,
    shipping_name TEXT,
    shipping_address_line1 TEXT,
    shipping_address_line2 TEXT,
    shipping_city TEXT,
    shipping_state TEXT,
    shipping_postal_code TEXT,
    shipping_country TEXT,
    total_cents INTEGER NOT NULL,
    status TEXT DEFAULT 'processing',
    fulfillment_status TEXT DEFAULT 'unfulfilled',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, fulfillment_status);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(customer_email);

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
CREATE INDEX IF NOT EXISTS idx_user_profiles_show_on_about ON user_profiles(show_on_about);
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);
CREATE INDEX IF NOT EXISTS idx_docs_status_deleted ON docs(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_user_role ON user(role);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_cf_email ON posts(cf_email);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_comments_is_deleted ON comments(is_deleted);
CREATE INDEX IF NOT EXISTS idx_docs_history_author ON docs_history(author_email);

-- Championship-Grade Performance Indexes
CREATE INDEX IF NOT EXISTS idx_docs_category_sort ON docs(category, sort_order);
CREATE INDEX IF NOT EXISTS idx_docs_history_slug_created ON docs_history(slug, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_outreach_date_desc ON outreach_logs(date DESC);
CREATE INDEX IF NOT EXISTS idx_sponsorship_assignments_user ON sponsorship_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_onshape_bom_history_synced_by ON onshape_bom_history(synced_by);
CREATE INDEX IF NOT EXISTS idx_robots_season ON robots(season_id);
CREATE INDEX IF NOT EXISTS idx_robots_album ON robots(album_id);

-- â”€â”€ AI Integrations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

CREATE TABLE IF NOT EXISTS chat_sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    history TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_updated_at ON chat_sessions(updated_at);


-- Migration: Update simulations table to use UUIDs and multi-file JSON storage

DROP TABLE IF EXISTS simulations;

CREATE TABLE simulations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  files TEXT NOT NULL, -- JSON string mapping filename to code
  author_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  is_public INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_simulations_author ON simulations(author_id);
CREATE INDEX IF NOT EXISTS idx_simulations_public ON simulations(is_public);


CREATE TABLE IF NOT EXISTS entity_links (
    id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    link_type TEXT
);
CREATE INDEX IF NOT EXISTS idx_entity_links_source ON entity_links(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_entity_links_target ON entity_links(target_type, target_id);

CREATE TABLE IF NOT EXISTS external_knowledge_sources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    url TEXT NOT NULL,
    branch TEXT,
    status TEXT DEFAULT 'active',
    last_indexed_sha TEXT,
    last_indexed_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS scouting_analyses (
    id TEXT PRIMARY KEY,
    season_key TEXT NOT NULL,
    event_key TEXT,
    team_number INTEGER,
    mode TEXT NOT NULL,
    model TEXT NOT NULL,
    markdown TEXT NOT NULL,
    tokens_used INTEGER,
    created_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_scouting_analyses_team ON scouting_analyses(team_number);
CREATE INDEX IF NOT EXISTS idx_scouting_analyses_event ON scouting_analyses(event_key);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    amount REAL NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    receipt_url TEXT,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    logged_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_finance_tx_season ON finance_transactions(season_id);

CREATE TABLE IF NOT EXISTS sponsorship_pipeline (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    contact_person TEXT,
    status TEXT NOT NULL,
    estimated_value REAL DEFAULT 0,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    notes TEXT,
    zulip_message_id TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_sponsorship_season ON sponsorship_pipeline(season_id);

CREATE TABLE IF NOT EXISTS sponsorship_assignments (
    sponsorship_id TEXT NOT NULL REFERENCES sponsorship_pipeline(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    PRIMARY KEY (sponsorship_id, user_id)
);

CREATE TABLE IF NOT EXISTS social_queue (
    id TEXT PRIMARY KEY,
    content TEXT NOT NULL,
    media_urls TEXT,
    scheduled_for TEXT NOT NULL,
    platforms TEXT NOT NULL,
    status TEXT DEFAULT 'pending' NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    sent_at TEXT,
    error_message TEXT,
    created_by TEXT REFERENCES user(id) ON DELETE SET NULL,
    linked_type TEXT,
    linked_id TEXT,
    analytics TEXT
);

-- ── PartyKit Document Collaboration ────────────────────────────────
CREATE TABLE IF NOT EXISTS document_snapshots (
    room_id TEXT PRIMARY KEY,
    state BLOB NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_document_snapshots_updated ON document_snapshots(updated_at);

-- ── Performance Metrics ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS performance_metrics (
    id TEXT PRIMARY KEY,
    metric_name TEXT NOT NULL,
    value REAL NOT NULL,
    rating TEXT NOT NULL,
    page TEXT NOT NULL,
    timestamp TEXT NOT NULL
);

-- ── Usage Metrics ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_metrics (
    id TEXT PRIMARY KEY,
    timestamp TEXT DEFAULT (datetime('now')),
    endpoint TEXT NOT NULL,
    method TEXT NOT NULL,
    status_code INTEGER NOT NULL,
    latency_ms INTEGER NOT NULL,
    user_id TEXT,
    cf_ray TEXT,
    cf_ip TEXT
);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_timestamp ON usage_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_usage_metrics_endpoint ON usage_metrics(endpoint);


-- ── Tasks Relationships ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS labels (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color_theme TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS task_attachments (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    type TEXT NOT NULL,
    thumbnail_url TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON task_attachments(task_id);

CREATE TABLE IF NOT EXISTS task_checklists (
    id TEXT PRIMARY KEY,
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    is_completed INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_task_checklists_task ON task_checklists(task_id);

CREATE TABLE IF NOT EXISTS task_labels (
    task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    label_id TEXT NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, label_id)
);
CREATE INDEX IF NOT EXISTS idx_task_labels_task ON task_labels(task_id);
CREATE INDEX IF NOT EXISTS idx_task_labels_label ON task_labels(label_id);



-- ─── Videos ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS videos (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    platform TEXT NOT NULL,
    video_id TEXT NOT NULL,
    thumbnail_key TEXT,
    type TEXT DEFAULT 'video',
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_videos_created ON videos(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_videos_platform ON videos(platform);
CREATE INDEX IF NOT EXISTS idx_videos_type ON videos(type);

-- ─── Document Management Uploaded Files (Phase 77) ───────────────────────────

CREATE TABLE IF NOT EXISTS uploaded_files (
    id TEXT PRIMARY KEY,
    r2_key TEXT NOT NULL,
    filename TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size INTEGER NOT NULL,
    title TEXT,
    description TEXT,
    uploaded_by TEXT NOT NULL,
    uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL,
    source TEXT DEFAULT 'manual'
);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_at ON uploaded_files(uploaded_at);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_by ON uploaded_files(uploaded_by);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_r2 ON uploaded_files(r2_key);

CREATE TABLE IF NOT EXISTS file_usage (
    id TEXT PRIMARY KEY,
    file_id TEXT NOT NULL REFERENCES uploaded_files(id) ON DELETE CASCADE,
    post_id TEXT NOT NULL REFERENCES posts(slug) ON DELETE CASCADE,
    post_title TEXT NOT NULL,
    linked_at TEXT DEFAULT CURRENT_TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_file_usage_file ON file_usage(file_id);
CREATE INDEX IF NOT EXISTS idx_file_usage_post ON file_usage(post_id);
CREATE INDEX IF NOT EXISTS idx_file_usage_linked ON file_usage(linked_at);


-- ─── Photo Albums (Google Photos Import) ───────────────────────────────────

CREATE TABLE IF NOT EXISTS photo_albums (
    id TEXT PRIMARY KEY NOT NULL,
    google_album_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    r2_folder TEXT NOT NULL,
    synced_at TEXT NOT NULL,
    media_items_count TEXT
);
CREATE INDEX IF NOT EXISTS idx_photo_albums_google_id ON photo_albums(google_album_id);

CREATE TABLE IF NOT EXISTS imported_photos (
    id TEXT PRIMARY KEY NOT NULL,
    r2_key TEXT NOT NULL,
    original_filename TEXT NOT NULL,
    google_media_item_id TEXT NOT NULL UNIQUE,
    album_id TEXT REFERENCES photo_albums(id) ON DELETE SET NULL,
    imported_by TEXT NOT NULL,
    imported_at TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_imported_photos_google_id ON imported_photos(google_media_item_id);
CREATE INDEX IF NOT EXISTS idx_imported_photos_album ON imported_photos(album_id);

CREATE TABLE IF NOT EXISTS import_audit_log (
    id TEXT PRIMARY KEY NOT NULL,
    media_item_id TEXT NOT NULL,
    filename TEXT NOT NULL,
    status TEXT NOT NULL,
    error TEXT,
    r2_key TEXT,
    imported_by TEXT NOT NULL,
    imported_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_import_audit_imported_at ON import_audit_log(imported_at);


-- ─── Document Albums ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS albums (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    cover_image_id TEXT,
    display_mode TEXT DEFAULT 'masonry' NOT NULL,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
    created_by TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS album_media (
    album_id TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
    media_id TEXT NOT NULL REFERENCES imported_photos(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (album_id, media_id)
);
CREATE INDEX IF NOT EXISTS idx_album_media_album ON album_media(album_id);
CREATE INDEX IF NOT EXISTS idx_album_media_media ON album_media(media_id);


-- ─── Onshape Integrations ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS onshape_credentials (
    user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,
    refresh_token TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_onshape_credentials_last_used ON onshape_credentials(last_used_at);

CREATE TABLE IF NOT EXISTS onshape_documents (
    document_id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    owner_name TEXT,
    is_public INTEGER DEFAULT 0 NOT NULL,
    last_synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_onshape_documents_public ON onshape_documents(is_public);

CREATE TABLE IF NOT EXISTS onshape_bom_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    document_id TEXT NOT NULL,
    element_id TEXT NOT NULL,
    part_count INTEGER NOT NULL,
    synced_by TEXT NOT NULL REFERENCES user(id) ON DELETE SET NULL,
    synced_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_onshape_bom_history_document ON onshape_bom_history(document_id);
CREATE INDEX IF NOT EXISTS idx_onshape_bom_history_synced_at ON onshape_bom_history(synced_at);
CREATE INDEX IF NOT EXISTS idx_onshape_bom_history_synced_by ON onshape_bom_history(synced_by);


-- ─── Robots & Tournaments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS robots (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    ast TEXT,
    album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
    onshape_url TEXT,
    cad_viewer_url TEXT,
    reveal_video_id TEXT,
    weight_lbs REAL,
    drivetrain_type TEXT,
    programming_language TEXT,
    primary_mechanism TEXT,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_robots_season ON robots(season_id);
CREATE INDEX IF NOT EXISTS idx_robots_album ON robots(album_id);

CREATE TABLE IF NOT EXISTS tournaments (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT NOT NULL,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    robot_id TEXT REFERENCES robots(id) ON DELETE SET NULL,
    ftc_event_code TEXT,
    ast TEXT,
    album_id TEXT REFERENCES albums(id) ON DELETE SET NULL,
    start_date TEXT,
    end_date TEXT,
    location TEXT,
    rank INTEGER,
    alliance_role TEXT,
    elimination_status TEXT,
    opr REAL,
    is_deleted INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tournaments_season ON tournaments(season_id);
CREATE INDEX IF NOT EXISTS idx_tournaments_robot ON tournaments(robot_id);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    match_number INTEGER NOT NULL,
    match_type TEXT NOT NULL,
    red_score INTEGER,
    blue_score INTEGER,
    youtube_video_id TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);

CREATE TABLE IF NOT EXISTS tournament_awards (
    id TEXT PRIMARY KEY NOT NULL,
    tournament_id TEXT NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    placement TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_tournament_awards_tournament ON tournament_awards(tournament_id);


