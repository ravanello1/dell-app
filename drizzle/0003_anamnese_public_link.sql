ALTER TABLE `anamnese_forms` ADD `public_token_hash` text;--> statement-breakpoint
ALTER TABLE `anamnese_forms` ADD `public_token_expires_at` integer;--> statement-breakpoint
ALTER TABLE `anamnese_forms` ADD `client_submitted_at` integer;--> statement-breakpoint
CREATE INDEX `anamnese_public_token_idx` ON `anamnese_forms` (`public_token_hash`);