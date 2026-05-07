-- Migration: 032_performance_indexes.sql
-- Description: Add missing indexes for performance optimization.

CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author);
CREATE INDEX IF NOT EXISTS idx_posts_cf_email ON posts(cf_email);
CREATE INDEX IF NOT EXISTS idx_comments_is_deleted ON comments(is_deleted);

