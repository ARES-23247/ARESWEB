-- 023_performance_tuning.sql
-- SEC-D01/D1-01: Performance tuning and security hardening indexes

-- Improve performance for role-based authorization and filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_member_type ON user_profiles(member_type);

-- Improve performance for inquiry filtering (admin dashboard)
CREATE INDEX IF NOT EXISTS idx_inquiries_type ON inquiries(type);

-- Improve performance for docs listing and filtering
CREATE INDEX IF NOT EXISTS idx_docs_status_deleted ON docs(status, is_deleted);

-- Improve performance for badge lookup by user
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

-- Improve performance for settings lookup
CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);

-- EFF-D01: Optimize scheduled log purging
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at);
