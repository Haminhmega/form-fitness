CREATE TABLE `form_google_identities` (
	`google_sub` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `google_user_unique` ON `form_google_identities` (`user_id`);--> statement-breakpoint
CREATE TABLE `form_oauth_states` (
	`state_hash` text PRIMARY KEY NOT NULL,
	`nonce_hash` text NOT NULL,
	`verifier` text NOT NULL,
	`link_user_id` text,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `oauth_expiry` ON `form_oauth_states` (`expires_at`);--> statement-breakpoint
CREATE TABLE `form_rate_limits` (
	`bucket` text PRIMARY KEY NOT NULL,
	`hits` integer NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `rate_expiry` ON `form_rate_limits` (`expires_at`);--> statement-breakpoint
CREATE TABLE `form_sessions` (
	`token_hash` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `session_user` ON `form_sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `session_expiry` ON `form_sessions` (`expires_at`);