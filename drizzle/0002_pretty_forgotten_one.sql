PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_audit_log`("id", "actor", "action", "resource_type", "resource_id", "details", "created_at") SELECT "id", "actor", "action", "resource_type", "resource_id", "details", "created_at" FROM `audit_log`;--> statement-breakpoint
DROP TABLE `audit_log`;--> statement-breakpoint
ALTER TABLE `__new_audit_log` RENAME TO `audit_log`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_audit_log_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_actor` ON `audit_log` (`actor`);--> statement-breakpoint
CREATE TABLE `__new_awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`event_name` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`icon_type` text DEFAULT 'trophy',
	`is_deleted` integer DEFAULT 0,
	`season_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_awards`("id", "title", "event_name", "date", "description", "icon_type", "is_deleted", "season_id", "created_at") SELECT "id", "title", "event_name", "date", "description", "icon_type", "is_deleted", "season_id", "created_at" FROM `awards`;--> statement-breakpoint
DROP TABLE `awards`;--> statement-breakpoint
ALTER TABLE `__new_awards` RENAME TO `awards`;--> statement-breakpoint
CREATE INDEX `idx_awards_date` ON `awards` (`date`);--> statement-breakpoint
CREATE INDEX `idx_awards_season` ON `awards` (`season_id`);--> statement-breakpoint
CREATE TABLE `__new_badges` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'Award',
	`color_theme` text DEFAULT 'ares-gold',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_badges`("id", "name", "description", "icon", "color_theme", "created_at") SELECT "id", "name", "description", "icon", "color_theme", "created_at" FROM `badges`;--> statement-breakpoint
DROP TABLE `badges`;--> statement-breakpoint
ALTER TABLE `__new_badges` RENAME TO `badges`;--> statement-breakpoint
CREATE TABLE `__new_chat_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`history` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_chat_sessions`("id", "user_id", "history", "created_at", "updated_at") SELECT "id", "user_id", "history", "created_at", "updated_at" FROM `chat_sessions`;--> statement-breakpoint
DROP TABLE `chat_sessions`;--> statement-breakpoint
ALTER TABLE `__new_chat_sessions` RENAME TO `chat_sessions`;--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_user_id` ON `chat_sessions` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_comments` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`zulip_message_id` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_comments`("id", "target_type", "target_id", "user_id", "content", "zulip_message_id", "is_deleted", "created_at", "updated_at") SELECT "id", "target_type", "target_id", "user_id", "content", "zulip_message_id", "is_deleted", "created_at", "updated_at" FROM `comments`;--> statement-breakpoint
DROP TABLE `comments`;--> statement-breakpoint
ALTER TABLE `__new_comments` RENAME TO `comments`;--> statement-breakpoint
CREATE INDEX `idx_comments_is_deleted` ON `comments` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_comments_created` ON `comments` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_user` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_target` ON `comments` (`target_type`,`target_id`);--> statement-breakpoint
CREATE TABLE `__new_docs` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`description` text,
	`content` text NOT NULL,
	`content_draft` text,
	`cf_email` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`is_deleted` integer DEFAULT 0,
	`status` text DEFAULT 'published',
	`is_portfolio` integer DEFAULT 0,
	`is_executive_summary` integer DEFAULT 0,
	`display_in_areslib` integer DEFAULT 0,
	`display_in_math_corner` integer DEFAULT 0,
	`display_in_science_corner` integer DEFAULT 0,
	`revision_of` text,
	`zulip_stream` text,
	`zulip_topic` text
);
--> statement-breakpoint
INSERT INTO `__new_docs`("slug", "title", "category", "sort_order", "description", "content", "content_draft", "cf_email", "updated_at", "is_deleted", "status", "is_portfolio", "is_executive_summary", "display_in_areslib", "display_in_math_corner", "display_in_science_corner", "revision_of", "zulip_stream", "zulip_topic") SELECT "slug", "title", "category", "sort_order", "description", "content", "content_draft", "cf_email", "updated_at", "is_deleted", "status", "is_portfolio", "is_executive_summary", "display_in_areslib", "display_in_math_corner", "display_in_science_corner", "revision_of", "zulip_stream", "zulip_topic" FROM `docs`;--> statement-breakpoint
DROP TABLE `docs`;--> statement-breakpoint
ALTER TABLE `__new_docs` RENAME TO `docs`;--> statement-breakpoint
CREATE INDEX `idx_docs_category_sort` ON `docs` (`category`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_docs_status_deleted` ON `docs` (`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_docs_category` ON `docs` (`category`);--> statement-breakpoint
CREATE TABLE `__new_docs_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`is_helpful` integer,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`slug`) REFERENCES `docs`(`slug`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_docs_feedback`("id", "slug", "is_helpful", "comment", "created_at") SELECT "id", "slug", "is_helpful", "comment", "created_at" FROM `docs_feedback`;--> statement-breakpoint
DROP TABLE `docs_feedback`;--> statement-breakpoint
ALTER TABLE `__new_docs_feedback` RENAME TO `docs_feedback`;--> statement-breakpoint
CREATE INDEX `idx_docs_feedback_slug` ON `docs_feedback` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_docs_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text,
	`category` text,
	`description` text,
	`content` text,
	`author_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_docs_history`("id", "slug", "title", "category", "description", "content", "author_email", "created_at") SELECT "id", "slug", "title", "category", "description", "content", "author_email", "created_at" FROM `docs_history`;--> statement-breakpoint
DROP TABLE `docs_history`;--> statement-breakpoint
ALTER TABLE `__new_docs_history` RENAME TO `docs_history`;--> statement-breakpoint
CREATE INDEX `idx_docs_history_slug_created` ON `docs_history` (`slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_docs_history_author` ON `docs_history` (`author_email`);--> statement-breakpoint
CREATE INDEX `idx_docs_history_slug` ON `docs_history` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bringing` text,
	`notes` text,
	`prep_hours` real,
	`attended` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_event_signups`("id", "event_id", "user_id", "bringing", "notes", "prep_hours", "attended", "created_at") SELECT "id", "event_id", "user_id", "bringing", "notes", "prep_hours", "attended", "created_at" FROM `event_signups`;--> statement-breakpoint
DROP TABLE `event_signups`;--> statement-breakpoint
ALTER TABLE `__new_event_signups` RENAME TO `event_signups`;--> statement-breakpoint
CREATE INDEX `idx_signups_user` ON `event_signups` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_signups_event` ON `event_signups` (`event_id`);--> statement-breakpoint
CREATE TABLE `__new_external_knowledge_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`branch` text,
	`status` text DEFAULT 'active',
	`last_indexed_sha` text,
	`last_indexed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_external_knowledge_sources`("id", "type", "url", "branch", "status", "last_indexed_sha", "last_indexed_at", "created_at") SELECT "id", "type", "url", "branch", "status", "last_indexed_sha", "last_indexed_at", "created_at" FROM `external_knowledge_sources`;--> statement-breakpoint
DROP TABLE `external_knowledge_sources`;--> statement-breakpoint
ALTER TABLE `__new_external_knowledge_sources` RENAME TO `external_knowledge_sources`;--> statement-breakpoint
CREATE TABLE `__new_inquiries` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`metadata` text,
	`status` text DEFAULT 'pending',
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`zulip_message_id` text,
	`notes` text
);
--> statement-breakpoint
INSERT INTO `__new_inquiries`("id", "type", "name", "email", "metadata", "status", "is_deleted", "created_at", "zulip_message_id", "notes") SELECT "id", "type", "name", "email", "metadata", "status", "is_deleted", "created_at", "zulip_message_id", "notes" FROM `inquiries`;--> statement-breakpoint
DROP TABLE `inquiries`;--> statement-breakpoint
ALTER TABLE `__new_inquiries` RENAME TO `inquiries`;--> statement-breakpoint
CREATE INDEX `idx_inquiries_type` ON `inquiries` (`type`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_created` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_status` ON `inquiries` (`status`);--> statement-breakpoint
CREATE TABLE `__new_judge_access_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`label` text DEFAULT 'Judge Access',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`expires_at` text
);
--> statement-breakpoint
INSERT INTO `__new_judge_access_codes`("id", "code", "label", "created_at", "expires_at") SELECT "id", "code", "label", "created_at", "expires_at" FROM `judge_access_codes`;--> statement-breakpoint
DROP TABLE `judge_access_codes`;--> statement-breakpoint
ALTER TABLE `__new_judge_access_codes` RENAME TO `judge_access_codes`;--> statement-breakpoint
CREATE INDEX `idx_judge_codes_code` ON `judge_access_codes` (`code`);--> statement-breakpoint
CREATE TABLE `__new_notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`priority` text DEFAULT 'low',
	`is_read` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_notifications`("id", "user_id", "title", "message", "link", "priority", "is_read", "created_at") SELECT "id", "user_id", "title", "message", "link", "priority", "is_read", "created_at" FROM `notifications`;--> statement-breakpoint
DROP TABLE `notifications`;--> statement-breakpoint
ALTER TABLE `__new_notifications` RENAME TO `notifications`;--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_orders` (
	`id` text PRIMARY KEY NOT NULL,
	`stripe_session_id` text,
	`customer_email` text,
	`shipping_name` text,
	`shipping_address_line1` text,
	`shipping_address_line2` text,
	`shipping_city` text,
	`shipping_state` text,
	`shipping_postal_code` text,
	`shipping_country` text,
	`total_cents` integer NOT NULL,
	`status` text DEFAULT 'processing',
	`fulfillment_status` text DEFAULT 'unfulfilled',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_orders`("id", "stripe_session_id", "customer_email", "shipping_name", "shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state", "shipping_postal_code", "shipping_country", "total_cents", "status", "fulfillment_status", "created_at", "updated_at") SELECT "id", "stripe_session_id", "customer_email", "shipping_name", "shipping_address_line1", "shipping_address_line2", "shipping_city", "shipping_state", "shipping_postal_code", "shipping_country", "total_cents", "status", "fulfillment_status", "created_at", "updated_at" FROM `orders`;--> statement-breakpoint
DROP TABLE `orders`;--> statement-breakpoint
ALTER TABLE `__new_orders` RENAME TO `orders`;--> statement-breakpoint
CREATE INDEX `idx_orders_email` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`,`fulfillment_status`);--> statement-breakpoint
CREATE TABLE `__new_outreach_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`location` text,
	`hours` integer,
	`people_reached` integer,
	`students_count` integer DEFAULT 0,
	`impact_summary` text,
	`cf_email` text,
	`is_mentoring` integer DEFAULT 0,
	`mentored_team_number` text,
	`metadata` text,
	`is_deleted` integer DEFAULT 0,
	`season_id` integer,
	`event_id` text,
	`mentor_count` integer DEFAULT 0,
	`mentor_hours` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_outreach_logs`("id", "title", "date", "location", "hours", "people_reached", "students_count", "impact_summary", "cf_email", "is_mentoring", "mentored_team_number", "metadata", "is_deleted", "season_id", "event_id", "mentor_count", "mentor_hours", "created_at") SELECT "id", "title", "date", "location", "hours", "people_reached", "students_count", "impact_summary", "cf_email", "is_mentoring", "mentored_team_number", "metadata", "is_deleted", "season_id", "event_id", "mentor_count", "mentor_hours", "created_at" FROM `outreach_logs`;--> statement-breakpoint
DROP TABLE `outreach_logs`;--> statement-breakpoint
ALTER TABLE `__new_outreach_logs` RENAME TO `outreach_logs`;--> statement-breakpoint
CREATE INDEX `idx_outreach_date_desc` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_date` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_season` ON `outreach_logs` (`season_id`);--> statement-breakpoint
CREATE TABLE `__new_page_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`path` text NOT NULL,
	`category` text DEFAULT 'system',
	`referrer` text,
	`user_agent` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_page_analytics`("id", "path", "category", "referrer", "user_agent", "timestamp") SELECT "id", "path", "category", "referrer", "user_agent", "timestamp" FROM `page_analytics`;--> statement-breakpoint
DROP TABLE `page_analytics`;--> statement-breakpoint
ALTER TABLE `__new_page_analytics` RENAME TO `page_analytics`;--> statement-breakpoint
CREATE INDEX `idx_analytics_path_time` ON `page_analytics` (`path`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_page_analytics_timestamp` ON `page_analytics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_page_analytics_path` ON `page_analytics` (`path`);--> statement-breakpoint
CREATE TABLE `__new_points_ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`points_delta` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_points_ledger`("id", "user_id", "points_delta", "reason", "created_by", "created_at") SELECT "id", "user_id", "points_delta", "reason", "created_by", "created_at" FROM `points_ledger`;--> statement-breakpoint
DROP TABLE `points_ledger`;--> statement-breakpoint
ALTER TABLE `__new_points_ledger` RENAME TO `points_ledger`;--> statement-breakpoint
CREATE INDEX `idx_points_ledger_user` ON `points_ledger` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_posts` (
	`slug` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text,
	`snippet` text,
	`thumbnail` text,
	`author` text,
	`cf_email` text,
	`ast` text NOT NULL,
	`content_draft` text,
	`is_deleted` integer DEFAULT 0,
	`status` text DEFAULT 'published',
	`revision_of` text,
	`published_at` text,
	`is_portfolio` integer DEFAULT 0,
	`season_id` integer,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`zulip_stream` text,
	`zulip_topic` text,
	`author_avatar` text,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_posts`("slug", "title", "date", "snippet", "thumbnail", "author", "cf_email", "ast", "content_draft", "is_deleted", "status", "revision_of", "published_at", "is_portfolio", "season_id", "updated_at", "zulip_stream", "zulip_topic", "author_avatar") SELECT "slug", "title", "date", "snippet", "thumbnail", "author", "cf_email", "ast", "content_draft", "is_deleted", "status", "revision_of", "published_at", "is_portfolio", "season_id", "updated_at", "zulip_stream", "zulip_topic", "author_avatar" FROM `posts`;--> statement-breakpoint
DROP TABLE `posts`;--> statement-breakpoint
ALTER TABLE `__new_posts` RENAME TO `posts`;--> statement-breakpoint
CREATE INDEX `idx_posts_published_at` ON `posts` (`published_at`,`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_posts_cf_email` ON `posts` (`cf_email`);--> statement-breakpoint
CREATE INDEX `idx_posts_author` ON `posts` (`author`);--> statement-breakpoint
CREATE INDEX `idx_posts_status` ON `posts` (`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_posts_date` ON `posts` (`date`);--> statement-breakpoint
CREATE INDEX `idx_posts_season` ON `posts` (`season_id`);--> statement-breakpoint
CREATE TABLE `__new_posts_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`thumbnail` text,
	`snippet` text,
	`ast` text NOT NULL,
	`author_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`season_id` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_posts_history`("id", "slug", "title", "author", "thumbnail", "snippet", "ast", "author_email", "created_at", "season_id") SELECT "id", "slug", "title", "author", "thumbnail", "snippet", "ast", "author_email", "created_at", "season_id" FROM `posts_history`;--> statement-breakpoint
DROP TABLE `posts_history`;--> statement-breakpoint
ALTER TABLE `__new_posts_history` RENAME TO `posts_history`;--> statement-breakpoint
CREATE INDEX `idx_posts_history_season` ON `posts_history` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_history_slug` ON `posts_history` (`slug`);--> statement-breakpoint
CREATE TABLE `__new_products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`image_url` text,
	`active` integer DEFAULT 1,
	`stock_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_products`("id", "name", "description", "price_cents", "image_url", "active", "stock_count", "created_at") SELECT "id", "name", "description", "price_cents", "image_url", "active", "stock_count", "created_at" FROM `products`;--> statement-breakpoint
DROP TABLE `products`;--> statement-breakpoint
ALTER TABLE `__new_products` RENAME TO `products`;--> statement-breakpoint
CREATE TABLE `__new_scouting_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`season_key` text NOT NULL,
	`event_key` text,
	`team_number` integer,
	`mode` text NOT NULL,
	`model` text NOT NULL,
	`markdown` text NOT NULL,
	`tokens_used` integer,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_scouting_analyses`("id", "season_key", "event_key", "team_number", "mode", "model", "markdown", "tokens_used", "created_by", "created_at") SELECT "id", "season_key", "event_key", "team_number", "mode", "model", "markdown", "tokens_used", "created_by", "created_at" FROM `scouting_analyses`;--> statement-breakpoint
DROP TABLE `scouting_analyses`;--> statement-breakpoint
ALTER TABLE `__new_scouting_analyses` RENAME TO `scouting_analyses`;--> statement-breakpoint
CREATE INDEX `idx_scouting_analyses_team` ON `scouting_analyses` (`team_number`);--> statement-breakpoint
CREATE INDEX `idx_scouting_analyses_event` ON `scouting_analyses` (`event_key`);--> statement-breakpoint
CREATE TABLE `__new_seasons` (
	`start_year` integer PRIMARY KEY NOT NULL,
	`end_year` integer,
	`challenge_name` text NOT NULL,
	`robot_name` text,
	`robot_image` text,
	`robot_description` text,
	`robot_cad_url` text,
	`summary` text,
	`album_url` text,
	`album_cover` text,
	`status` text DEFAULT 'published',
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_seasons`("start_year", "end_year", "challenge_name", "robot_name", "robot_image", "robot_description", "robot_cad_url", "summary", "album_url", "album_cover", "status", "is_deleted", "created_at", "updated_at") SELECT "start_year", "end_year", "challenge_name", "robot_name", "robot_image", "robot_description", "robot_cad_url", "summary", "album_url", "album_cover", "status", "is_deleted", "created_at", "updated_at" FROM `seasons`;--> statement-breakpoint
DROP TABLE `seasons`;--> statement-breakpoint
ALTER TABLE `__new_seasons` RENAME TO `seasons`;--> statement-breakpoint
CREATE TABLE `__new_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_settings`("key", "value", "updated_at") SELECT "key", "value", "updated_at" FROM `settings`;--> statement-breakpoint
DROP TABLE `settings`;--> statement-breakpoint
ALTER TABLE `__new_settings` RENAME TO `settings`;--> statement-breakpoint
CREATE INDEX `idx_settings_key` ON `settings` (`key`);--> statement-breakpoint
CREATE TABLE `__new_simulations` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`files` text NOT NULL,
	`author_id` text NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_simulations`("id", "name", "description", "files", "author_id", "is_public", "created_at", "updated_at") SELECT "id", "name", "description", "files", "author_id", "is_public", "created_at", "updated_at" FROM `simulations`;--> statement-breakpoint
DROP TABLE `simulations`;--> statement-breakpoint
ALTER TABLE `__new_simulations` RENAME TO `simulations`;--> statement-breakpoint
CREATE INDEX `idx_simulations_public` ON `simulations` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_simulations_author` ON `simulations` (`author_id`);--> statement-breakpoint
CREATE TABLE `__new_social_queue` (
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
--> statement-breakpoint
INSERT INTO `__new_social_queue`("id", "content", "media_urls", "scheduled_for", "platforms", "status", "created_at", "sent_at", "error_message", "created_by", "linked_type", "linked_id", "analytics") SELECT "id", "content", "media_urls", "scheduled_for", "platforms", "status", "created_at", "sent_at", "error_message", "created_by", "linked_type", "linked_id", "analytics" FROM `social_queue`;--> statement-breakpoint
DROP TABLE `social_queue`;--> statement-breakpoint
ALTER TABLE `__new_social_queue` RENAME TO `social_queue`;--> statement-breakpoint
CREATE TABLE `__new_sponsor_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`sponsor_id` text NOT NULL,
	`year_month` text NOT NULL,
	`impressions` integer DEFAULT 0,
	`clicks` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sponsor_metrics`("id", "sponsor_id", "year_month", "impressions", "clicks", "created_at") SELECT "id", "sponsor_id", "year_month", "impressions", "clicks", "created_at" FROM `sponsor_metrics`;--> statement-breakpoint
DROP TABLE `sponsor_metrics`;--> statement-breakpoint
ALTER TABLE `__new_sponsor_metrics` RENAME TO `sponsor_metrics`;--> statement-breakpoint
CREATE INDEX `idx_sponsor_metrics_sponsor` ON `sponsor_metrics` (`sponsor_id`);--> statement-breakpoint
CREATE TABLE `__new_sponsor_tokens` (
	`token` text PRIMARY KEY NOT NULL,
	`sponsor_id` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_sponsor_tokens`("token", "sponsor_id", "created_by", "created_at") SELECT "token", "sponsor_id", "created_by", "created_at" FROM `sponsor_tokens`;--> statement-breakpoint
DROP TABLE `sponsor_tokens`;--> statement-breakpoint
ALTER TABLE `__new_sponsor_tokens` RENAME TO `sponsor_tokens`;--> statement-breakpoint
CREATE INDEX `idx_sponsor_tokens_sponsor` ON `sponsor_tokens` (`sponsor_id`);--> statement-breakpoint
CREATE TABLE `__new_sponsors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`logo_url` text,
	`website_url` text,
	`is_active` integer DEFAULT 1,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
INSERT INTO `__new_sponsors`("id", "name", "tier", "logo_url", "website_url", "is_active", "created_at") SELECT "id", "name", "tier", "logo_url", "website_url", "is_active", "created_at" FROM `sponsors`;--> statement-breakpoint
DROP TABLE `sponsors`;--> statement-breakpoint
ALTER TABLE `__new_sponsors` RENAME TO `sponsors`;--> statement-breakpoint
CREATE TABLE `__new_sponsorship_pipeline` (
	`id` text PRIMARY KEY NOT NULL,
	`company_name` text NOT NULL,
	`contact_person` text,
	`status` text NOT NULL,
	`estimated_value` real,
	`season_id` integer,
	`notes` text,
	`zulip_message_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
INSERT INTO `__new_sponsorship_pipeline`("id", "company_name", "contact_person", "status", "estimated_value", "season_id", "notes", "zulip_message_id", "created_at") SELECT "id", "company_name", "contact_person", "status", "estimated_value", "season_id", "notes", "zulip_message_id", "created_at" FROM `sponsorship_pipeline`;--> statement-breakpoint
DROP TABLE `sponsorship_pipeline`;--> statement-breakpoint
ALTER TABLE `__new_sponsorship_pipeline` RENAME TO `sponsorship_pipeline`;--> statement-breakpoint
CREATE INDEX `idx_sponsorship_season` ON `sponsorship_pipeline` (`season_id`);--> statement-breakpoint
CREATE TABLE `__new_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo',
	`priority` text DEFAULT 'normal',
	`subteam` text,
	`sort_order` integer DEFAULT 0,
	`assigned_to` text,
	`parent_id` text,
	`time_spent_seconds` integer DEFAULT 0,
	`created_by` text NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_tasks`("id", "title", "description", "status", "priority", "subteam", "sort_order", "assigned_to", "parent_id", "time_spent_seconds", "created_by", "due_date", "created_at", "updated_at") SELECT "id", "title", "description", "status", "priority", "subteam", "sort_order", "assigned_to", "parent_id", "time_spent_seconds", "created_by", "due_date", "created_at", "updated_at" FROM `tasks`;--> statement-breakpoint
DROP TABLE `tasks`;--> statement-breakpoint
ALTER TABLE `__new_tasks` RENAME TO `tasks`;--> statement-breakpoint
CREATE INDEX `idx_tasks_sort` ON `tasks` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE TABLE `__new_user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`awarded_by` text,
	`awarded_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_badges`("id", "user_id", "badge_id", "awarded_by", "awarded_at") SELECT "id", "user_id", "badge_id", "awarded_by", "awarded_at" FROM `user_badges`;--> statement-breakpoint
DROP TABLE `user_badges`;--> statement-breakpoint
ALTER TABLE `__new_user_badges` RENAME TO `user_badges`;--> statement-breakpoint
CREATE INDEX `idx_user_badges_badge` ON `user_badges` (`badge_id`);--> statement-breakpoint
CREATE INDEX `idx_user_badges_user` ON `user_badges` (`user_id`);--> statement-breakpoint
CREATE TABLE `__new_user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`first_name` text,
	`last_name` text,
	`nickname` text,
	`phone` text,
	`contact_email` text,
	`show_email` integer DEFAULT 0,
	`show_phone` integer DEFAULT 0,
	`pronouns` text,
	`grade_year` text,
	`subteams` text DEFAULT '[]',
	`member_type` text DEFAULT 'student',
	`bio` text,
	`favorite_food` text,
	`dietary_restrictions` text,
	`favorite_first_thing` text,
	`fun_fact` text,
	`colleges` text DEFAULT '[]',
	`employers` text DEFAULT '[]',
	`show_on_about` integer DEFAULT 1,
	`favorite_robot_mechanism` text,
	`pre_match_superstition` text,
	`leadership_role` text,
	`rookie_year` text,
	`tshirt_size` text,
	`emergency_contact_name` text,
	`emergency_contact_phone` text,
	`parents_name` text,
	`parents_email` text,
	`students_name` text,
	`students_email` text,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_user_profiles`("user_id", "first_name", "last_name", "nickname", "phone", "contact_email", "show_email", "show_phone", "pronouns", "grade_year", "subteams", "member_type", "bio", "favorite_food", "dietary_restrictions", "favorite_first_thing", "fun_fact", "colleges", "employers", "show_on_about", "favorite_robot_mechanism", "pre_match_superstition", "leadership_role", "rookie_year", "tshirt_size", "emergency_contact_name", "emergency_contact_phone", "parents_name", "parents_email", "students_name", "students_email", "updated_at") SELECT "user_id", "first_name", "last_name", "nickname", "phone", "contact_email", "show_email", "show_phone", "pronouns", "grade_year", "subteams", "member_type", "bio", "favorite_food", "dietary_restrictions", "favorite_first_thing", "fun_fact", "colleges", "employers", "show_on_about", "favorite_robot_mechanism", "pre_match_superstition", "leadership_role", "rookie_year", "tshirt_size", "emergency_contact_name", "emergency_contact_phone", "parents_name", "parents_email", "students_name", "students_email", "updated_at" FROM `user_profiles`;--> statement-breakpoint
DROP TABLE `user_profiles`;--> statement-breakpoint
ALTER TABLE `__new_user_profiles` RENAME TO `user_profiles`;--> statement-breakpoint
CREATE INDEX `idx_user_profiles_show_on_about` ON `user_profiles` (`show_on_about`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_member_type` ON `user_profiles` (`member_type`);