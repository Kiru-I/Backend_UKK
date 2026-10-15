CREATE TABLE `cash_advances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`travel_request_id` int NOT NULL,
	`user_id` int NOT NULL,
	`estimated_cost` decimal(10,2) NOT NULL,
	`requested_amount` decimal(10,2) NOT NULL,
	`returned_amount` decimal(10,2) NOT NULL DEFAULT '0.00',
	`status` enum('WAITING_PAYMENT','DISBURSED') NOT NULL DEFAULT 'WAITING_PAYMENT',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cash_advances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `reimbursements` MODIFY COLUMN `status` enum('SUBMITTED','NEEDS_DOCUMENTS','VERIFIED','PAID','REJECTED') NOT NULL DEFAULT 'SUBMITTED';--> statement-breakpoint
ALTER TABLE `travel_requests` ADD `transportation_mode` enum('Pesawat','Kereta Api','Travel','Mobil Kantor');--> statement-breakpoint
ALTER TABLE `travel_requests` ADD `lpj_completed_at` timestamp;--> statement-breakpoint
ALTER TABLE `cash_advances` ADD CONSTRAINT `cash_advances_travel_request_id_travel_requests_id_fk` FOREIGN KEY (`travel_request_id`) REFERENCES `travel_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cash_advances` ADD CONSTRAINT `cash_advances_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;