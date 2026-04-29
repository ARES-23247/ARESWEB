-- Migration 039: Add Mentoring and Finance Modules
-- This migration enhances Outreach tracking and adds a full Sponsorship & Finance Ledger.

-- 1. Mentoring Integration for Outreach
ALTER TABLE outreach_logs ADD COLUMN is_mentoring INTEGER DEFAULT 0;
ALTER TABLE outreach_logs ADD COLUMN mentored_team_number TEXT;

-- 2. Sponsorship Pipeline
CREATE TABLE IF NOT EXISTS sponsorship_pipeline (
    id TEXT PRIMARY KEY,
    company_name TEXT NOT NULL,
    sponsor_id TEXT REFERENCES sponsors(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'potential', -- potential, contacted, pledged, secured, lost
    estimated_value REAL DEFAULT 0,
    notes TEXT,
    contact_person TEXT,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sponsorship_status ON sponsorship_pipeline(status);
CREATE INDEX IF NOT EXISTS idx_sponsorship_season ON sponsorship_pipeline(season_id);

-- 3. Finance Ledger (Transactions)
CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL, -- income, expense
    amount REAL NOT NULL,
    category TEXT NOT NULL, -- e.g., 'parts', 'travel', 'registration', 'sponsorship', 'grant'
    date TEXT NOT NULL,
    description TEXT,
    receipt_url TEXT,
    season_id INTEGER REFERENCES seasons(start_year) ON DELETE SET NULL,
    logged_by TEXT REFERENCES user(id) ON DELETE SET NULL,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_finance_season_date ON finance_transactions(season_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance_transactions(type);

-- 4. Additional Performance Indexes
CREATE INDEX IF NOT EXISTS idx_outreach_mentoring ON outreach_logs(is_mentoring);

-- 5. System Settings
INSERT OR IGNORE INTO settings (key, value) VALUES ('TBA_API_KEY', '');
INSERT OR IGNORE INTO settings (key, value) VALUES ('FTC_EVENTS_API_KEY', '');


