-- Auth Enrichment for 2FA and Verification status
ALTER TABLE user ADD COLUMN twoFactorEnabled INTEGER DEFAULT 0;
ALTER TABLE user ADD COLUMN twoFactorSecret TEXT;
ALTER TABLE user ADD COLUMN twoFactorBackupCodes TEXT;

-- Better Auth sometimes needs a dedicated table for 2FA if using advanced plugins, 
-- but TOTP typically uses user columns in the D1 adapter.
-- We also ensure emailVerified is properly considered (it's already in the 'user' table from 0003).
