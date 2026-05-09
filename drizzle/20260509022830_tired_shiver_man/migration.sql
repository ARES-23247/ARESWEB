CREATE TABLE `account` (
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
	CONSTRAINT `fk_account_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`details` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`event_name` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`icon_type` text DEFAULT 'trophy',
	`is_deleted` integer DEFAULT 0,
	`season_id` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_awards_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `badges` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`icon` text DEFAULT 'Award',
	`color_theme` text DEFAULT 'ares-gold',
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `chat_sessions` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`history` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_chat_sessions_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `comments` (
	`id` text PRIMARY KEY,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`user_id` text NOT NULL,
	`content` text NOT NULL,
	`zulip_message_id` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_comments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `docs` (
	`slug` text PRIMARY KEY,
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
CREATE TABLE `docs_feedback` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`is_helpful` integer,
	`comment` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_docs_feedback_slug_docs_slug_fk` FOREIGN KEY (`slug`) REFERENCES `docs`(`slug`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `docs_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`title` text,
	`category` text,
	`description` text,
	`content` text,
	`author_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_docs_history_slug_docs_slug_fk` FOREIGN KEY (`slug`) REFERENCES `docs`(`slug`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `document_contributors` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`room_id` text NOT NULL,
	`user_id` text NOT NULL,
	`user_name` text NOT NULL,
	`user_avatar` text,
	`last_contributed_at` real DEFAULT (CURRENT_TIMESTAMP),
	CONSTRAINT `fk_document_contributors_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `document_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`room_id` text NOT NULL,
	`content` text NOT NULL,
	`created_by` text,
	`created_at` real DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `document_snapshots` (
	`room_id` text PRIMARY KEY,
	`state` blob NOT NULL,
	`updated_at` real DEFAULT (CURRENT_TIMESTAMP)
);
--> statement-breakpoint
CREATE TABLE `entity_links` (
	`id` text PRIMARY KEY,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`link_type` text
);
--> statement-breakpoint
CREATE TABLE `event_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`event_id` text NOT NULL,
	`user_id` text NOT NULL,
	`bringing` text,
	`notes` text,
	`prep_hours` real,
	`attended` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_event_signups_event_id_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_event_signups_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `events` (
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
	`updated_at` text,
	CONSTRAINT `fk_events_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `external_knowledge_sources` (
	`id` text PRIMARY KEY,
	`type` text NOT NULL,
	`url` text NOT NULL,
	`branch` text,
	`status` text DEFAULT 'active',
	`last_indexed_sha` text,
	`last_indexed_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `finance_transactions` (
	`id` text PRIMARY KEY,
	`amount` real NOT NULL,
	`type` text NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`description` text,
	`receipt_url` text,
	`season_id` integer,
	`logged_by` text,
	CONSTRAINT `fk_finance_transactions_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `inquiries` (
	`id` text PRIMARY KEY,
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
CREATE TABLE `judge_access_codes` (
	`id` text PRIMARY KEY,
	`code` text NOT NULL,
	`label` text DEFAULT 'Judge Access',
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`expires_at` text
);
--> statement-breakpoint
CREATE TABLE `locations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`address` text,
	`maps_url` text,
	`is_deleted` integer DEFAULT 0
);
--> statement-breakpoint
CREATE TABLE `media_tags` (
	`key` text PRIMARY KEY,
	`folder` text DEFAULT 'Library',
	`tags` text
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`priority` text DEFAULT 'low',
	`is_read` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_notifications_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `orders` (
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `outreach_logs` (
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
	`event_id` text,
	`mentor_count` integer DEFAULT 0,
	`mentor_hours` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_outreach_logs_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `page_analytics` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`path` text NOT NULL,
	`category` text DEFAULT 'system',
	`referrer` text,
	`user_agent` text,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `performance_metrics` (
	`id` text PRIMARY KEY,
	`metric_name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`page` text NOT NULL,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `points_ledger` (
	`id` text PRIMARY KEY,
	`user_id` text NOT NULL,
	`points_delta` integer NOT NULL,
	`reason` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_points_ledger_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_points_ledger_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `posts` (
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	`zulip_stream` text,
	`zulip_topic` text,
	`author_avatar` text,
	CONSTRAINT `fk_posts_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `posts_history` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`author` text,
	`thumbnail` text,
	`snippet` text,
	`ast` text NOT NULL,
	`author_email` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`season_id` integer,
	CONSTRAINT `fk_posts_history_slug_posts_slug_fk` FOREIGN KEY (`slug`) REFERENCES `posts`(`slug`) ON DELETE CASCADE,
	CONSTRAINT `fk_posts_history_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`price_cents` integer NOT NULL,
	`image_url` text,
	`active` integer DEFAULT 1,
	`stock_count` integer,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`ip` text PRIMARY KEY,
	`count` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `scouting_analyses` (
	`id` text PRIMARY KEY,
	`season_key` text NOT NULL,
	`event_key` text,
	`team_number` integer,
	`mode` text NOT NULL,
	`model` text NOT NULL,
	`markdown` text NOT NULL,
	`tokens_used` integer,
	`created_by` text NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_scouting_analyses_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `seasons` (
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
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	CONSTRAINT `fk_session_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `simulations` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`description` text,
	`files` text NOT NULL,
	`author_id` text NOT NULL,
	`is_public` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `fk_simulations_author_id_user_id_fk` FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `social_queue` (
	`id` text PRIMARY KEY,
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
	CONSTRAINT `fk_social_queue_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `sponsor_metrics` (
	`id` text PRIMARY KEY,
	`sponsor_id` text NOT NULL,
	`year_month` text NOT NULL,
	`impressions` integer DEFAULT 0,
	`clicks` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_sponsor_metrics_sponsor_id_sponsors_id_fk` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sponsor_tokens` (
	`token` text PRIMARY KEY,
	`sponsor_id` text NOT NULL,
	`created_by` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_sponsor_tokens_sponsor_id_sponsors_id_fk` FOREIGN KEY (`sponsor_id`) REFERENCES `sponsors`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sponsors` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`tier` text NOT NULL,
	`logo_url` text,
	`website_url` text,
	`is_active` integer DEFAULT 1,
	`created_at` text DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE `sponsorship_assignments` (
	`sponsorship_id` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `sponsorship_assignments_sponsorship_id_user_id_pk` PRIMARY KEY(`sponsorship_id`, `user_id`),
	CONSTRAINT `fk_sponsorship_assignments_sponsorship_id_sponsorship_pipeline_id_fk` FOREIGN KEY (`sponsorship_id`) REFERENCES `sponsorship_pipeline`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_sponsorship_assignments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `sponsorship_pipeline` (
	`id` text PRIMARY KEY,
	`company_name` text NOT NULL,
	`contact_person` text,
	`status` text NOT NULL,
	`estimated_value` real,
	`season_id` integer,
	`notes` text,
	`zulip_message_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_sponsorship_pipeline_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
CREATE TABLE `task_assignments` (
	`task_id` text NOT NULL,
	`user_id` text NOT NULL,
	CONSTRAINT `task_assignments_task_id_user_id_pk` PRIMARY KEY(`task_id`, `user_id`),
	CONSTRAINT `fk_task_assignments_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_task_assignments_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` text PRIMARY KEY,
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
	CONSTRAINT `fk_tasks_created_by_user_id_fk` FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `usage_metrics` (
	`id` text PRIMARY KEY,
	`timestamp` text DEFAULT CURRENT_TIMESTAMP,
	`endpoint` text NOT NULL,
	`method` text NOT NULL,
	`status_code` integer NOT NULL,
	`latency_ms` integer NOT NULL,
	`user_id` text,
	`cf_ray` text,
	`cf_ip` text
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
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
CREATE TABLE `user_badges` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`awarded_by` text,
	`awarded_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_user_badges_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_user_badges_badge_id_badges_id_fk` FOREIGN KEY (`badge_id`) REFERENCES `badges`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user_profiles` (
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
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_user_profiles_user_id_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
CREATE INDEX `idx_account_userId` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_created_at` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_actor` ON `audit_log` (`actor`);--> statement-breakpoint
CREATE INDEX `idx_awards_date` ON `awards` (`date`);--> statement-breakpoint
CREATE INDEX `idx_awards_season` ON `awards` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_updated_at` ON `chat_sessions` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_chat_sessions_user_id` ON `chat_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_is_deleted` ON `comments` (`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_comments_created` ON `comments` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_comments_user` ON `comments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_comments_target` ON `comments` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_docs_category_sort` ON `docs` (`category`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_docs_status_deleted` ON `docs` (`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_docs_category` ON `docs` (`category`);--> statement-breakpoint
CREATE INDEX `idx_docs_feedback_slug` ON `docs_feedback` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_docs_history_slug_created` ON `docs_history` (`slug`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_docs_history_author` ON `docs_history` (`author_email`);--> statement-breakpoint
CREATE INDEX `idx_docs_history_slug` ON `docs_history` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_document_history_room` ON `document_history` (`room_id`);--> statement-breakpoint
CREATE INDEX `idx_document_snapshots_updated` ON `document_snapshots` (`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_entity_links_target` ON `entity_links` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `idx_entity_links_source` ON `entity_links` (`source_type`,`source_id`);--> statement-breakpoint
CREATE INDEX `idx_signups_user` ON `event_signups` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_signups_event` ON `event_signups` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_events_category` ON `events` (`category`);--> statement-breakpoint
CREATE INDEX `idx_events_visibility` ON `events` (`is_deleted`,`status`,`published_at`,`date_start`);--> statement-breakpoint
CREATE INDEX `idx_events_date` ON `events` (`date_start`);--> statement-breakpoint
CREATE INDEX `idx_events_status` ON `events` (`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_events_season` ON `events` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_finance_tx_season` ON `finance_transactions` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_type` ON `inquiries` (`type`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_created` ON `inquiries` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_inquiries_status` ON `inquiries` (`status`);--> statement-breakpoint
CREATE INDEX `idx_judge_codes_code` ON `judge_access_codes` (`code`);--> statement-breakpoint
CREATE INDEX `idx_notifications_user_id` ON `notifications` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_orders_email` ON `orders` (`customer_email`);--> statement-breakpoint
CREATE INDEX `idx_orders_status` ON `orders` (`status`,`fulfillment_status`);--> statement-breakpoint
CREATE INDEX `idx_outreach_date_desc` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_date` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_season` ON `outreach_logs` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_analytics_path_time` ON `page_analytics` (`path`,`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_page_analytics_timestamp` ON `page_analytics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_page_analytics_path` ON `page_analytics` (`path`);--> statement-breakpoint
CREATE INDEX `idx_points_ledger_user` ON `points_ledger` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_published_at` ON `posts` (`published_at`,`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_posts_cf_email` ON `posts` (`cf_email`);--> statement-breakpoint
CREATE INDEX `idx_posts_author` ON `posts` (`author`);--> statement-breakpoint
CREATE INDEX `idx_posts_status` ON `posts` (`status`,`is_deleted`);--> statement-breakpoint
CREATE INDEX `idx_posts_date` ON `posts` (`date`);--> statement-breakpoint
CREATE INDEX `idx_posts_season` ON `posts` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_history_season` ON `posts_history` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_posts_history_slug` ON `posts_history` (`slug`);--> statement-breakpoint
CREATE INDEX `idx_scouting_analyses_team` ON `scouting_analyses` (`team_number`);--> statement-breakpoint
CREATE INDEX `idx_scouting_analyses_event` ON `scouting_analyses` (`event_key`);--> statement-breakpoint
CREATE INDEX `idx_session_userId` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `idx_settings_key` ON `settings` (`key`);--> statement-breakpoint
CREATE INDEX `idx_simulations_public` ON `simulations` (`is_public`);--> statement-breakpoint
CREATE INDEX `idx_simulations_author` ON `simulations` (`author_id`);--> statement-breakpoint
CREATE INDEX `idx_sponsor_metrics_sponsor` ON `sponsor_metrics` (`sponsor_id`);--> statement-breakpoint
CREATE INDEX `idx_sponsor_tokens_sponsor` ON `sponsor_tokens` (`sponsor_id`);--> statement-breakpoint
CREATE INDEX `idx_sponsorship_season` ON `sponsorship_pipeline` (`season_id`);--> statement-breakpoint
CREATE INDEX `idx_task_assignments_user` ON `task_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_tasks_sort` ON `tasks` (`status`,`sort_order`);--> statement-breakpoint
CREATE INDEX `idx_tasks_status` ON `tasks` (`status`);--> statement-breakpoint
CREATE INDEX `idx_usage_metrics_timestamp` ON `usage_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX `idx_usage_metrics_endpoint` ON `usage_metrics` (`endpoint`);--> statement-breakpoint
CREATE INDEX `idx_user_role` ON `user` (`role`);--> statement-breakpoint
CREATE INDEX `idx_user_email` ON `user` (`email`);--> statement-breakpoint
CREATE INDEX `idx_user_badges_badge` ON `user_badges` (`badge_id`);--> statement-breakpoint
CREATE INDEX `idx_user_badges_user` ON `user_badges` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_show_on_about` ON `user_profiles` (`show_on_about`);--> statement-breakpoint
CREATE INDEX `idx_user_profiles_member_type` ON `user_profiles` (`member_type`);