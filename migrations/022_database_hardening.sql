-- 022_database_hardening.sql
-- Production hardening: Add missing indexes for frequently queried columns,
-- add missing foreign key comments for documentation purposes.

-- Posts: slug is PRIMARY KEY. Add index on date (ORDER BY) and status (WHERE filter)
CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, is_deleted);

-- Events: Composite index for the common filter pattern
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_events_date ON events(date_start);

-- Signups: Add user_id index for profile-based lookups
CREATE INDEX IF NOT EXISTS idx_signups_user ON event_signups(user_id);

-- Inquiries: Status filter for admin dashboard
CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);
CREATE INDEX IF NOT EXISTS idx_inquiries_created ON inquiries(created_at);

-- Settings: key is PRIMARY KEY (covered)

-- Comments: created_at for ordering
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at);

-- Outreach logs: date ordering
CREATE INDEX IF NOT EXISTS idx_outreach_date ON outreach_logs(date);

-- Awards: date ordering
CREATE INDEX IF NOT EXISTS idx_awards_date ON awards(date);

-- User: email lookups (most common query path)
CREATE INDEX IF NOT EXISTS idx_user_email ON user(email);
