-- Migration 037: Add missing cf_email to events
-- Add missing column for event creator tracking (resolves local dev 500 errors)
ALTER TABLE events ADD COLUMN cf_email TEXT;
