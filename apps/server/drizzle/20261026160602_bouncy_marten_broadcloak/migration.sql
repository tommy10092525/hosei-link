CREATE TABLE `departmentMessage` (
	`id` text PRIMARY KEY,
	`department` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`text` text NOT NULL,
	CONSTRAINT `fk_departmentMessage_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE INDEX `departmentMessageDepartmentIdx` ON `departmentMessage` (`department`,`createdAt`);