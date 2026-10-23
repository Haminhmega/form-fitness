CREATE TABLE `form_analytics_consent` (
	`user_id` text PRIMARY KEY NOT NULL,
	`enabled` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `form_email_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`purpose` text NOT NULL,
	`code_hash` text NOT NULL,
	`expires_at` integer NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`consumed_at` integer
);
--> statement-breakpoint
CREATE INDEX `email_code_expiry` ON `form_email_codes` (`expires_at`);--> statement-breakpoint
CREATE INDEX `email_code_address` ON `form_email_codes` (`email`,`purpose`);--> statement-breakpoint
CREATE TABLE `form_usage_events` (
	`id` text PRIMARY KEY NOT NULL,
	`subject` text NOT NULL,
	`kind` text NOT NULL,
	`at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `usage_time` ON `form_usage_events` (`at`);--> statement-breakpoint
CREATE INDEX `usage_subject_time` ON `form_usage_events` (`subject`,`at`);--> statement-breakpoint
ALTER TABLE `form_password_identities` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `form_password_identities` ADD `credential_version` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `form_sessions` ADD `credential_version` integer DEFAULT 0 NOT NULL;