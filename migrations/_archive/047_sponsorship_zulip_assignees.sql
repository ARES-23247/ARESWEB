-- Migration 047: Add Zulip and Assignees to Sponsorship Pipeline

-- Add zulip_message_id to sponsorship_pipeline
ALTER TABLE sponsorship_pipeline ADD COLUMN zulip_message_id TEXT;

-- Create join table for sponsorship assignees
CREATE TABLE IF NOT EXISTS sponsorship_assignments (
    sponsorship_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    PRIMARY KEY (sponsorship_id, user_id),
    FOREIGN KEY (sponsorship_id) REFERENCES sponsorship_pipeline(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Index for efficient user-based lookups
CREATE INDEX IF NOT EXISTS idx_sponsorship_assignments_user ON sponsorship_assignments(user_id);
