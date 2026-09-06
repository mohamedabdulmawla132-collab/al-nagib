import { TRPCError } from "@trpc/server";
import { parse as parseCookie } from "cookie";
import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import { randomUUID } from "node:crypto";
import { lessons, purchases } from "../drizzle/schema";
import { createHomeworkSubmission, createLesson, createPurchase, findConfirmedPurchase, getHomeworkSubmissionById, getLessonById, findConfirmedPurchaseByCode, listAllLessons, listHomeworkSubmissions, listLessons, listPurchases, updateHomeworkSubmission, updateLesson, updatePurchaseStatus } from "./db";
import { createStudentAccessToken, readStudentAccessToken } from "./studentAccess";
import { clearTeacherSessionCookie, createTeacherSession, isTeacherRequest, setTeacherSessionCookie, verifyTeacherCredentials } from "./teacherAuth";
import { verifyStudentInRoster } from "./roster";
import { storageGetSignedUrl, storagePut } from "./storage";
import { gradeHomeworkImage } from "./homeworkGrader";
import { syncApprovedHomework } from "./sheetsSync";
import { createHeartbeatJob } from "./_core/heartbeat";
import { getTeacherSettings, saveTeacherSettings } from "./db";
import { publicProcedure, router } from "./_core/trpc";

export const GRADES = [
  "الأول الإعدادي",
  "الثاني الإعدادي",
  "الثالث الإعدادي",
  "الأول الثانوي",
  "الثاني الثانوي",
  "الثالث الثانوي",
] as const;

const gradeSchema = z.enum(GRADES);
const phoneSchema = z.string().trim().min(8).max(32);
const loginAttempts = new Map<string, { count: number; resetAt: number; blockedUntil: number }>();
const teacherProcedure = publicProcedure.use(async ({ ctx, next }) => {
  if (!(await isTeacherRequest(ctx.req))) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "يجب تسجيل دخول المدرّس أولًا" });
  }
  return next();
});

function safeSlug(title: string) {
  return `${title.trim().toLocaleLowerCase("ar").replace(/[^\w\u0600-\u06ff]+/g, "-").replace(/^-|-$/g, "")}-${randomUUID().slice(0, 8)}`;
}

function publicLesson(lesson: typeof lessons.$inferSelect) {
  return {
    id: lesson.id,
    title: lesson.title,
    slug: lesson.slug,
    grade: lesson.grade,
    unitTitle: lesson.unitTitle,
    description: lesson.description,
    published: Boolean(lesson.published),
    hasVideo: Boolean(lesson.videoKey || lesson.externalVideoUrl),
    hasFile: Boolean(lesson.fileKey || lesson.externalFileUrl),
  };
}

function validateAsset(type: "video" | "file", mime: string, size: number) {
  const videoAllowed = ["video/mp4", "video/webm", "video/quicktime"];
  const fileAllowed = ["application/pdf", "application/zip", "application/octet-stream", "image/jpeg", "image/png"];
  const allowed = type === "video" ? videoAllowed : fileAllowed;
  if (!allowed.includes(mime)) throw new TRPCError({ code: "BAD_REQUEST", message: "نوع الملف غير مسموح به" });
  if (size > 30 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "حجم الملف يتجاوز 30 ميجابايت" });
}

export const platformRouter = router({
  config: publicProcedure.query(() => ({
    brand: "النجيب",
    whatsapp: "201283129947",
    paymentWallet: process.env.PAYMENT_WALLET_NUMBER?.trim() || "",
    grades: GRADES,
    prices: { lesson: 30, unit: 150 },
  })),

  lessons: router({
    list: publicProcedure.input(z.object({ grade: gradeSchema.optional() }).optional()).query(async ({ input }) => {
      const rows = await listLessons(input?.grade);
      return rows.map(publicLesson);
    }),
    get: publicProcedure.input(z.object({ id: z.number().int().positive() })).query(async ({ input }) => {
      const lesson = await getLessonById(input.id);
      if (!lesson || !lesson.published) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير متاحة" });
      return publicLesson(lesson);
    }),
    asset: publicProcedure.input(z.object({
      lessonId: z.number().int().positive(),
      token: z.string().min(20),
      kind: z.enum(["video", "file"]),
    })).query(async ({ input }) => {
      const lesson = await getLessonById(input.lessonId);
      if (!lesson || !lesson.published) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير متاحة" });
      const access = await readStudentAccessToken(input.token, lesson.id, lesson.unitTitle);
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "هذا الملف يحتاج تحققًا صالحًا" });
      const key = input.kind === "video" ? lesson.videoKey : lesson.fileKey;
      const externalUrl = input.kind === "video" ? lesson.externalVideoUrl : lesson.externalFileUrl;
      const url = key ? await storageGetSignedUrl(key) : externalUrl;
      if (!url) throw new TRPCError({ code: "NOT_FOUND", message: "لم تتم إضافة هذا الملف بعد" });
      return { url, name: input.kind === "video" ? lesson.videoName : lesson.fileName, expiresIn: 300 };
    }),
  }),

  student: router({
    verify: publicProcedure.input(z.object({
      lessonId: z.number().int().positive(),
      studentName: z.string().trim().min(2).max(160),
      recordNumber: z.string().trim().max(80).optional(),
      phone: phoneSchema.optional(),
      accessCode: z.string().trim().max(32).optional(),
    })).mutation(async ({ input }) => {
      const lesson = await getLessonById(input.lessonId);
      if (!lesson || !lesson.published) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير متاحة" });
      const roster = input.recordNumber ? await verifyStudentInRoster(input.studentName, input.recordNumber) : { valid: false, reason: "student_not_found" as const };
      let source: "roster" | "purchase" | null = roster.valid ? "roster" : null;
      let purchase = undefined;
      if (!source && input.accessCode) {
        purchase = await findConfirmedPurchaseByCode(input.accessCode, input.studentName, lesson.id);
        if (!purchase && input.phone) purchase = await findConfirmedPurchase(input.studentName, input.phone, lesson.id, input.accessCode);
        if (purchase && (purchase.lessonId === lesson.id || (purchase.scope === "unit" && purchase.unitTitle === lesson.unitTitle))) source = "purchase";
      }
      if (!source) throw new TRPCError({ code: "FORBIDDEN", message: input.recordNumber && roster.reason === "roster_unavailable" ? "تعذر قراءة الكشف حاليًا، حاول مرة أخرى" : "بيانات الطالب أو كود الشراء غير صحيحة" });
      const accessToken = await createStudentAccessToken({
        studentName: input.studentName,
        recordNumber: input.recordNumber ?? purchase?.phone ?? "",
        phone: purchase?.phone,
        lessonId: lesson.id,
        grade: lesson.grade,
        scope: purchase?.scope === "unit" ? "unit" : "lesson",
        unitTitle: purchase?.unitTitle ?? undefined,
      });
      return { authorized: true, source, accessToken, lesson: publicLesson(lesson) };
    }),
  }),

  homework: router({
    submit: publicProcedure.input(z.object({
      lessonId: z.number().int().positive(),
      accessToken: z.string().min(40),
      assignmentTitle: z.string().trim().min(2).max(180),
      imageName: z.string().trim().min(1).max(255),
      imageMime: z.enum(["image/jpeg", "image/png", "image/webp"]),
      dataBase64: z.string().min(40).max(12 * 1024 * 1024),
    })).mutation(async ({ input }) => {
      const lesson = await getLessonById(input.lessonId);
      if (!lesson || !lesson.published) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير متاحة" });
      const access = await readStudentAccessToken(input.accessToken, lesson.id, lesson.unitTitle);
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "تحقق من دخول الطالب قبل رفع الواجب" });
      const imageBuffer = Buffer.from(input.dataBase64, "base64");
      if (imageBuffer.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "صورة الواجب تتجاوز 8 ميجابايت" });
      const safeName = input.imageName.replace(/[^\w.\-\u0600-\u06ff]+/g, "-");
      const uploaded = await storagePut(`homework/${lesson.slug}/${randomUUID()}-${safeName}`, imageBuffer, input.imageMime);
      let grade: Awaited<ReturnType<typeof gradeHomeworkImage>> | undefined;
      try {
        grade = await gradeHomeworkImage({ dataBase64: input.dataBase64, mime: input.imageMime, studentName: access.studentName, assignmentTitle: input.assignmentTitle });
      } catch (error) {
        console.warn("[Homework] AI grading deferred:", error);
      }
      const created = await createHomeworkSubmission({
        studentName: access.studentName,
        phone: access.recordNumber ?? access.phone ?? "",
        grade: lesson.grade,
        lessonId: lesson.id,
        assignmentTitle: input.assignmentTitle,
        imageKey: uploaded.key,
        imageName: input.imageName,
        imageMime: input.imageMime,
        extractedText: grade?.extractedText,
        score: grade?.score,
        maxScore: grade?.maxScore ?? 10,
        feedback: grade?.feedback,
        confidence: grade?.confidence,
        status: grade ? "approved" : "pending",
        reviewedAt: grade ? new Date() : undefined,
      });
      if (grade && created) {
        const sync = await syncApprovedHomework(created);
        if (!sync.synced) console.warn("[Homework] Google Sheets sync skipped:", sync.reason);
      }
      return { id: created?.id, status: created?.status, score: created?.score, maxScore: created?.maxScore, feedback: created?.feedback, needsTeacherReview: false, aiGraded: Boolean(grade) };
    }),
    mine: publicProcedure.input(z.object({
      lessonId: z.number().int().positive(),
      accessToken: z.string().min(40),
    })).query(async ({ input }) => {
      const lesson = await getLessonById(input.lessonId);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
      const access = await readStudentAccessToken(input.accessToken, lesson.id, lesson.unitTitle);
      if (!access) throw new TRPCError({ code: "FORBIDDEN", message: "انتهت صلاحية الدخول" });
      const rows = await listHomeworkSubmissions();
      return rows.filter(item => item.lessonId === lesson.id && item.studentName === access.studentName && item.phone === (access.recordNumber ?? access.phone ?? "")).map(item => ({
        id: item.id, assignmentTitle: item.assignmentTitle, score: item.score, maxScore: item.maxScore, feedback: item.feedback, status: item.status, confidence: item.confidence, createdAt: item.createdAt,
      }));
    }),
  }),

  purchase: router({
    create: publicProcedure.input(z.object({
      studentName: z.string().trim().min(2).max(160),
      phone: phoneSchema,
      grade: gradeSchema,
      lessonId: z.number().int().positive().optional(),
      unitTitle: z.string().trim().min(2).max(180).optional(),
      scope: z.enum(["lesson", "unit"]),
      paymentReference: z.string().trim().max(120).optional(),
      proofName: z.string().trim().max(255).optional(),
      proofMime: z.string().trim().max(100).optional(),
      proofBase64: z.string().max(12 * 1024 * 1024).optional(),
    })).mutation(async ({ input }) => {
      if (input.scope === "lesson" && !input.lessonId) throw new TRPCError({ code: "BAD_REQUEST", message: "اختر الحصة المطلوبة" });
      const lesson = input.lessonId ? await getLessonById(input.lessonId) : undefined;
      if (input.lessonId && (!lesson || lesson.grade !== input.grade)) throw new TRPCError({ code: "BAD_REQUEST", message: "الحصة لا تطابق الصف المختار" });
      if (input.scope === "unit" && !input.unitTitle) throw new TRPCError({ code: "BAD_REQUEST", message: "اكتب اسم الوحدة المطلوبة" });
      const accessCode = `NG-${randomUUID().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
      let proofKey: string | undefined;
      if (input.proofBase64 && input.proofName && input.proofMime) {
        const proofBuffer = Buffer.from(input.proofBase64, "base64");
        if (proofBuffer.byteLength > 8 * 1024 * 1024) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "إثبات التحويل يتجاوز 8 ميجابايت" });
        validateAsset("file", input.proofMime, proofBuffer.byteLength);
        const uploadedProof = await storagePut(`payment-proofs/${accessCode}-${input.proofName}`, proofBuffer, input.proofMime);
        proofKey = uploadedProof.key;
      }
      const created = await createPurchase({
        studentName: input.studentName,
        phone: input.phone,
        grade: input.grade,
        lessonId: input.lessonId,
        unitTitle: input.scope === "unit" ? input.unitTitle : lesson?.unitTitle ?? undefined,
        scope: input.scope,
        amount: input.scope === "lesson" ? 30 : 150,
        paymentReference: input.paymentReference,
        proofKey,
        status: "pending",
        accessCode,
      });
      return { id: created?.id, accessCode, status: "pending" as const, amount: input.scope === "lesson" ? 30 : 150 };
    }),
  }),

  teacher: router({
    login: publicProcedure.input(z.object({ username: z.string().min(2).max(160), password: z.string().min(1).max(200) })).mutation(async ({ input, ctx }) => {
      const forwardedFor = ctx.req.headers["x-forwarded-for"];
      const ip = ctx.req.ip || (typeof forwardedFor === "string" ? forwardedFor.split(",")[0]?.trim() : undefined) || "unknown";
      const now = Date.now();
      const attempt = loginAttempts.get(ip);
      if (attempt?.blockedUntil && attempt.blockedUntil > now) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "محاولات كثيرة. حاول بعد دقائق." });
      if (!verifyTeacherCredentials(input.username, input.password)) {
        const nextAttempt = !attempt || attempt.resetAt < now ? { count: 1, resetAt: now + 15 * 60 * 1000, blockedUntil: 0 } : { ...attempt, count: attempt.count + 1 };
        if (nextAttempt.count >= 5) nextAttempt.blockedUntil = now + 10 * 60 * 1000;
        loginAttempts.set(ip, nextAttempt);
        throw new TRPCError({ code: "UNAUTHORIZED", message: "بيانات الدخول غير صحيحة" });
      }
      loginAttempts.delete(ip);
      const token = await createTeacherSession();
      setTeacherSessionCookie(ctx.res, ctx.req, token);
      return { success: true as const, teacherName: process.env.TEACHER_USERNAME ?? "المدرّس" };
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearTeacherSessionCookie(ctx.res);
      return { success: true as const };
    }),
    me: publicProcedure.query(async ({ ctx }) => { const authenticated = await isTeacherRequest(ctx.req); return { authenticated, teacherName: authenticated ? process.env.TEACHER_USERNAME ?? "المدرّس" : undefined }; }),
    setupDailyDigest: teacherProcedure.mutation(async ({ ctx }) => {
      const existing = await getTeacherSettings();
      if (existing?.dailyDigestTaskUid) return { configured: true as const, taskUid: existing.dailyDigestTaskUid };
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      const job = await createHeartbeatJob({ name: "nagib-daily-homework-digest", cron: "0 0 18 * * *", path: "/api/scheduled/daily-homework-digest", description: "ملخص يومي لواجبات ودرجات طلاب النجيب" }, sessionToken);
      await saveTeacherSettings({ id: existing?.id ?? 1, dailyDigestTaskUid: job.taskUid });
      return { configured: true as const, taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt };
    }),
    lessons: teacherProcedure.query(async () => (await listAllLessons()).map(publicLesson)),
    createLesson: teacherProcedure.input(z.object({
      title: z.string().trim().min(2).max(180),
      grade: gradeSchema,
      unitTitle: z.string().trim().min(2).max(180),
      description: z.string().trim().max(1000).optional(),
      externalVideoUrl: z.string().url().optional().or(z.literal("")),
      externalFileUrl: z.string().url().optional().or(z.literal("")),
    })).mutation(async ({ input }) => createLesson({ ...input, slug: safeSlug(input.title), published: 1, externalVideoUrl: input.externalVideoUrl || undefined, externalFileUrl: input.externalFileUrl || undefined })),
    updateLesson: teacherProcedure.input(z.object({
      id: z.number().int().positive(),
      title: z.string().trim().min(2).max(180).optional(),
      grade: gradeSchema.optional(),
      unitTitle: z.string().trim().min(2).max(180).optional(),
      description: z.string().trim().max(1000).optional(),
      externalVideoUrl: z.string().url().optional().or(z.literal("")),
      externalFileUrl: z.string().url().optional().or(z.literal("")),
      published: z.boolean().optional(),
    })).mutation(async ({ input }) => {
      const { id, published, ...rest } = input;
      return updateLesson(id, { ...rest, published: published === undefined ? undefined : published ? 1 : 0, externalVideoUrl: rest.externalVideoUrl || undefined, externalFileUrl: rest.externalFileUrl || undefined });
    }),
    deleteAsset: teacherProcedure.input(z.object({ lessonId: z.number().int().positive(), kind: z.enum(["video", "file"]) })).mutation(async ({ input }) => {
      const lesson = await getLessonById(input.lessonId);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
      const patch = input.kind === "video" ? { videoKey: null, videoName: null, videoMime: null, externalVideoUrl: null } : { fileKey: null, fileName: null, fileMime: null, externalFileUrl: null };
      return updateLesson(input.lessonId, patch);
    }),
    homework: teacherProcedure.query(async () => {
      const rows = await listHomeworkSubmissions();
      return Promise.all(rows.map(async item => ({ ...item, imageUrl: await storageGetSignedUrl(item.imageKey) })));
    }),
    reviewHomework: teacherProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["approved", "rejected"]), score: z.number().int().min(0).max(1000).optional(), teacherNote: z.string().trim().max(2000).optional() })).mutation(async ({ input }) => {
      const current = await getHomeworkSubmissionById(input.id);
      if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "الواجب غير موجود" });
      const reviewed = await updateHomeworkSubmission(input.id, { status: input.status, score: input.score ?? current.score, teacherNote: input.teacherNote, reviewedAt: new Date() });
      if (!reviewed) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر حفظ المراجعة" });
      if (input.status !== "approved") return reviewed;
      const sync = await syncApprovedHomework(reviewed);
      return updateHomeworkSubmission(input.id, { sheetsSyncedAt: sync.synced ? new Date() : null, sheetsSyncError: sync.synced ? null : sync.reason ?? "sync_failed" });
    }),
    uploadAsset: teacherProcedure.input(z.object({
      lessonId: z.number().int().positive(),
      kind: z.enum(["video", "file"]),
      name: z.string().trim().min(1).max(255),
      mime: z.string().trim().min(3).max(100),
      dataBase64: z.string().min(20),
    })).mutation(async ({ input }) => {
      const buffer = Buffer.from(input.dataBase64, "base64");
      validateAsset(input.kind, input.mime, buffer.byteLength);
      const lesson = await getLessonById(input.lessonId);
      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "الحصة غير موجودة" });
      const uploaded = await storagePut(`lessons/${lesson.slug}/${input.kind}-${input.name}`, buffer, input.mime);
      const updated = await updateLesson(input.lessonId, input.kind === "video" ? { videoKey: uploaded.key, videoName: input.name, videoMime: input.mime } : { fileKey: uploaded.key, fileName: input.name, fileMime: input.mime });
      return { success: true as const, lesson: updated && publicLesson(updated) };
    }),
    purchases: teacherProcedure.query(async () => {
      const rows = await listPurchases();
      return Promise.all(rows.map(async item => {
        let proofUrl: string | undefined;
        if (item.proofKey) {
          try { proofUrl = await storageGetSignedUrl(item.proofKey); } catch { proofUrl = undefined; }
        }
        return { ...item, proofKey: undefined, proofUrl };
      }));
    }),
    updatePurchase: teacherProcedure.input(z.object({ id: z.number().int().positive(), status: z.enum(["pending", "confirmed", "rejected"]) })).mutation(async ({ input }) => updatePurchaseStatus(input.id, input.status)),
  }),
});

export type PlatformRouter = typeof platformRouter;
