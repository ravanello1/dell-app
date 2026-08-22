CREATE TABLE `appointment_services` (
	`id` text PRIMARY KEY NOT NULL,
	`appointment_id` text NOT NULL,
	`service_id` text NOT NULL,
	`duration_min` integer NOT NULL,
	`price_cents` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`appointment_id`) REFERENCES `appointments`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `appointment_services_appointment_idx` ON `appointment_services` (`appointment_id`);
--> statement-breakpoint
CREATE INDEX `appointment_services_service_idx` ON `appointment_services` (`service_id`);
