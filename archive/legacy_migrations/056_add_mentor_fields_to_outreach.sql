-- Migration 056: Add mentor_count and mentor_hours to outreach_logs
-- These fields track how many mentors participated and their total hours

-- Add mentor_count column (number of mentors participating)
ALTER TABLE `outreach_logs` ADD COLUMN `mentor_count` INTEGER DEFAULT 0;

-- Add mentor_hours column (total hours contributed by mentors)
ALTER TABLE `outreach_logs` ADD COLUMN `mentor_hours` REAL DEFAULT 0;
