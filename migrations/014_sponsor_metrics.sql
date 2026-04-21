-- Sponsor ROI Tracking Schema Migration

CREATE TABLE IF NOT EXISTS sponsor_metrics (
    id TEXT PRIMARY KEY,
    sponsor_id TEXT NOT NULL,
    year_month TEXT NOT NULL, -- Format: YYYY-MM
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    UNIQUE(sponsor_id, year_month)
);

CREATE INDEX IF NOT EXISTS idx_sponsor_metrics_sponsor ON sponsor_metrics(sponsor_id);

CREATE TABLE IF NOT EXISTS sponsor_tokens (
    token TEXT PRIMARY KEY,
    sponsor_id TEXT NOT NULL,
    created_by TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(sponsor_id) REFERENCES sponsors(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sponsor_tokens_sponsor ON sponsor_tokens(sponsor_id);
