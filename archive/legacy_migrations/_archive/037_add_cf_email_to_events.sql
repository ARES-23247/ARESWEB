-- Migration 037: Ensure cf_email column exists on events table
-- This column was added manually to production but was missing from the migration chain.
-- Using a safe no-op pattern since SQLite does not support ADD COLUMN IF NOT EXISTS.
-- The column is already present in the genesis schema (0007_championship_expansion_pillars.sql).
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM pragma_table_info('events') WHERE name = 'cf_email');
