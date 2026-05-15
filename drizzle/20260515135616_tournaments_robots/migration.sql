CREATE TABLE `robots` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`season_id` integer,
	`ast` text,
	`album_id` text,
	`onshape_url` text,
	`cad_viewer_url` text,
	`reveal_video_id` text,
	`weight_lbs` real,
	`drivetrain_type` text,
	`programming_language` text,
	`primary_mechanism` text,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE TABLE `tournaments` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`season_id` integer,
	`robot_id` text,
	`ftc_event_code` text,
	`ast` text,
	`album_id` text,
	`start_date` text,
	`end_date` text,
	`location` text,
	`rank` integer,
	`alliance_role` text,
	`elimination_status` text,
	`opr` real,
	`is_deleted` integer DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`robot_id`) REFERENCES `robots`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`album_id`) REFERENCES `albums`(`id`) ON UPDATE no action ON DELETE set null
);

CREATE INDEX `idx_tournaments_season` ON `tournaments` (`season_id`);
CREATE INDEX `idx_tournaments_robot` ON `tournaments` (`robot_id`);

CREATE TABLE `tournament_matches` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`match_number` integer NOT NULL,
	`match_type` text NOT NULL,
	`red_score` integer,
	`blue_score` integer,
	`youtube_video_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_tournament_matches_tournament` ON `tournament_matches` (`tournament_id`);

CREATE TABLE `tournament_awards` (
	`id` text PRIMARY KEY NOT NULL,
	`tournament_id` text NOT NULL,
	`name` text NOT NULL,
	`placement` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	FOREIGN KEY (`tournament_id`) REFERENCES `tournaments`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE INDEX `idx_tournament_awards_tournament` ON `tournament_awards` (`tournament_id`);