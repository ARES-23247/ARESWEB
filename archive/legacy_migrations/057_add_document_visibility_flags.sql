-- 057_add_document_visibility_flags.sql
-- This migration added display_in_areslib, display_in_math_corner, and display_in_science_corner columns
--
-- NOTE: These columns were already added in a previous state. This migration is kept for history
-- but is now a no-op since the columns already exist in the database.
--
-- If you need to recreate these columns, they would be:
-- ALTER TABLE docs ADD COLUMN display_in_areslib INTEGER DEFAULT 0;
-- ALTER TABLE docs ADD COLUMN display_in_math_corner INTEGER DEFAULT 0;
-- ALTER TABLE docs ADD COLUMN display_in_science_corner INTEGER DEFAULT 0;

-- Set defaults for existing records (safe to run multiple times)
UPDATE docs SET display_in_areslib = 1 WHERE display_in_areslib IS NULL;
UPDATE docs SET display_in_math_corner = 0 WHERE display_in_math_corner IS NULL;
UPDATE docs SET display_in_science_corner = 0 WHERE display_in_science_corner IS NULL;
