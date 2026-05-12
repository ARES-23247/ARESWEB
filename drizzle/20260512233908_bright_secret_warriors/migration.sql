ALTER TABLE `videos` ADD `type` text DEFAULT 'video';--> statement-breakpoint
CREATE INDEX `idx_videos_type` ON `videos` (`type`);