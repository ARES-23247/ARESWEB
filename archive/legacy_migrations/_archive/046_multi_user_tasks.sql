-- Migration 046: Multi-User Task Assignment
-- Creates the join table for many-to-many task assignments and backfills existing data.

CREATE TABLE IF NOT EXISTS task_assignments (
    task_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (task_id, user_id),
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Index for efficient user-based lookups
CREATE INDEX IF NOT EXISTS idx_task_assignments_user ON task_assignments(user_id);

-- Backfill data from the legacy tasks.assigned_to column
INSERT INTO task_assignments (task_id, user_id)
SELECT id, assigned_to FROM tasks WHERE assigned_to IS NOT NULL;
