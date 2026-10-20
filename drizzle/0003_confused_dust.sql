CREATE TABLE `companies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`company_code` varchar(100) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `companies_id` PRIMARY KEY(`id`),
	CONSTRAINT `companies_company_code_unique` UNIQUE(`company_code`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD `company_id` int;--> statement-breakpoint
ALTER TABLE `users` ADD `nik` varchar(50);--> statement-breakpoint
ALTER TABLE `users` ADD `status` enum('PENDING_VERIFICATION','ACTIVE','REJECTED') DEFAULT 'PENDING_VERIFICATION' NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_company_id_companies_id_fk` FOREIGN KEY (`company_id`) REFERENCES `companies`(`id`) ON DELETE cascade ON UPDATE no action;