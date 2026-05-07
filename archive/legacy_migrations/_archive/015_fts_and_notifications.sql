-- Create Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);

-- FTS5 for docs
DROP TABLE IF EXISTS docs_fts;
CREATE VIRTUAL TABLE docs_fts USING fts5(slug UNINDEXED, title, category, description, content, status UNINDEXED, is_deleted UNINDEXED);

INSERT INTO docs_fts (slug, title, category, description, content, status, is_deleted)
SELECT slug, title, category, description, content, status, is_deleted FROM docs;

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

-- FTS5 for posts
DROP TABLE IF EXISTS posts_fts;
CREATE VIRTUAL TABLE posts_fts USING fts5(slug UNINDEXED, title, snippet, author, ast, status UNINDEXED, is_deleted UNINDEXED);

INSERT INTO posts_fts (slug, title, snippet, author, ast, status, is_deleted)
SELECT slug, title, snippet, author, ast, status, is_deleted FROM posts;

CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts (slug, title, snippet, author, ast, status, is_deleted) 
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast, new.status, new.is_deleted);
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
    INSERT INTO posts_fts (slug, title, snippet, author, ast, status, is_deleted) 
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast, new.status, new.is_deleted);
END;
