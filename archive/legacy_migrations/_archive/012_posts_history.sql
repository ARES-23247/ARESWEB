-- 012_posts_history.sql
CREATE TABLE IF NOT EXISTS posts_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slug TEXT NOT NULL,
    title TEXT,
    author TEXT,
    thumbnail TEXT,
    snippet TEXT,
    ast TEXT,
    author_email TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_history_slug ON posts_history(slug);
