-- Add students_count to outreach_logs if it doesn't exist (using a safe approach for SQLite)
-- In SQLite, we can't do IF NOT EXISTS for columns in ALTER TABLE easily in one statement, 
-- but since this is a new migration in the sequence, it should be fine.
ALTER TABLE outreach_logs ADD COLUMN students_count INTEGER DEFAULT 0;
