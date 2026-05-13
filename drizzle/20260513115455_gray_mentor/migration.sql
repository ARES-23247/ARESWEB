CREATE TABLE `file_usage` (
	`id` text PRIMARY KEY,
	`file_id` text NOT NULL,
	`post_id` text NOT NULL,
	`post_title` text NOT NULL,
	`linked_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_file_usage_file_id_uploaded_files_id_fk` FOREIGN KEY (`file_id`) REFERENCES `uploaded_files`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_file_usage_post_id_posts_slug_fk` FOREIGN KEY (`post_id`) REFERENCES `posts`(`slug`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `import_audit_log` (
	`id` text PRIMARY KEY,
	`media_item_id` text NOT NULL,
	`filename` text NOT NULL,
	`status` text NOT NULL,
	`error` text,
	`r2_key` text,
	`imported_by` text NOT NULL,
	`imported_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `imported_photos` (
	`id` text PRIMARY KEY,
	`r2_key` text NOT NULL,
	`original_filename` text NOT NULL,
	`google_media_item_id` text NOT NULL,
	`album_id` text,
	`imported_by` text NOT NULL,
	`imported_at` text NOT NULL,
	`mimeType` text NOT NULL,
	`file_size` text NOT NULL,
	CONSTRAINT `fk_imported_photos_album_id_photo_albums_id_fk` FOREIGN KEY (`album_id`) REFERENCES `photo_albums`(`id`)
);
--> statement-breakpoint
CREATE TABLE `onshape_bom_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`document_id` text NOT NULL,
	`element_id` text NOT NULL,
	`part_count` integer NOT NULL,
	`synced_by` text NOT NULL,
	`synced_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_onshape_bom_history_synced_by_user_id_fk` FOREIGN KEY (`synced_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `onshape_credentials` (
	`user_id` text PRIMARY KEY,
	`access_token` text NOT NULL,
	`refresh_token` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`last_used_at` text,
	CONSTRAINT `fk_onshape_credentials_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `onshape_documents` (
	`document_id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`thumbnail_url` text,
	`owner_name` text,
	`is_public` integer DEFAULT 0 NOT NULL,
	`last_synced_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `photo_albums` (
	`id` text PRIMARY KEY,
	`google_album_id` text NOT NULL,
	`name` text NOT NULL,
	`r2_folder` text NOT NULL,
	`synced_at` text NOT NULL,
	`media_items_count` text
);
--> statement-breakpoint
CREATE TABLE `uploaded_files` (
	`id` text PRIMARY KEY,
	`r2_key` text NOT NULL,
	`filename` text NOT NULL,
	`mime_type` text NOT NULL,
	`size` integer NOT NULL,
	`title` text,
	`description` text,
	`uploaded_by` text NOT NULL,
	`uploaded_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`source` text DEFAULT 'manual'
);
--> statement-breakpoint
CREATE INDEX `idx_file_usage_file` ON `file_usage` (`file_id`);--> statement-breakpoint
CREATE INDEX `idx_file_usage_post` ON `file_usage` (`post_id`);--> statement-breakpoint
CREATE INDEX `idx_file_usage_linked` ON `file_usage` (`linked_at`);--> statement-breakpoint
CREATE INDEX `idx_import_audit_imported_at` ON `import_audit_log` (`imported_at`);--> statement-breakpoint
CREATE INDEX `idx_imported_photos_google_id` ON `imported_photos` (`google_media_item_id`);--> statement-breakpoint
CREATE INDEX `idx_imported_photos_album` ON `imported_photos` (`album_id`);--> statement-breakpoint
CREATE INDEX `idx_onshape_bom_history_document` ON `onshape_bom_history` (`document_id`);--> statement-breakpoint
CREATE INDEX `idx_onshape_bom_history_synced_at` ON `onshape_bom_history` (`synced_at`);--> statement-breakpoint
CREATE INDEX `idx_onshape_credentials_last_used` ON `onshape_credentials` (`last_used_at`);--> statement-breakpoint
CREATE INDEX `idx_onshape_documents_public` ON `onshape_documents` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_photo_albums_google_id` ON `photo_albums` (`google_album_id`);--> statement-breakpoint
CREATE INDEX `idx_uploaded_files_at` ON `uploaded_files` (`uploaded_at`);--> statement-breakpoint
CREATE INDEX `idx_uploaded_files_by` ON `uploaded_files` (`uploaded_by`);--> statement-breakpoint
CREATE INDEX `idx_uploaded_files_r2` ON `uploaded_files` (`r2_key`);