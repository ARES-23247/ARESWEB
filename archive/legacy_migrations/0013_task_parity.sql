-- Migration: Monday.com Parity for Tasks

-- Add support for nested sub-tasks within the existing TaskDetailsModal
ALTER TABLE tasks ADD COLUMN parent_id TEXT REFERENCES tasks(id) ON DELETE CASCADE;

-- Add support for time-tracking widget
ALTER TABLE tasks ADD COLUMN time_spent_seconds INTEGER DEFAULT 0;
