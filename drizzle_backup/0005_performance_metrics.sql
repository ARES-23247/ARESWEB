CREATE TABLE IF NOT EXISTS `performance_metrics` (
	`id` text PRIMARY KEY NOT NULL,
	`metric_name` text NOT NULL,
	`value` real NOT NULL,
	`rating` text NOT NULL,
	`page` text NOT NULL,
	`timestamp` text NOT NULL
);
