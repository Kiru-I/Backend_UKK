CREATE TABLE `permissions` (
	`id` int NOT NULL,
	`name` varchar(150) NOT NULL,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `role_permissions` (
	`role_id` int NOT NULL,
	`permission_id` int NOT NULL,
	CONSTRAINT `role_permissions_role_id_permission_id_pk` PRIMARY KEY(`role_id`,`permission_id`)
);
--> statement-breakpoint
CREATE TABLE `roles` (
	`id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	CONSTRAINT `roles_id` PRIMARY KEY(`id`),
	CONSTRAINT `roles_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `travel_policies` (
	`id` int NOT NULL,
	`max_hotel_per_night` int NOT NULL,
	`allowed_hotel_class` varchar(100) NOT NULL,
	`flight_class` varchar(100) NOT NULL,
	`max_local_transport_per_day` int NOT NULL,
	`daily_meal_allowance` int NOT NULL,
	`max_cash_advance_percent` int NOT NULL,
	`report_deadline_days` int NOT NULL,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `travel_policies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `travel_policies` (
	`id`,
	`max_hotel_per_night`,
	`allowed_hotel_class`,
	`flight_class`,
	`max_local_transport_per_day`,
	`daily_meal_allowance`,
	`max_cash_advance_percent`,
	`report_deadline_days`
) VALUES (1, 850000, 'Bintang 3–4', 'Ekonomi', 200000, 150000, 80, 7);
--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_role_id_roles_id_fk` FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `role_permissions` ADD CONSTRAINT `role_permissions_permission_id_permissions_id_fk` FOREIGN KEY (`permission_id`) REFERENCES `permissions`(`id`) ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
INSERT INTO `roles` (`id`, `name`) VALUES
	(1, 'Karyawan'),
	(2, 'Atasan'),
	(3, 'Admin Travel'),
	(4, 'Tim Keuangan'),
	(5, 'Super Admin');
--> statement-breakpoint
INSERT INTO `permissions` (`id`, `name`) VALUES
	(1, 'Ajukan Perjalanan'),
	(2, 'Setujui / Tolak Perjalanan'),
	(3, 'Kelola Booking'),
	(4, 'Verifikasi Reimbursement'),
	(5, 'Kelola Uang Muka'),
	(6, 'Kelola Pengguna'),
	(7, 'Kelola Kebijakan');
--> statement-breakpoint
INSERT INTO `role_permissions` (`role_id`, `permission_id`) VALUES
	(1, 1),
	(2, 2),
	(3, 3),
	(4, 4),
	(4, 5),
	(5, 2),
	(5, 3),
	(5, 4),
	(5, 5),
	(5, 6),
	(5, 7);