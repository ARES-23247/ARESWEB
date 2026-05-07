-- Migration: Add Zulip sync columns to Kanban tasks

ALTER TABLE tasks ADD COLUMN zulip_stream TEXT;
ALTER TABLE tasks ADD COLUMN zulip_topic TEXT;
