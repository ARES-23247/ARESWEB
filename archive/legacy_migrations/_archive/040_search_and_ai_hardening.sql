-- Migration 040: Search and AI Intelligence Hardening
-- This migration enables Full-Text Search for Outreach/Awards and adds structured metadata for AI reporting.

-- 1. AI Readiness: Structured Metadata for Outreach
ALTER TABLE outreach_logs ADD COLUMN metadata TEXT;

-- 2. Outreach Full-Text Search (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS outreach_fts USING fts5(
    title,
    location,
    impact_summary,
    content='outreach_logs',
    content_rowid='id'
);

-- Triggers for Outreach FTS Sync
CREATE TRIGGER IF NOT EXISTS outreach_fts_ai AFTER INSERT ON outreach_logs BEGIN
    INSERT INTO outreach_fts(rowid, title, location, impact_summary) 
    VALUES (new.id, new.title, new.location, new.impact_summary);
END;

CREATE TRIGGER IF NOT EXISTS outreach_fts_ad AFTER DELETE ON outreach_logs BEGIN
    INSERT INTO outreach_fts(outreach_fts, rowid, title, location, impact_summary) 
    VALUES ('delete', old.id, old.title, old.location, old.impact_summary);
END;

CREATE TRIGGER IF NOT EXISTS outreach_fts_au AFTER UPDATE ON outreach_logs BEGIN
    INSERT INTO outreach_fts(outreach_fts, rowid, title, location, impact_summary) 
    VALUES ('delete', old.id, old.title, old.location, old.impact_summary);
    INSERT INTO outreach_fts(rowid, title, location, impact_summary) 
    VALUES (new.id, new.title, new.location, new.impact_summary);
END;

-- 3. Awards Full-Text Search (FTS5)
CREATE VIRTUAL TABLE IF NOT EXISTS awards_fts USING fts5(
    title,
    event_name,
    description,
    content='awards',
    content_rowid='id'
);

-- Triggers for Awards FTS Sync
CREATE TRIGGER IF NOT EXISTS awards_fts_ai AFTER INSERT ON awards BEGIN
    INSERT INTO awards_fts(rowid, title, event_name, description) 
    VALUES (new.id, new.title, new.event_name, new.description);
END;

CREATE TRIGGER IF NOT EXISTS awards_fts_ad AFTER DELETE ON awards BEGIN
    INSERT INTO awards_fts(awards_fts, rowid, title, event_name, description) 
    VALUES ('delete', old.id, old.title, old.event_name, old.description);
END;

CREATE TRIGGER IF NOT EXISTS awards_fts_au AFTER UPDATE ON awards BEGIN
    INSERT INTO awards_fts(awards_fts, rowid, title, event_name, description) 
    VALUES ('delete', old.id, old.title, old.event_name, old.description);
    INSERT INTO awards_fts(rowid, title, event_name, description) 
    VALUES (new.id, new.title, new.event_name, new.description);
END;
