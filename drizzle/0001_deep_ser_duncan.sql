CREATE TABLE `reimbursement_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reimbursement_id` int NOT NULL,
	`category` varchar(255) NOT NULL,
	`amount` decimal(10,2) NOT NULL,
	`receipt_url` text,
	`description` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `reimbursement_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travel_approvals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`travel_request_id` int NOT NULL,
	`approver_id` int NOT NULL,
	`status` enum('APPROVED','REJECTED') NOT NULL,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travel_approvals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `travel_fulfillments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`travel_request_id` int NOT NULL,
	`transport_details` text NOT NULL,
	`accommodation_details` text NOT NULL,
	`admin_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travel_fulfillments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
DROP TABLE `approvals`;--> statement-breakpoint
ALTER TABLE `reimbursements` DROP FOREIGN KEY `reimbursements_travel_request_id_travel_requests_id_fk`;
--> statement-breakpoint
ALTER TABLE `reimbursements` DROP FOREIGN KEY `reimbursements_user_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `travel_requests` DROP FOREIGN KEY `travel_requests_user_id_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `reimbursements` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `reimbursements` MODIFY COLUMN `travel_request_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `reimbursements` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `reimbursements` MODIFY COLUMN `status` enum('SUBMITTED','VERIFIED','PAID','REJECTED') NOT NULL DEFAULT 'SUBMITTED';--> statement-breakpoint
ALTER TABLE `travel_requests` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_requests` MODIFY COLUMN `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_requests` MODIFY COLUMN `start_date` date NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_requests` MODIFY COLUMN `end_date` date NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_requests` MODIFY COLUMN `status` enum('PENDING','APPROVED','REJECTED','FULFILLED','COMPLETED') NOT NULL DEFAULT 'PENDING';--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `id` int AUTO_INCREMENT NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('Karyawan','Atasan','Admin Travel','Tim Keuangan','Super Admin') NOT NULL;--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `department` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD `total_amount` decimal(10,2) DEFAULT '0.00' NOT NULL;--> statement-breakpoint
ALTER TABLE `travel_requests` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `users` ADD `password_hash` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;--> statement-breakpoint
ALTER TABLE `reimbursement_items` ADD CONSTRAINT `reimbursement_items_reimbursement_id_reimbursements_id_fk` FOREIGN KEY (`reimbursement_id`) REFERENCES `reimbursements`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_approvals` ADD CONSTRAINT `travel_approvals_travel_request_id_travel_requests_id_fk` FOREIGN KEY (`travel_request_id`) REFERENCES `travel_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_approvals` ADD CONSTRAINT `travel_approvals_approver_id_users_id_fk` FOREIGN KEY (`approver_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_fulfillments` ADD CONSTRAINT `travel_fulfillments_travel_request_id_travel_requests_id_fk` FOREIGN KEY (`travel_request_id`) REFERENCES `travel_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_fulfillments` ADD CONSTRAINT `travel_fulfillments_admin_id_users_id_fk` FOREIGN KEY (`admin_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_travel_request_id_travel_requests_id_fk` FOREIGN KEY (`travel_request_id`) REFERENCES `travel_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reimbursements` ADD CONSTRAINT `reimbursements_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_requests` ADD CONSTRAINT `travel_requests_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `reimbursements` DROP COLUMN `amount`;--> statement-breakpoint
ALTER TABLE `reimbursements` DROP COLUMN `description`;--> statement-breakpoint
ALTER TABLE `reimbursements` DROP COLUMN `receipt_url`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `password`;