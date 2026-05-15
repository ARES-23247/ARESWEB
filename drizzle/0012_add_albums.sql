CREATE TABLE `album_media` (
	`album_id` text NOT NULL,
	`media_id` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `album_media_album_id_media_id_pk` PRIMARY KEY(`album_id`, `media_id`),
	CONSTRAINT `fk_album_media_album_id_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_album_media_media_id_imported_photos_id_fk` FOREIGN KEY (`media_id`) REFERENCES `imported_photos`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `albums` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`cover_image_id` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`created_by` text NOT NULL,
	CONSTRAINT `fk_albums_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `imported_photos` RENAME COLUMN `mimeType` TO `mime_type`;--> statement-breakpoint
CREATE INDEX `idx_album_media_album` ON `album_media` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_album_media_media` ON `album_media` (`media_id`);