-- Add recurring event columns
ALTER TABLE events ADD COLUMN recurring_group_id TEXT;
ALTER TABLE events ADD COLUMN rrule TEXT;
ALTER TABLE events ADD COLUMN recurring_exception INTEGER DEFAULT 0;

-- Update the FTS table config if necessary (though usually FTS doesn't need to index the group ID, we can just leave FTS alone)
