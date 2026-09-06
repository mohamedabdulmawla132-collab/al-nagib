import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getLessonById: vi.fn(), findConfirmedPurchase: vi.fn() };
});
vi.mock("./roster", () => ({ verifyStudentInRoster: vi.fn() }));

import { getLessonById, findConfirmedPurchase } from "./db";
import { appRouter } from "./routers";
import { verifyStudentInRoster } from "./roster";
import { readStudentAccessToken } from "./studentAccess";

const lesson = {
  id: 7,
  title: "حصة اختبار",
  slug: "lesson-test",
  grade: "الأول الإعدادي",
  unitTitle: "النحو",
  description: "وصف",
  videoKey: null,
  videoName: null,
  videoMime: null,
  externalVideoUrl: null,
  fileKey: "lesson-key",
  fileName: "lesson.pdf",
  fileMime: "application/pdf",
  externalFileUrl: null,
  published: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

function context(): TrpcContext {
  return { user: null, req: { headers: {} } as TrpcContext["req"], res: {} as TrpcContext["res"] };
}

describe("student paid access flow", () => {
  it("issues access after a confirmed purchase", async () => {
    vi.mocked(getLessonById).mockResolvedValue(lesson);
    vi.mocked(verifyStudentInRoster).mockResolvedValue({ valid: false, reason: "student_not_found" });
    vi.mocked(findConfirmedPurchase).mockResolvedValue({
      id: 1,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      grade: "الأول الإعدادي",
      lessonId: 7,
      unitTitle: "النحو",
      scope: "lesson",
      amount: 30,
      paymentReference: "TX-1",
      proofKey: null,
      status: "confirmed",
      accessCode: "NG-TEST123456",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await appRouter.createCaller(context()).platform.student.verify({
      lessonId: 7,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      accessCode: "NG-TEST123456",
    });

    expect(result.source).toBe("purchase");
    expect(await readStudentAccessToken(result.accessToken, 7)).not.toBeNull();
  });

  it("does not issue access for an unconfirmed or missing purchase", async () => {
    vi.mocked(getLessonById).mockResolvedValue(lesson);
    vi.mocked(verifyStudentInRoster).mockResolvedValue({ valid: false, reason: "student_not_found" });
    vi.mocked(findConfirmedPurchase).mockResolvedValue(undefined);

    await expect(appRouter.createCaller(context()).platform.student.verify({
      lessonId: 7,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      accessCode: "NG-NOTCONFIRMED",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
