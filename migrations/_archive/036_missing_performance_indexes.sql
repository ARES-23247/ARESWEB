-- Migration: 036_missing_performance_indexes.sql
-- Description: Add missing indexes and cleanup redundant ones.

-- Add Missing Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_show_on_about ON user_profiles(show_on_about);
CREATE INDEX IF NOT EXISTS idx_posts_published_at ON posts(published_at, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_user_role ON user(role);
CREATE INDEX IF NOT EXISTS idx_docs_history_author ON docs_history(author_email);

-- Clean up Redundant Indexes
DROP INDEX IF EXISTS idx_audit_log_created;
