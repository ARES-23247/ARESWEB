-- Safe Migration for ARESWEB Documentation Features
-- Add administrative auditing column (Ignore errors if column exists)
-- Note: SQLite ADD COLUMN will fail if it already exists, so we wrap the execution if possible.
-- However, wrangler d1 execute will just error on the line. I'll split them to ensure 
-- the tables are created even if the column exists.

ALTER TABLE docs ADD COLUMN cf_email TEXT;

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

CREATE TABLE IF NOT EXISTS docs_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    is_helpful INTEGER,
    comment TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_docs_history_slug ON docs_history(slug);
CREATE INDEX IF NOT EXISTS idx_docs_feedback_slug ON docs_feedback(slug);
