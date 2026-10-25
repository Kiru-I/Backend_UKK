CREATE TABLE `travel_bookings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`travel_request_id` int NOT NULL,
	`user_id` int NOT NULL,
	`booking_code` varchar(100) NOT NULL,
	`transportation_mode` enum('Pesawat','Kereta Api','Travel','Mobil Kantor') NOT NULL,
	`operator` varchar(255),
	`departure_at` timestamp,
	`arrival_at` timestamp,
	`hotel_name` varchar(255),
	`room_type` varchar(255),
	`check_in_date` date,
	`check_out_date` date,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `travel_bookings_id` PRIMARY KEY(`id`),
	CONSTRAINT `travel_bookings_booking_code_unique` UNIQUE(`booking_code`),
	CONSTRAINT `travel_bookings_travel_request_id_unique` UNIQUE(`travel_request_id`)
);
--> statement-breakpoint
ALTER TABLE `travel_bookings` ADD CONSTRAINT `travel_bookings_travel_request_id_travel_requests_id_fk` FOREIGN KEY (`travel_request_id`) REFERENCES `travel_requests`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `travel_bookings` ADD CONSTRAINT `travel_bookings_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;