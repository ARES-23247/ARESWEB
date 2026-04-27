-- Migration 043: Knowledge Graph Integrity Triggers
-- This migration ensures that polymorphic entity links are cleaned up when parents are deleted.

-- 1. Doc Triggers
CREATE TRIGGER IF NOT EXISTS entity_links_doc_delete AFTER DELETE ON docs 
BEGIN
    DELETE FROM entity_links WHERE (source_type = 'doc' AND source_id = old.slug) OR (target_type = 'doc' AND target_id = old.slug);
END;

-- 2. Post Triggers
CREATE TRIGGER IF NOT EXISTS entity_links_post_delete AFTER DELETE ON posts 
BEGIN
    DELETE FROM entity_links WHERE (source_type = 'post' AND source_id = old.slug) OR (target_type = 'post' AND target_id = old.slug);
END;

-- 3. Outreach Triggers
CREATE TRIGGER IF NOT EXISTS entity_links_outreach_delete AFTER DELETE ON outreach_logs 
BEGIN
    DELETE FROM entity_links WHERE (source_type = 'outreach' AND source_id = old.id) OR (target_type = 'outreach' AND target_id = old.id);
END;

-- 4. Event Triggers
CREATE TRIGGER IF NOT EXISTS entity_links_event_delete AFTER DELETE ON events 
BEGIN
    DELETE FROM entity_links WHERE (source_type = 'event' AND source_id = old.id) OR (target_type = 'event' AND target_id = old.id);
END;

-- 5. Task Triggers
CREATE TRIGGER IF NOT EXISTS entity_links_task_delete AFTER DELETE ON tasks 
BEGIN
    DELETE FROM entity_links WHERE (source_type = 'task' AND source_id = old.id) OR (target_type = 'task' AND target_id = old.id);
END;
