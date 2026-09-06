import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return { ...actual, getLessonById: vi.fn() };
});

import { getLessonById } from "./db";
import { appRouter } from "./routers";

function context(cookie?: string): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: { cookie } } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("platform authorization", () => {
  it("blocks teacher content management without a teacher session", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.platform.teacher.lessons()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("blocks a lesson asset when the access token is invalid", async () => {
    vi.mocked(getLessonById).mockResolvedValue({
      id: 7,
      title: "حصة اختبار",
      slug: "lesson-test",
      grade: "الأول الإعدادي",
      unitTitle: "النحو",
      description: null,
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
    });

    const caller = appRouter.createCaller(context());
    await expect(caller.platform.lessons.asset({
      lessonId: 7,
      token: "definitely-invalid-access-token-123",
      kind: "file",
    })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("keeps the public pricing contract explicit", async () => {
    const caller = appRouter.createCaller(context());
    await expect(caller.platform.config()).resolves.toMatchObject({ prices: { lesson: 30, unit: 150 } });
  });
});
