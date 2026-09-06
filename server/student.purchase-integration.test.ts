import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    getLessonById: vi.fn(),
    createPurchase: vi.fn(),
    findConfirmedPurchase: vi.fn(),
    updatePurchaseStatus: vi.fn(),
  };
});
vi.mock("./roster", () => ({ verifyStudentInRoster: vi.fn() }));

import { createPurchase, findConfirmedPurchase, getLessonById, updatePurchaseStatus } from "./db";
import { appRouter } from "./routers";
import { verifyStudentInRoster } from "./roster";

const lesson = {
  id: 7,
  title: "أسلوب الشرط",
  slug: "conditional-style",
  grade: "الأول الإعدادي",
  unitTitle: "النحو",
  description: "حصة تجريبية",
  videoKey: null,
  videoName: null,
  videoMime: null,
  externalVideoUrl: "https://video.example/lesson-7",
  fileKey: null,
  fileName: null,
  fileMime: null,
  externalFileUrl: null,
  published: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
} as const;

function context(cookie?: string, setHeader?: (name: string, value: string | string[]) => void): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { cookie } } as TrpcContext["req"],
    res: { setHeader } as TrpcContext["res"],
  };
}

describe("purchase to protected lesson integration", () => {
  it("rejects before confirmation, then confirms through teacher and opens the lesson asset", async () => {
    vi.mocked(getLessonById).mockResolvedValue(lesson);
    vi.mocked(createPurchase).mockResolvedValue({ id: 101 } as never);
    vi.mocked(verifyStudentInRoster).mockResolvedValue({ valid: false, reason: "student_not_found" });
    vi.mocked(updatePurchaseStatus).mockImplementation(async (id, status) => ({ id, status }) as never);

    const studentCaller = appRouter.createCaller(context());
    const request = await studentCaller.platform.purchase.create({
      studentName: "طالب تجريبي",
      phone: "01000000000",
      grade: "الأول الإعدادي",
      lessonId: 7,
      scope: "lesson",
      paymentReference: "TX-101",
    });

    vi.mocked(findConfirmedPurchase).mockResolvedValue(undefined);
    await expect(studentCaller.platform.student.verify({
      lessonId: 7,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      accessCode: request.accessCode,
    })).rejects.toMatchObject({ code: "FORBIDDEN" });

    let setCookie = "";
    const teacherCaller = appRouter.createCaller(context(undefined, (name, value) => {
      if (name === "Set-Cookie") setCookie = Array.isArray(value) ? value[0] ?? "" : value;
    }));
    await teacherCaller.platform.teacher.login({
      username: process.env.TEACHER_USERNAME ?? "",
      password: process.env.TEACHER_PASSWORD ?? "",
    });
    expect(setCookie).toContain("teacher_session=");

    const confirmedPurchase = {
      id: 101,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      grade: "الأول الإعدادي",
      lessonId: 7,
      unitTitle: "النحو",
      scope: "lesson",
      amount: 30,
      paymentReference: "TX-101",
      proofKey: null,
      status: "confirmed",
      accessCode: request.accessCode,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as const;
    vi.mocked(findConfirmedPurchase).mockResolvedValue(confirmedPurchase);

    const teacherSessionCookie = setCookie.split(";")[0];
    const protectedTeacherCaller = appRouter.createCaller(context(teacherSessionCookie));
    await expect(protectedTeacherCaller.platform.teacher.updatePurchase({ id: 101, status: "confirmed" })).resolves.toMatchObject({ status: "confirmed" });

    const access = await studentCaller.platform.student.verify({
      lessonId: 7,
      studentName: "طالب تجريبي",
      phone: "01000000000",
      accessCode: request.accessCode,
    });
    expect(access.source).toBe("purchase");

    await expect(studentCaller.platform.lessons.asset({ lessonId: 7, kind: "video", token: access.accessToken })).resolves.toMatchObject({
      url: "https://video.example/lesson-7",
    });
  });
});
