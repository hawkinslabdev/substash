CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `share_links` (
	`token` text PRIMARY KEY NOT NULL,
	`original_path` text NOT NULL,
	`stash_id` text NOT NULL,
	`media_type` text NOT NULL,
	`hmac` text NOT NULL,
	`created_at` integer NOT NULL
);
