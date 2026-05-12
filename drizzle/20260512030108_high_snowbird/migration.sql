PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_outreach_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`location` text,
	`hours` real,
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
	`mentor_hours` real DEFAULT 0,
	`created_at` text DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `fk_outreach_logs_season_id_seasons_start_year_fk` FOREIGN KEY (`season_id`) REFERENCES `seasons`(`start_year`) ON DELETE SET NULL
);
--> statement-breakpoint
INSERT INTO `__new_outreach_logs`(`id`, `title`, `date`, `location`, `hours`, `people_reached`, `students_count`, `impact_summary`, `cf_email`, `is_mentoring`, `mentored_team_number`, `metadata`, `is_deleted`, `season_id`, `event_id`, `mentor_count`, `mentor_hours`, `created_at`) SELECT `id`, `title`, `date`, `location`, `hours`, `people_reached`, `students_count`, `impact_summary`, `cf_email`, `is_mentoring`, `mentored_team_number`, `metadata`, `is_deleted`, `season_id`, `event_id`, `mentor_count`, `mentor_hours`, `created_at` FROM `outreach_logs`;--> statement-breakpoint
DROP TABLE `outreach_logs`;--> statement-breakpoint
ALTER TABLE `__new_outreach_logs` RENAME TO `outreach_logs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_outreach_date_desc` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_date` ON `outreach_logs` (`date`);--> statement-breakpoint
CREATE INDEX `idx_outreach_season` ON `outreach_logs` (`season_id`);