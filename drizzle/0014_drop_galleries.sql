PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_album_media` (
	`album_id` text NOT NULL,
	`media_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `album_media_album_id_media_id_pk` PRIMARY KEY(`album_id`, `media_id`),
	CONSTRAINT `fk_album_media_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
INSERT INTO `__new_album_media`(`album_id`, `media_id`, `sort_order`, `created_at`) SELECT `album_id`, `media_id`, `sort_order`, `created_at` FROM `album_media`;--> statement-breakpoint
DROP TABLE `album_media`;--> statement-breakpoint
ALTER TABLE `__new_album_media` RENAME TO `album_media`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_galleries_created`;--> statement-breakpoint
CREATE INDEX `idx_album_media_album` ON `album_media` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_album_media_media` ON `album_media` (`media_id`);--> statement-breakpoint
DROP TABLE `galleries`;