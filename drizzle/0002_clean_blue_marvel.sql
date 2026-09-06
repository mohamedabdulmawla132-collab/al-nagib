CREATE TABLE `homeworkSubmissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`studentName` varchar(160) NOT NULL,
	`phone` varchar(32) NOT NULL,
	`grade` varchar(80) NOT NULL,
	`lessonId` int NOT NULL,
	`assignmentTitle` varchar(180) NOT NULL,
	`imageKey` text NOT NULL,
	`imageName` varchar(255) NOT NULL,
	`imageMime` varchar(100) NOT NULL,
	`extractedText` text,
	`score` int,
	`maxScore` int NOT NULL DEFAULT 10,
	`feedback` text,
	`confidence` int,
	`status` enum('pending','ai_graded','approved','rejected') NOT NULL DEFAULT 'pending',
	`teacherNote` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`reviewedAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `homeworkSubmissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teacherSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`dailyDigestTaskUid` varchar(65),
	`lastDigestAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teacherSettings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `teacher_settings_task_uid_idx` ON `teacherSettings` (`dailyDigestTaskUid`);