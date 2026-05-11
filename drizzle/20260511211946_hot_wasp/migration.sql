CREATE TABLE `galleries` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`google_photos_url` text,
	`hero_image_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `videos` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`platform` text NOT NULL,
	`video_id` text NOT NULL,
	`thumbnail_key` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE INDEX `idx_galleries_created` ON `galleries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_videos_created` ON `videos` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_videos_platform` ON `videos` (`platform`);