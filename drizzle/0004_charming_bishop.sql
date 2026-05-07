CREATE TABLE IF NOT EXISTS `usage_metrics` (
	`id` text PRIMARY KEY NOT NULL,
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
CREATE INDEX IF NOT EXISTS `idx_usage_metrics_timestamp` ON `usage_metrics` (`timestamp`);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_usage_metrics_endpoint` ON `usage_metrics` (`endpoint`);