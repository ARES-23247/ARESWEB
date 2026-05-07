-- Migration 042: Gracious Professionalism and Inclusion Hardening
-- This migration adds mutual aid fields to Scouting and Core Value tagging to Outreach.

-- 1. Scouting: Mutual Aid & Collaboration
ALTER TABLE pit_scouting ADD COLUMN can_help_with TEXT; -- JSON or CSV
ALTER TABLE pit_scouting ADD COLUMN needs_help_with TEXT; -- JSON or CSV

-- 2. Outreach: Cultural Legacy & Core Values
ALTER TABLE outreach_logs ADD COLUMN core_values TEXT; -- CSV of FIRST Core Values

-- 3. Logistics: Inclusive Dietary Categorization
-- We create a reference table for mapping restrictions to risk levels
CREATE TABLE IF NOT EXISTS dietary_categories (
    restriction TEXT PRIMARY KEY,
    category TEXT NOT NULL -- 'Medical/Critical', 'Religious/Ethical', 'Lifestyle/Choice'
);

-- Seed common restrictions
INSERT OR IGNORE INTO dietary_categories (restriction, category) VALUES 
('Peanut Allergy', 'Medical/Critical'),
('Nut Allergy', 'Medical/Critical'),
('Shellfish Allergy', 'Medical/Critical'),
('Celiac / Gluten Free', 'Medical/Critical'),
('Dairy Allergy', 'Medical/Critical'),
('Vegetarian', 'Religious/Ethical'),
('Vegan', 'Religious/Ethical'),
('Halal', 'Religious/Ethical'),
('Kosher', 'Religious/Ethical'),
('Keto', 'Lifestyle/Choice'),
('Paleo', 'Lifestyle/Choice'),
('Low Carb', 'Lifestyle/Choice');
