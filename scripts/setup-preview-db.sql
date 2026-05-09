DROP TABLE IF EXISTS d1_migrations;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;
DROP TABLE IF EXISTS $_;


-- Current sql file was generated after introspecting the database
-- If you want to run this migration please uncomment this code before executing migrations

CREATE TABLE IF NOT EXISTS `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` numeric NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`role` text DEFAULT 'user',
	`twoFactorEnabled` integer DEFAULT 0,
	`twoFactorSecret` text,
	`twoFactorBackupCodes` text
);

CREATE INDEX IF NOT EXISTS `idx_user_role` ON `user` (`role`);
CREATE INDEX IF NOT EXISTS `idx_user_email` ON `user` (`email`);
CREATE TABLE IF NOT EXISTS `session` (
	`id` text PRIMARY KEY,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_session_userId` ON `session` (`userId`);
CREATE TABLE IF NOT EXISTS `account` (
	`id` text PRIMARY KEY,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_account_userId` ON `account` (`userId`);
CREATE TABLE IF NOT EXISTS `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);

CREATE TABLE IF NOT EXISTS `posts` (
	`slug` text PRIMARY KEY,
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
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_posts_published_at` ON `posts` (`published_at`,`status`,`is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_posts_cf_email` ON `posts` (`cf_email`);
CREATE INDEX IF NOT EXISTS `idx_posts_author` ON `posts` (`author`);
CREATE INDEX IF NOT EXISTS `idx_posts_status` ON `posts` (`status`,`is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_posts_date` ON `posts` (`date`);
CREATE INDEX IF NOT EXISTS `idx_posts_season` ON `posts` (`season_id`);
CREATE TABLE IF NOT EXISTS `posts_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`thumbnail` text,
	`snippet` text,
	`ast` text NOT NULL,
	`author_email` text,
	`created_at` text DEFAULT (datetime('now')),
	`season_id` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_posts_history_season` ON `posts_history` (`season_id`);
CREATE INDEX IF NOT EXISTS `idx_posts_history_slug` ON `posts_history` (`slug`);
CREATE TABLE IF NOT EXISTS `events` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`date_start` text NOT NULL,
	`date_end` text,
	`location` text,
	`description` text,
	`content_draft` text,
	`cover_image` text,
	`gcal_event_id` text,
	`tba_event_key` text,
	`is_deleted` integer DEFAULT 0,
	`status` text DEFAULT 'published',
	`category` text DEFAULT 'internal',
	`is_potluck` integer DEFAULT 0,
	`is_volunteer` integer DEFAULT 0,
	`revision_of` text,
	`published_at` text,
	`meeting_notes` text,
	`season_id` integer,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_events_category` ON `events` (`category`);
CREATE INDEX IF NOT EXISTS `idx_events_visibility` ON `events` (`is_deleted`,`status`,`published_at`,`date_start`);
CREATE INDEX IF NOT EXISTS `idx_events_date` ON `events` (`date_start`);
CREATE INDEX IF NOT EXISTS `idx_events_status` ON `events` (`status`,`is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_events_season` ON `events` (`season_id`);
CREATE TABLE IF NOT EXISTS `seasons` (
	`start_year` integer PRIMARY KEY,
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
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bringing` text,
	`notes` text,
	`prep_hours` real DEFAULT 0,
	`attended` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_signups_user` ON `event_signups` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_signups_event` ON `event_signups` (`event_id`);
CREATE TABLE IF NOT EXISTS `docs` (
	`slug` text PRIMARY KEY,
	`title` text NOT NULL,
	`category` text NOT NULL,
	`sort_order` integer DEFAULT 0,
	`description` text,
	`content` text NOT NULL,
	`content_draft` text,
	`cf_email` text,
	`updated_at` text DEFAULT (datetime('now')),
	`is_deleted` integer DEFAULT 0,
	`status` text DEFAULT 'published',
	`is_portfolio` integer DEFAULT 0,
	`is_executive_summary` integer DEFAULT 0,
	`display_in_areslib` integer DEFAULT 0,
	`display_in_math_corner` integer DEFAULT 0,
	`display_in_science_corner` integer DEFAULT 0,
	`revision_of` text
);

CREATE INDEX IF NOT EXISTS `idx_docs_category_sort` ON `docs` (`category`,`sort_order`);
CREATE INDEX IF NOT EXISTS `idx_docs_status_deleted` ON `docs` (`status`,`is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_docs_category` ON `docs` (`category`);
CREATE TABLE IF NOT EXISTS `docs_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`title` text,
	`category` text,
	`description` text,
	`content` text,
	`author_email` text,
	`created_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_docs_history_slug_created` ON `docs_history` (`slug`,`created_at`);
CREATE INDEX IF NOT EXISTS `idx_docs_history_author` ON `docs_history` (`author_email`);
CREATE INDEX IF NOT EXISTS `idx_docs_history_slug` ON `docs_history` (`slug`);
CREATE TABLE IF NOT EXISTS `document_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`room_id` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text,
	`created_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS `idx_document_history_room` ON `document_history` (`room_id`);
CREATE TABLE IF NOT EXISTS `document_contributors` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_avatar` text,
	`last_contributed_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);

CREATE TABLE IF NOT EXISTS `docs_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`is_helpful` integer,
	`comment` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`slug`) REFERENCES `docs`(`slug`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_docs_feedback_slug` ON `docs_feedback` (`slug`);
CREATE TABLE IF NOT EXISTS `user_profiles` (
	`user_id` text PRIMARY KEY,
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
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_user_profiles_show_on_about` ON `user_profiles` (`show_on_about`);
CREATE INDEX IF NOT EXISTS `idx_user_profiles_member_type` ON `user_profiles` (`member_type`);
CREATE TABLE IF NOT EXISTS `badges` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'Award',
	`color_theme` text DEFAULT 'ares-gold',
	`created_at` text DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`awarded_by` text,
	`awarded_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_user_badges_badge` ON `user_badges` (`badge_id`);
CREATE INDEX IF NOT EXISTS `idx_user_badges_user` ON `user_badges` (`user_id`);
CREATE TABLE IF NOT EXISTS `sponsors` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`logo_url` text,
	`website_url` text,
	`is_active` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `sponsor_metrics` (
	`id` text PRIMARY KEY,
	`sponsor_id` text NOT NULL,
	`year_month` text NOT NULL,
	`impressions` integer DEFAULT 0,
	`clicks` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_sponsor_metrics_sponsor` ON `sponsor_metrics` (`sponsor_id`);
CREATE TABLE IF NOT EXISTS `sponsor_tokens` (
	`token` text PRIMARY KEY,
	`sponsor_id` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_sponsor_tokens_sponsor` ON `sponsor_tokens` (`sponsor_id`);
CREATE TABLE IF NOT EXISTS `inquiries` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`metadata` text,
	`status` text DEFAULT 'pending',
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`zulip_message_id` text,
	`notes` text
);

CREATE INDEX IF NOT EXISTS `idx_inquiries_type` ON `inquiries` (`type`);
CREATE INDEX IF NOT EXISTS `idx_inquiries_created` ON `inquiries` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_inquiries_status` ON `inquiries` (`status`);
CREATE TABLE IF NOT EXISTS `locations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`address` text,
	`maps_url` text,
	`is_deleted` integer DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`event_name` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`icon_type` text DEFAULT 'trophy',
	`is_deleted` integer DEFAULT 0,
	`season_id` integer,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_awards_date` ON `awards` (`date`);
CREATE INDEX IF NOT EXISTS `idx_awards_season` ON `awards` (`season_id`);
CREATE TABLE IF NOT EXISTS `outreach_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
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
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_outreach_date_desc` ON `outreach_logs` (`date`);
CREATE INDEX IF NOT EXISTS `idx_outreach_date` ON `outreach_logs` (`date`);
CREATE INDEX IF NOT EXISTS `idx_outreach_season` ON `outreach_logs` (`season_id`);
CREATE TABLE IF NOT EXISTS `comments` (
	`id` text PRIMARY KEY,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`zulip_message_id` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_comments_is_deleted` ON `comments` (`is_deleted`);
CREATE INDEX IF NOT EXISTS `idx_comments_created` ON `comments` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_comments_user` ON `comments` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_comments_target` ON `comments` (`target_type`,`target_id`);
CREATE TABLE IF NOT EXISTS `notifications` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`priority` text DEFAULT 'low',
	`is_read` integer DEFAULT 0,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_notifications_user_id` ON `notifications` (`user_id`);
CREATE TABLE IF NOT EXISTS `page_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`path` text NOT NULL,
	`category` text DEFAULT 'system',
	`referrer` text,
	`user_agent` text,
	`timestamp` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_analytics_path_time` ON `page_analytics` (`path`,`timestamp`);
CREATE INDEX IF NOT EXISTS `idx_page_analytics_timestamp` ON `page_analytics` (`timestamp`);
CREATE INDEX IF NOT EXISTS `idx_page_analytics_path` ON `page_analytics` (`path`);
CREATE TABLE IF NOT EXISTS `media_tags` (
	`key` text PRIMARY KEY,
	`folder` text DEFAULT 'Library',
	`tags` text
);

CREATE TABLE IF NOT EXISTS `judge_access_codes` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`label` text DEFAULT 'Judge Access',
	`created_at` text DEFAULT (datetime('now')),
	`expires_at` text
);

CREATE INDEX IF NOT EXISTS `idx_judge_codes_code` ON `judge_access_codes` (`code`);
CREATE TABLE IF NOT EXISTS `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updated_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_settings_key` ON `settings` (`key`);
CREATE TABLE IF NOT EXISTS `tasks` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'todo',
	`priority` text DEFAULT 'normal',
	`subteam` text,
	`sort_order` integer DEFAULT 0,
	`assigned_to` text,
	`created_by` text NOT NULL,
	`due_date` text,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_tasks_sort` ON `tasks` (`status`,`sort_order`);
CREATE INDEX IF NOT EXISTS `idx_tasks_status` ON `tasks` (`status`);
CREATE TABLE IF NOT EXISTS `task_assignments` (
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`task_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_task_assignments_user` ON `task_assignments` (`user_id`);
CREATE TABLE IF NOT EXISTS `audit_log` (
	`id` text PRIMARY KEY,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`created_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_audit_log_created_at` ON `audit_log` (`created_at`);
CREATE INDEX IF NOT EXISTS `idx_audit_log_action` ON `audit_log` (`action`);
CREATE INDEX IF NOT EXISTS `idx_audit_log_actor` ON `audit_log` (`actor`);
CREATE TABLE IF NOT EXISTS `docs_fts` (
	`slug` numeric,
	`title` numeric,
	`category` numeric,
	`description` numeric,
	`content` numeric,
	`status` numeric,
	`is_deleted` numeric,
	`docs_fts` numeric,
	`rank` numeric
);

CREATE TABLE IF NOT EXISTS `docs_fts_data` (
	`id` integer PRIMARY KEY,
	`block` blob
);

CREATE TABLE IF NOT EXISTS `docs_fts_idx` (
	`segid` numeric NOT NULL,
	`term` numeric NOT NULL,
	`pgno` numeric,
	PRIMARY KEY(`segid`, `term`)
);

CREATE TABLE IF NOT EXISTS `docs_fts_content` (
	`id` integer PRIMARY KEY,
	`c0` numeric,
	`c1` numeric,
	`c2` numeric,
	`c3` numeric,
	`c4` numeric,
	`c5` numeric,
	`c6` numeric
);

CREATE TABLE IF NOT EXISTS `docs_fts_docsize` (
	`id` integer PRIMARY KEY,
	`sz` blob
);

CREATE TABLE IF NOT EXISTS `docs_fts_config` (
	`k` numeric PRIMARY KEY NOT NULL,
	`v` numeric
);

CREATE TABLE IF NOT EXISTS `posts_fts` (
	`slug` numeric,
	`title` numeric,
	`snippet` numeric,
	`author` numeric,
	`ast` numeric,
	`posts_fts` numeric,
	`rank` numeric
);

CREATE TABLE IF NOT EXISTS `posts_fts_data` (
	`id` integer PRIMARY KEY,
	`block` blob
);

CREATE TABLE IF NOT EXISTS `posts_fts_idx` (
	`segid` numeric NOT NULL,
	`term` numeric NOT NULL,
	`pgno` numeric,
	PRIMARY KEY(`segid`, `term`)
);

CREATE TABLE IF NOT EXISTS `posts_fts_content` (
	`id` integer PRIMARY KEY,
	`c0` numeric,
	`c1` numeric,
	`c2` numeric,
	`c3` numeric,
	`c4` numeric
);

CREATE TABLE IF NOT EXISTS `posts_fts_docsize` (
	`id` integer PRIMARY KEY,
	`sz` blob
);

CREATE TABLE IF NOT EXISTS `posts_fts_config` (
	`k` numeric PRIMARY KEY NOT NULL,
	`v` numeric
);

CREATE TABLE IF NOT EXISTS `events_fts` (
	`id` numeric,
	`title` numeric,
	`description` numeric,
	`location` numeric,
	`status` numeric,
	`is_deleted` numeric,
	`events_fts` numeric,
	`rank` numeric
);

CREATE TABLE IF NOT EXISTS `events_fts_data` (
	`id` integer PRIMARY KEY,
	`block` blob
);

CREATE TABLE IF NOT EXISTS `events_fts_idx` (
	`segid` numeric NOT NULL,
	`term` numeric NOT NULL,
	`pgno` numeric,
	PRIMARY KEY(`segid`, `term`)
);

CREATE TABLE IF NOT EXISTS `events_fts_content` (
	`id` integer PRIMARY KEY,
	`c0` numeric,
	`c1` numeric,
	`c2` numeric,
	`c3` numeric,
	`c4` numeric,
	`c5` numeric
);

CREATE TABLE IF NOT EXISTS `events_fts_docsize` (
	`id` integer PRIMARY KEY,
	`sz` blob
);

CREATE TABLE IF NOT EXISTS `events_fts_config` (
	`k` numeric PRIMARY KEY NOT NULL,
	`v` numeric
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts` (
	`user_id` numeric,
	`nickname` numeric,
	`first_name` numeric,
	`last_name` numeric,
	`bio` numeric,
	`show_on_about` numeric,
	`user_profiles_fts` numeric,
	`rank` numeric
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts_data` (
	`id` integer PRIMARY KEY,
	`block` blob
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts_idx` (
	`segid` numeric NOT NULL,
	`term` numeric NOT NULL,
	`pgno` numeric,
	PRIMARY KEY(`segid`, `term`)
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts_content` (
	`id` integer PRIMARY KEY,
	`c0` numeric,
	`c1` numeric,
	`c2` numeric,
	`c3` numeric,
	`c4` numeric,
	`c5` numeric
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts_docsize` (
	`id` integer PRIMARY KEY,
	`sz` blob
);

CREATE TABLE IF NOT EXISTS `user_profiles_fts_config` (
	`k` numeric PRIMARY KEY NOT NULL,
	`v` numeric
);

CREATE TABLE IF NOT EXISTS `products` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`image_url` text,
	`active` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS `orders` (
	`id` text PRIMARY KEY,
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
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS `idx_orders_email` ON `orders` (`customer_email`);
CREATE INDEX IF NOT EXISTS `idx_orders_status` ON `orders` (`status`,`fulfillment_status`);
CREATE TABLE IF NOT EXISTS `rate_limits` (
	`ip` text PRIMARY KEY,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);

CREATE TABLE IF NOT EXISTS `chat_sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`history` text NOT NULL,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);
CREATE INDEX IF NOT EXISTS `idx_chat_sessions_user_id` ON `chat_sessions` (`user_id`);
CREATE TABLE IF NOT EXISTS `entity_links` (
	`id` text PRIMARY KEY,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`link_type` text
);

CREATE INDEX IF NOT EXISTS `idx_entity_links_target` ON `entity_links` (`target_type`,`target_id`);
CREATE INDEX IF NOT EXISTS `idx_entity_links_source` ON `entity_links` (`source_type`,`source_id`);
CREATE TABLE IF NOT EXISTS `finance_transactions` (
	`id` text PRIMARY KEY,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`receipt_url` text,
	`season_id` integer,
	`logged_by` text,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_finance_tx_season` ON `finance_transactions` (`season_id`);
CREATE TABLE IF NOT EXISTS `sponsorship_pipeline` (
	`id` text PRIMARY KEY,
	`company_name` text NOT NULL,
	`contact_person` text,
	`status` text NOT NULL,
	`estimated_value` real DEFAULT 0,
	`season_id` integer,
	`notes` text,
	`zulip_message_id` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX IF NOT EXISTS `idx_sponsorship_season` ON `sponsorship_pipeline` (`season_id`);
CREATE TABLE IF NOT EXISTS `sponsorship_assignments` (
	`sponsorship_id` text NOT NULL,
	`user_id` text NOT NULL,
	PRIMARY KEY(`sponsorship_id`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorship_pipeline`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE TABLE IF NOT EXISTS `document_snapshots` (
	`room_id` text PRIMARY KEY,
	`state` blob NOT NULL,
	`updated_at` numeric DEFAULT (CURRENT_TIMESTAMP)
);

CREATE INDEX IF NOT EXISTS `idx_document_snapshots_updated` ON `document_snapshots` (`updated_at`);
CREATE TABLE IF NOT EXISTS `simulations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`files` text NOT NULL,
	`author_id` text NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX IF NOT EXISTS `idx_simulations_public` ON `simulations` (`is_public`);
CREATE INDEX IF NOT EXISTS `idx_simulations_author` ON `simulations` (`author_id`);



SELECT 1;



