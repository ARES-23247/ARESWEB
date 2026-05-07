ALTER TABLE posts ADD COLUMN published_at TEXT;
ALTER TABLE events ADD COLUMN published_at TEXT;

UPDATE posts SET published_at = datetime('now') WHERE status = 'published' AND published_at IS NULL;
UPDATE events SET published_at = datetime('now') WHERE status = 'published' AND published_at IS NULL;
