-- Migration 031: Create judge_access_codes table
-- This table is referenced by judges.ts but was never provisioned in production.

CREATE TABLE IF NOT EXISTS judge_access_codes (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    label TEXT DEFAULT 'Judge Access',
    created_at TEXT DEFAULT (datetime('now')),
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_judge_codes_code ON judge_access_codes(code);
