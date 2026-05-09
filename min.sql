CREATE TABLE IF NOT EXISTS `user` (id text PRIMARY KEY);
CREATE INDEX IF NOT EXISTS `idx_user_role` ON `user` (`role`);
