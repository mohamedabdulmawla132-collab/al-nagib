import { and, desc, eq, gte, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { HomeworkSubmission, InsertHomeworkSubmission, InsertLesson, InsertPurchase, InsertUser, homeworkSubmissions, lessons, purchases, teacherSettings, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined || user.openId === ENV.ownerOpenId) {
    values.role = user.role ?? "admin";
    updateSet.role = values.role;
  }
  values.lastSignedIn ??= new Date();
  if (!Object.keys(updateSet).length) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listLessons(grade?: string) {
  const db = await getDb();
  if (!db) return [];
  const where = grade ? and(eq(lessons.published, 1), eq(lessons.grade, grade)) : eq(lessons.published, 1);
  return db.select().from(lessons).where(where).orderBy(desc(lessons.id));
}

export async function listAllLessons() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(lessons).orderBy(desc(lessons.id));
}

export async function getLessonById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lessons).where(eq(lessons.id, id)).limit(1);
  return result[0];
}

export async function createLesson(input: InsertLesson) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(lessons).values(input);
  const result = await db.select().from(lessons).where(eq(lessons.slug, input.slug)).limit(1);
  return result[0];
}

export async function updateLesson(id: number, input: Partial<InsertLesson>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(lessons).set(input).where(eq(lessons.id, id));
  return getLessonById(id);
}

export async function createPurchase(input: InsertPurchase) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(purchases).values(input);
  const result = await db.select().from(purchases).where(eq(purchases.accessCode, input.accessCode)).limit(1);
  return result[0];
}

export async function listPurchases(status?: "pending" | "confirmed" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(purchases);
  return status ? query.where(eq(purchases.status, status)).orderBy(desc(purchases.id)) : query.orderBy(desc(purchases.id));
}

export async function getPurchaseByAccessCode(accessCode: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(purchases).where(eq(purchases.accessCode, accessCode)).limit(1);
  return result[0];
}

export async function updatePurchaseStatus(id: number, status: "pending" | "confirmed" | "rejected") {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(purchases).set({ status }).where(eq(purchases.id, id));
  const result = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
  return result[0];
}

export async function findConfirmedPurchaseByCode(accessCode: string, studentName: string, lessonId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(purchases).where(and(eq(purchases.accessCode, accessCode), eq(purchases.studentName, studentName), eq(purchases.status, "confirmed"))).limit(1);
  const item = rows[0];
  if (!item) return undefined;
  if (item.lessonId === lessonId || (item.scope === "unit" && Boolean(item.unitTitle))) return item;
  return undefined;
}

export async function findConfirmedPurchase(studentName: string, phone: string, lessonId: number, accessCode?: string) {
  const db = await getDb();
  if (!db) return undefined;
  const matches = await db.select().from(purchases).where(
    and(eq(purchases.studentName, studentName), eq(purchases.phone, phone), eq(purchases.status, "confirmed")),
  );
  return matches.find(item => {
    if (accessCode && item.accessCode === accessCode) return true;
    return item.lessonId === lessonId || (item.scope === "unit" && Boolean(item.unitTitle));
  });
}

export async function createHomeworkSubmission(input: InsertHomeworkSubmission) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.insert(homeworkSubmissions).values(input);
  const rows = await db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.imageKey, input.imageKey)).orderBy(desc(homeworkSubmissions.id)).limit(1);
  return rows[0];
}

export async function getHomeworkSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(homeworkSubmissions).where(eq(homeworkSubmissions.id, id)).limit(1);
  return rows[0];
}

export async function listHomeworkSubmissions(status?: "pending" | "ai_graded" | "approved" | "rejected") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(homeworkSubmissions);
  return status ? query.where(eq(homeworkSubmissions.status, status)).orderBy(desc(homeworkSubmissions.id)) : query.orderBy(desc(homeworkSubmissions.id));
}

export async function updateHomeworkSubmission(id: number, input: Partial<HomeworkSubmission>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db.update(homeworkSubmissions).set(input).where(eq(homeworkSubmissions.id, id));
  return getHomeworkSubmissionById(id);
}

export async function listHomeworkSubmissionsBetween(start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(homeworkSubmissions).where(and(gte(homeworkSubmissions.createdAt, start), lt(homeworkSubmissions.createdAt, end))).orderBy(desc(homeworkSubmissions.id));
}

export async function getTeacherSettings() {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teacherSettings).orderBy(desc(teacherSettings.id)).limit(1);
  return rows[0];
}

export async function getTeacherSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(teacherSettings).where(eq(teacherSettings.dailyDigestTaskUid, taskUid)).limit(1);
  return rows[0];
}

export async function saveTeacherSettings(input: Partial<typeof teacherSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const values = { id: 1, ...input };
  await db.insert(teacherSettings).values(values).onDuplicateKeyUpdate({ set: input });
  return getTeacherSettings();
}
