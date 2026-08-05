CREATE TABLE `anamnese_forms` (
	`id` text PRIMARY KEY NOT NULL,
	`client_id` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`answers` text DEFAULT '{}' NOT NULL,
	`observations` text,
	`client_signature` text,
	`professional_signature` text,
	`professional_id` text,
	`signed_snapshot` text,
	`signed_at` integer,
	`created_by` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`professional_id`) REFERENCES `professionals`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `anamnese_client_created_idx` ON `anamnese_forms` (`client_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `anamnese_status_idx` ON `anamnese_forms` (`status`);