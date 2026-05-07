-- Migration 044: Forensic Log Rotation
-- This migration ensures the audit_log doesn't grow indefinitely by implementing a 90-day rotation trigger.

CREATE TRIGGER IF NOT EXISTS audit_log_rotation AFTER INSERT ON audit_log
BEGIN
    -- ECON-LOG-01: Auto-purge logs older than 90 days
    DELETE FROM audit_log WHERE created_at < datetime('now', '-90 days');
END;
