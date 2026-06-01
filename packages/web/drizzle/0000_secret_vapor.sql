CREATE TABLE `exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`category` text NOT NULL,
	`description` text NOT NULL,
	`description_en` text,
	`duration` integer NOT NULL,
	`players` integer,
	`intensity` text NOT NULL,
	`materials` text,
	`primary_objective` text,
	`secondary_objectives` text,
	`is_custom` integer DEFAULT false,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `match_convocations` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`jersey_number` integer,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `match_goals` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text,
	`minute` integer,
	`type` text DEFAULT 'goal' NOT NULL,
	`notes` text,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `match_lineup` (
	`id` text PRIMARY KEY NOT NULL,
	`match_id` text NOT NULL,
	`player_id` text NOT NULL,
	`position_role` text,
	`jersey_number` integer,
	`is_captain` integer DEFAULT false,
	`is_vice_captain` integer DEFAULT false,
	`is_freekick_taker` integer DEFAULT false,
	`is_corner_taker` integer DEFAULT false,
	`is_penalty_taker` integer DEFAULT false,
	`is_wall_player` integer DEFAULT false,
	`pos_x` real,
	`pos_y` real,
	`order` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`match_id`) REFERENCES `matches`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`player_id`) REFERENCES `players`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `matches` (
	`id` text PRIMARY KEY NOT NULL,
	`opponent` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`venue` text,
	`home_away` text DEFAULT 'home' NOT NULL,
	`competition` text,
	`formation` text,
	`notes` text,
	`goals_for` integer,
	`goals_against` integer,
	`substitutions` text,
	`cards` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `players` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`number` integer,
	`role` text NOT NULL,
	`sub_role` text,
	`secondary_role` text,
	`secondary_sub_role` text,
	`date_of_birth` text,
	`foot` text,
	`photo_url` text,
	`notes` text,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `session_exercises` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`exercise_id` text NOT NULL,
	`order` integer NOT NULL,
	`custom_duration` integer,
	`notes` text,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`exercise_id`) REFERENCES `exercises`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`duration` integer,
	`notes` text,
	`created_at` integer NOT NULL
);
