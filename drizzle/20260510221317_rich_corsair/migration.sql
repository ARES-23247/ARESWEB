CREATE TABLE `labels` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`color_theme` text
);
--> statement-breakpoint
CREATE TABLE `task_attachments` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL,
	`url` text NOT NULL,
	`title` text NOT NULL,
	`type` text NOT NULL,
	`thumbnail_url` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_task_attachments_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_checklists` (
	`id` text PRIMARY KEY,
	`task_id` text NOT NULL,
	`content` text NOT NULL,
	`is_completed` integer DEFAULT 0,
	`sort_order` integer DEFAULT 0,
	CONSTRAINT `fk_task_checklists_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `task_labels` (
	`task_id` text NOT NULL,
	`label_id` text NOT NULL,
	CONSTRAINT `task_labels_task_id_label_id_pk` PRIMARY KEY(`task_id`, `label_id`),
	CONSTRAINT `fk_task_labels_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_labels_label_id_labels_id_fk` FOREIGN KEY (`label_id`) REFERENCES `labels`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
ALTER TABLE `docs_feedback` ADD `is_resolved` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `events` ADD `recurring_group_id` text;--> statement-breakpoint
ALTER TABLE `events` ADD `rrule` text;--> statement-breakpoint
ALTER TABLE `events` ADD `recurring_exception` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `events` ADD `zulip_stream` text;--> statement-breakpoint
ALTER TABLE `events` ADD `zulip_topic` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `start_date` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `estimated_minutes` integer;--> statement-breakpoint
ALTER TABLE `tasks` ADD `cover_image` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `is_deleted` integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `hours` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_audit_log_created_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_chat_sessions_updated_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_comments_is_deleted`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_posts_published_at`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_user_profiles_show_on_about`;--> statement-breakpoint
DROP INDEX IF EXISTS `idx_user_profiles_member_type`;--> statement-breakpoint
CREATE INDEX `idx_audit_log_createdAt` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updatedAt` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_isDeleted` ON `comments` (`is_deleted`);--> statement-breakpoint
CREATE UNIQUE INDEX `unique_event_user_signup` ON `event_signups` (`event_id`,`user_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_publishedAt` ON `posts` (`published_at`,`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_task_attachments_task` ON `task_attachments` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_checklists_task` ON `task_checklists` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_labels_task` ON `task_labels` (`task_id`);--> statement-breakpoint
CREATE INDEX `idx_task_labels_label` ON `task_labels` (`label_id`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_showOnAbout` ON `user_profiles` (`show_on_about`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_memberType` ON `user_profiles` (`member_type`);