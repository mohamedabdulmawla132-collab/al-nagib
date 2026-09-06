import { index, int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/** Core user table backing the built-in auth flow. */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const lessons = mysqlTable("lessons", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 180 }).notNull(),
  slug: varchar("slug", { length: 220 }).notNull().unique(),
  grade: varchar("grade", { length: 80 }).notNull(),
  unitTitle: varchar("unitTitle", { length: 180 }).notNull(),
  description: text("description"),
  videoKey: text("videoKey"),
  videoName: varchar("videoName", { length: 255 }),
  videoMime: varchar("videoMime", { length: 100 }),
  externalVideoUrl: text("externalVideoUrl"),
  fileKey: text("fileKey"),
  fileName: varchar("fileName", { length: 255 }),
  fileMime: varchar("fileMime", { length: 100 }),
  externalFileUrl: text("externalFileUrl"),
  published: int("published").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  grade: varchar("grade", { length: 80 }).notNull(),
  lessonId: int("lessonId"),
  unitTitle: varchar("unitTitle", { length: 180 }),
  scope: mysqlEnum("scope", ["lesson", "unit"]).notNull(),
  amount: int("amount").notNull(),
  paymentReference: varchar("paymentReference", { length: 120 }),
  proofKey: text("proofKey"),
  status: mysqlEnum("status", ["pending", "confirmed", "rejected"]).default("pending").notNull(),
  accessCode: varchar("accessCode", { length: 32 }).notNull().unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const studentVerifications = mysqlTable("studentVerifications", {
  id: int("id").autoincrement().primaryKey(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  lessonId: int("lessonId").notNull(),
  source: mysqlEnum("source", ["roster", "purchase"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
});

export const homeworkSubmissions = mysqlTable("homeworkSubmissions", {
  id: int("id").autoincrement().primaryKey(),
  studentName: varchar("studentName", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 32 }).notNull(),
  grade: varchar("grade", { length: 80 }).notNull(),
  lessonId: int("lessonId").notNull(),
  assignmentTitle: varchar("assignmentTitle", { length: 180 }).notNull(),
  imageKey: text("imageKey").notNull(),
  imageName: varchar("imageName", { length: 255 }).notNull(),
  imageMime: varchar("imageMime", { length: 100 }).notNull(),
  extractedText: text("extractedText"),
  score: int("score"),
  maxScore: int("maxScore").default(10).notNull(),
  feedback: text("feedback"),
  confidence: int("confidence"),
  status: mysqlEnum("status", ["pending", "ai_graded", "approved", "rejected"]).default("pending").notNull(),
  teacherNote: text("teacherNote"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  reviewedAt: timestamp("reviewedAt"),
  sheetsSyncedAt: timestamp("sheetsSyncedAt"),
  sheetsSyncError: text("sheetsSyncError"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const teacherSettings = mysqlTable("teacherSettings", {
  id: int("id").autoincrement().primaryKey(),
  dailyDigestTaskUid: varchar("dailyDigestTaskUid", { length: 65 }),
  lastDigestAt: timestamp("lastDigestAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ taskUidIdx: index("teacher_settings_task_uid_idx").on(table.dailyDigestTaskUid) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Lesson = typeof lessons.$inferSelect;
export type InsertLesson = typeof lessons.$inferInsert;
export type Purchase = typeof purchases.$inferSelect;
export type InsertPurchase = typeof purchases.$inferInsert;
export type StudentVerification = typeof studentVerifications.$inferSelect;
export type InsertStudentVerification = typeof studentVerifications.$inferInsert;
export type HomeworkSubmission = typeof homeworkSubmissions.$inferSelect;
export type InsertHomeworkSubmission = typeof homeworkSubmissions.$inferInsert;
export type TeacherSettings = typeof teacherSettings.$inferSelect;
export type InsertTeacherSettings = typeof teacherSettings.$inferInsert;
