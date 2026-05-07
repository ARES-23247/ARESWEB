-- Phase 1: Analytics
CREATE TABLE IF NOT EXISTS page_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    path TEXT NOT NULL,
    category TEXT NOT NULL,
    user_agent TEXT,
    referrer TEXT,
    timestamp TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_analytics_path ON page_analytics(path);
CREATE INDEX IF NOT EXISTS idx_analytics_timestamp ON page_analytics(timestamp);

-- Phase 2: Sponsors
CREATE TABLE IF NOT EXISTS sponsors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    tier TEXT NOT NULL, -- Titanium, Gold, Silver, Bronze
    logo_url TEXT,
    website_url TEXT,
    is_active INTEGER DEFAULT 1,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Phase 4: Outreach
CREATE TABLE IF NOT EXISTS outreach_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    date TEXT NOT NULL,
    location TEXT,
    hours INTEGER,
    people_reached INTEGER,
    impact_summary TEXT, -- AST Content
    cf_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

-- Phase 5: Awards
CREATE TABLE IF NOT EXISTS awards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    event_name TEXT NOT NULL,
    date TEXT NOT NULL,
    description TEXT,
    icon_type TEXT DEFAULT 'trophy', -- 'trophy', 'medal', 'banner'
    created_at TEXT DEFAULT (datetime('now'))
);

-- Phase 6: Portfolio Metadata
ALTER TABLE docs ADD COLUMN is_portfolio INTEGER DEFAULT 0;
ALTER TABLE posts ADD COLUMN is_portfolio INTEGER DEFAULT 0;
