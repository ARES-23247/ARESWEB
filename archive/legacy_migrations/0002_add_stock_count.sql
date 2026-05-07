-- Migration number: 0002 	 2026-04-30T00:00:00.000Z
-- idempotent: tracked in d1_migrations table
ALTER TABLE products ADD COLUMN stock_count INTEGER DEFAULT 100;
