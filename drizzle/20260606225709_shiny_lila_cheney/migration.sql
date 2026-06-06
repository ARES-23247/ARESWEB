CREATE INDEX `idx_onshape_bom_history_synced_by` ON `onshape_bom_history` (`synced_by`);
--> statement-breakpoint
CREATE INDEX `idx_robots_season` ON `robots` (`season_id`);
--> statement-breakpoint
CREATE INDEX `idx_robots_album` ON `robots` (`album_id`);
--> statement-breakpoint
CREATE INDEX `idx_sponsorship_assignments_user` ON `sponsorship_assignments` (`user_id`);