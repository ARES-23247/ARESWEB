-- Migration: Add Unique Constraint to Event Signups
-- Created: 2026-05-09
-- Description: Adds unique constraint on (event_id, user_id) to enable atomic upserts
--
-- This migration ensures each user can only have one signup per event.
-- The unique constraint is required for onConflictDoUpdate to work properly.

-- Drop existing indexes that will be replaced by the unique index
DROP INDEX IF EXISTS idx_signups_user;
DROP INDEX IF EXISTS idx_signups_event;

-- Create unique index on (event_id, user_id)
-- This serves both as a unique constraint and as a combined lookup index
CREATE UNIQUE INDEX IF NOT EXISTS unique_event_user_signup ON event_signups (event_id, user_id);
