CREATE TABLE `game_results` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`player_id` text NOT NULL,
	`amount` integer NOT NULL,
	`placement` integer NOT NULL,
	`wins` integer DEFAULT 0 NOT NULL,
	`self_draws` integer DEFAULT 0 NOT NULL,
	`deals_in` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`session_id`) REFERENCES `game_sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_game_results_session_player` ON `game_results` (`session_id`,`player_id`);--> statement-breakpoint
CREATE INDEX `idx_game_results_player_id` ON `game_results` (`player_id`);--> statement-breakpoint
CREATE TABLE `game_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`played_at` text NOT NULL,
	`season` text DEFAULT '本季' NOT NULL,
	`rounds` integer DEFAULT 1 NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_game_sessions_played_at` ON `game_sessions` (`played_at`);--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT '#167c5a' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
