CREATE TABLE `finance_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`annual_budget` decimal(14,2) NOT NULL,
	`payment_methods` text NOT NULL,
	`updated_by` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `finance_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `cash_advances` ADD `payment_date` timestamp;--> statement-breakpoint
ALTER TABLE `cash_advances` ADD `payment_reference` varchar(100);--> statement-breakpoint
ALTER TABLE `cash_advances` ADD `payment_method` varchar(100);--> statement-breakpoint
ALTER TABLE `cash_advances` ADD `processed_by` int;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `payment_date` timestamp;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `payment_reference` varchar(100);--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `payment_method` varchar(100);--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `processed_by` int;--> statement-breakpoint
ALTER TABLE `travel_requests` ADD `estimated_cost` decimal(12,2);--> statement-breakpoint
ALTER TABLE `users` ADD `supervisor_id` int;--> statement-breakpoint
ALTER TABLE `finance_settings` ADD CONSTRAINT `finance_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_advances` ADD CONSTRAINT `cash_advances_processed_by_users_id_fk` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_processed_by_users_id_fk` FOREIGN KEY (`processed_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_supervisor_id_users_id_fk` FOREIGN KEY (`supervisor_id`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;
--> statement-breakpoint
UPDATE `users` AS employee
INNER JOIN (
	SELECT `company_id`, MIN(`id`) AS `supervisor_id`
	FROM `users`
	WHERE `role` = 'Atasan' AND `company_id` IS NOT NULL
	GROUP BY `company_id`
) AS manager ON manager.`company_id` = employee.`company_id`
SET employee.`supervisor_id` = manager.`supervisor_id`
WHERE employee.`role` = 'Karyawan';