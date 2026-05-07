-- Phase 4: Search Revamp Migration
-- FTS5 for events
DROP TABLE IF EXISTS events_fts;
CREATE VIRTUAL TABLE events_fts USING fts5(id UNINDEXED, title, description, location, status UNINDEXED, is_deleted UNINDEXED);

INSERT INTO events_fts (id, title, description, location, status, is_deleted)
SELECT id, title, description, location, status, is_deleted FROM events;

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

-- FTS5 for user_profiles
DROP TABLE IF EXISTS user_profiles_fts;
CREATE VIRTUAL TABLE user_profiles_fts USING fts5(user_id UNINDEXED, nickname, first_name, last_name, bio, show_on_about UNINDEXED);

INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about)
SELECT user_id, nickname, first_name, last_name, bio, show_on_about FROM user_profiles;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_insert AFTER INSERT ON user_profiles BEGIN
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about) 
    VALUES (new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about);
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_delete AFTER DELETE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
END;

CREATE TRIGGER IF NOT EXISTS user_profiles_fts_update AFTER UPDATE ON user_profiles BEGIN
    DELETE FROM user_profiles_fts WHERE user_id = old.user_id;
    INSERT INTO user_profiles_fts (user_id, nickname, first_name, last_name, bio, show_on_about) 
    VALUES (new.user_id, new.nickname, new.first_name, new.last_name, new.bio, new.show_on_about);
END;
