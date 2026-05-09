-- Migration: Add FTS Sync Triggers
-- Created: 2026-05-09
-- Description: Adds triggers to keep FTS virtual tables synchronized with their source tables
--
-- This migration ensures that full-text search virtual tables are automatically updated
-- when inserts, updates, or deletes occur on the source tables. Without these triggers,
-- the FTS tables would become stale and search results would be incomplete or incorrect.

-- docs_fts triggers
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

-- posts_fts triggers
CREATE TRIGGER IF NOT EXISTS posts_fts_insert AFTER INSERT ON posts BEGIN
    INSERT INTO posts_fts (slug, title, snippet, author, ast)
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast);
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_delete AFTER DELETE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
END;

CREATE TRIGGER IF NOT EXISTS posts_fts_update AFTER UPDATE ON posts BEGIN
    DELETE FROM posts_fts WHERE slug = old.slug;
    INSERT INTO posts_fts (slug, title, snippet, author, ast)
    VALUES (new.slug, new.title, new.snippet, new.author, new.ast);
END;

-- events_fts triggers
CREATE TRIGGER IF NOT EXISTS events_fts_insert AFTER INSERT ON events BEGIN
    INSERT INTO events_fts (id, title, description, location, status, is_deleted)
    VALUES (new.id, new.title, new.description, new.location, new.status, new.is_deleted);
END;

CREATE TRIGGER IF NOT EXISTS events_fts_delete AFTER DELETE ON events BEGIN
    DELETE FROM events_fts WHERE id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS events_fts_update AFTER UPDATE ON events BEGIN
    DELETE FROM events_fts WHERE id = old.id;
    INSERT INTO events_fts (id, title, description, location, status, is_deleted)
    VALUES (new.id, new.title, new.description, new.location, new.status, new.is_deleted);
END;

-- user_profiles_fts triggers
CREATE TRIGGER IF NOT EXISTS user_profiles_fts_insert AFTER INSERT ON user_profiles BEGIN
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about)
    SELECT new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about
    WHERE new.show_on_about = 1;
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_delete AFTER DELETE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_update AFTER UPDATE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about)
    SELECT new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about
    WHERE new.show_on_about = 1;
END;
