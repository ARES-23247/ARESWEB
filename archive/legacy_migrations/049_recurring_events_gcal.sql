-- Migration 049: Add recurring event columns for Google Calendar Sync
ALTER TABLE events ADD COLUMN recurrence_rule TEXT;
ALTER TABLE events ADD COLUMN parent_event_id TEXT;
ALTER TABLE events ADD COLUMN original_start_time TEXT;
