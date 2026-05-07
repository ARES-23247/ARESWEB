-- 0010_add_task_subteam.sql
-- Subteam is already defined in schema.sql for new databases. 
-- This migration is kept for history but no-ops to prevent "duplicate column" errors in CI which bootstraps from schema.sql first.
SELECT 1;
