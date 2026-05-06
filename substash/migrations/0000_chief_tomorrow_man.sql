CREATE TABLE `comments` (
	`id` text PRIMARY KEY NOT NULL,
	`stash_id` text NOT NULL,
	`media_type` text NOT NULL,
	`parent_id` text,
	`body` text NOT NULL,
	`metadata` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `likes` (
	`stash_id` text PRIMARY KEY NOT NULL,
	`media_type` text NOT NULL,
	`title` text,
	`thumbnail_url` text,
	`created_at` integer NOT NULL
);
