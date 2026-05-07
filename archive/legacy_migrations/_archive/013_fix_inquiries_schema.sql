-- Migration 013: Fix inquiries table schema
DROP TABLE IF EXISTS inquiries;
CREATE TABLE inquiries (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    metadata TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
);
