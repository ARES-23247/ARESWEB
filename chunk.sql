
CREATE TABLE IF NOT EXISTS `social_queue` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`media_urls` text,
	`scheduled_for` text NOT NULL,
	`platforms` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`sent_at` text,
	`error_message` text,
	`created_by` text,
	`linked_type` text,
	`linked_id` text,
	`analytics` text,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);