PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`role` text DEFAULT 'user',
	`twoFactorEnabled` integer DEFAULT false,
	`twoFactorSecret` text,
	`twoFactorBackupCodes` text
);
--> statement-breakpoint
INSERT INTO `__new_user`("id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "twoFactorEnabled", "twoFactorSecret", "twoFactorBackupCodes") SELECT "id", "name", "email", "emailVerified", "image", "createdAt", "updatedAt", "role", "twoFactorEnabled", "twoFactorSecret", "twoFactorBackupCodes" FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_user_role` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `user` (`email`);