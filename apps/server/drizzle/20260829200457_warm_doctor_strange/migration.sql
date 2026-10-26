CREATE TABLE `account` (
	`id` text PRIMARY KEY,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	CONSTRAINT `fk_account_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `block` (
	`id` text PRIMARY KEY,
	`blocker` text NOT NULL,
	`blocked` text NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_block_blocker_user_id_fk` FOREIGN KEY (`blocker`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_block_blocked_user_id_fk` FOREIGN KEY (`blocked`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `classMessage` (
	`id` text PRIMARY KEY,
	`classId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`text` text NOT NULL,
	CONSTRAINT `fk_classMessage_classId_class_id_fk` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_classMessage_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `classReview` (
	`id` text PRIMARY KEY,
	`classId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`text` text NOT NULL,
	`rating` integer NOT NULL,
	CONSTRAINT `fk_classReview_classId_class_id_fk` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_classReview_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `classSlot` (
	`id` text PRIMARY KEY,
	`classId` text NOT NULL,
	`youbi` text NOT NULL,
	`time` integer NOT NULL,
	CONSTRAINT `fk_classSlot_classId_class_id_fk` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `class` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`code` text NOT NULL,
	`url` text NOT NULL,
	`place` text NOT NULL,
	`teacher` text NOT NULL,
	`gakubu` text NOT NULL,
	`timeInnerHTML` text NOT NULL,
	`nendo` integer NOT NULL,
	`online` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE `contact` (
	`id` text PRIMARY KEY,
	`title` text NOT NULL,
	`content` text NOT NULL,
	`createdAt` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `follow` (
	`id` text PRIMARY KEY,
	`followedId` text NOT NULL,
	`followingId` text NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_follow_followedId_user_id_fk` FOREIGN KEY (`followedId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_follow_followingId_user_id_fk` FOREIGN KEY (`followingId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `message` (
	`id` text PRIMARY KEY,
	`fromUserId` text NOT NULL,
	`toUserId` text NOT NULL,
	`content` text,
	`createdAt` integer NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	CONSTRAINT `fk_message_fromUserId_user_id_fk` FOREIGN KEY (`fromUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_message_toUserId_user_id_fk` FOREIGN KEY (`toUserId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `messageImage` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`messageId` text NOT NULL,
	CONSTRAINT `fk_messageImage_messageId_message_id_fk` FOREIGN KEY (`messageId`) REFERENCES `message`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY,
	`userId` text NOT NULL,
	`content` text,
	`createdAt` integer NOT NULL,
	`parentPostId` text,
	CONSTRAINT `fk_post_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE,
	CONSTRAINT `postParentFk` FOREIGN KEY (`parentPostId`) REFERENCES `post`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `postImage` (
	`id` text PRIMARY KEY,
	`key` text NOT NULL,
	`postId` text NOT NULL,
	CONSTRAINT `fk_postImage_postId_post_id_fk` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `reaction` (
	`id` text PRIMARY KEY,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`type` text DEFAULT 'like' NOT NULL,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_reaction_postId_post_id_fk` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_reaction_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `register` (
	`id` text PRIMARY KEY,
	`classId` text NOT NULL,
	`userId` text NOT NULL,
	`createdAt` integer NOT NULL,
	`lastViewedAt` integer,
	CONSTRAINT `fk_register_classId_class_id_fk` FOREIGN KEY (`classId`) REFERENCES `class`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_register_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `report` (
	`id` text PRIMARY KEY,
	`postId` text NOT NULL,
	`userId` text NOT NULL,
	`text` text,
	`createdAt` integer NOT NULL,
	CONSTRAINT `fk_report_postId_post_id_fk` FOREIGN KEY (`postId`) REFERENCES `post`(`id`) ON DELETE CASCADE,
	CONSTRAINT `fk_report_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	CONSTRAINT `fk_session_userId_user_id_fk` FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE CASCADE
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY,
	`name` text NOT NULL,
	`email` text NOT NULL UNIQUE,
	`emailVerified` integer DEFAULT false NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`department` text,
	`major` text,
	`public` integer DEFAULT false NOT NULL,
	`bio` text,
	`avatarKey` text,
	`lastScheduleViewAt` integer
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `accountUserIdIdx` ON `account` (`userId`);--> statement-breakpoint
CREATE INDEX `blockBlockerIdx` ON `block` (`blocker`);--> statement-breakpoint
CREATE UNIQUE INDEX `blockPairUniq` ON `block` (`blocker`,`blocked`);--> statement-breakpoint
CREATE INDEX `classMessageClassIdIdx` ON `classMessage` (`classId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `classReviewClassIdIdx` ON `classReview` (`classId`);--> statement-breakpoint
CREATE UNIQUE INDEX `classReviewPairUniq` ON `classReview` (`classId`,`userId`);--> statement-breakpoint
CREATE INDEX `classSlotClassIdIdx` ON `classSlot` (`classId`);--> statement-breakpoint
CREATE INDEX `classSlotSlotIdx` ON `classSlot` (`youbi`,`time`);--> statement-breakpoint
CREATE UNIQUE INDEX `classSlotUniq` ON `classSlot` (`classId`,`youbi`,`time`);--> statement-breakpoint
CREATE INDEX `classGakubuIdx` ON `class` (`gakubu`);--> statement-breakpoint
CREATE INDEX `classTitleIdx` ON `class` (`title`);--> statement-breakpoint
CREATE INDEX `classTeacherIdx` ON `class` (`teacher`);--> statement-breakpoint
CREATE INDEX `followFollowedIdx` ON `follow` (`followedId`);--> statement-breakpoint
CREATE INDEX `followFollowingIdx` ON `follow` (`followingId`);--> statement-breakpoint
CREATE UNIQUE INDEX `followPairUniq` ON `follow` (`followedId`,`followingId`);--> statement-breakpoint
CREATE INDEX `messagePairIdx` ON `message` (`fromUserId`,`toUserId`);--> statement-breakpoint
CREATE INDEX `messageUnreadIdx` ON `message` (`toUserId`,`isRead`);--> statement-breakpoint
CREATE INDEX `messageImageMessageIdIdx` ON `messageImage` (`messageId`);--> statement-breakpoint
CREATE INDEX `postUserIdIdx` ON `post` (`userId`);--> statement-breakpoint
CREATE INDEX `postCreatedAtIdx` ON `post` (`createdAt`);--> statement-breakpoint
CREATE INDEX `postParentIdx` ON `post` (`parentPostId`);--> statement-breakpoint
CREATE INDEX `postImagePostIdIdx` ON `postImage` (`postId`);--> statement-breakpoint
CREATE INDEX `reactionPostIdIdx` ON `reaction` (`postId`);--> statement-breakpoint
CREATE INDEX `reactionUserIdIdx` ON `reaction` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `reactionPostUserUniq` ON `reaction` (`postId`,`userId`);--> statement-breakpoint
CREATE INDEX `registerClassIdIdx` ON `register` (`classId`);--> statement-breakpoint
CREATE INDEX `registerUserIdIdx` ON `register` (`userId`);--> statement-breakpoint
CREATE UNIQUE INDEX `registerPairUniq` ON `register` (`classId`,`userId`);--> statement-breakpoint
CREATE INDEX `reportPostIdIdx` ON `report` (`postId`);--> statement-breakpoint
CREATE INDEX `sessionUserIdIdx` ON `session` (`userId`);--> statement-breakpoint
CREATE INDEX `verificationIdentifierIdx` ON `verification` (`identifier`);