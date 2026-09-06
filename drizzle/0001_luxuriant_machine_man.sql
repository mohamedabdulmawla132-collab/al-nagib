CREATE TABLE `lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(180) NOT NULL,
	`slug` varchar(220) NOT NULL,
	`grade` varchar(80) NOT NULL,
	`unitTitle` varchar(180) NOT NULL,
	`description` text,
	`videoKey` text,
	`videoName` varchar(255),
	`videoMime` varchar(100),
	`externalVideoUrl` text,
	`fileKey` text,
	`fileName` varchar(255),
	`fileMime` varchar(100),
	`externalFileUrl` text,
	`published` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lessons_id` PRIMARY KEY(`id`),
	CONSTRAINT `lessons_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`grade` varchar(80) NOT NULL,
	`lessonId` int,
	`unitTitle` varchar(180),
	`scope` enum('lesson','unit') NOT NULL,
	`amount` int NOT NULL,
	`paymentReference` varchar(120),
	`proofKey` text,
	`status` enum('pending','confirmed','rejected') NOT NULL DEFAULT 'pending',
	`accessCode` varchar(32) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `purchases_id` PRIMARY KEY(`id`),
	CONSTRAINT `purchases_accessCode_unique` UNIQUE(`accessCode`)
);
--> statement-breakpoint
CREATE TABLE `studentVerifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`lessonId` int NOT NULL,
	`source` enum('roster','purchase') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `studentVerifications_id` PRIMARY KEY(`id`)
);
