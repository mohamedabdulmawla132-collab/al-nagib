import { describe, expect, it } from "vitest";
import { createStudentAccessToken, readStudentAccessToken } from "./studentAccess";

describe("student access tokens", () => {
  it("accepts a token for its lesson", async () => {
    const token = await createStudentAccessToken({
      studentName: "طالب تجريبي",
      recordNumber: "12345",
      lessonId: 7,
      grade: "الأول الإعدادي",
      scope: "lesson",
    });

    const access = await readStudentAccessToken(token, 7);
    expect(access?.studentName).toBe("طالب تجريبي");
    expect(await readStudentAccessToken(token, 8)).toBeNull();
  });

  it("allows a unit token only within the same unit", async () => {
    const token = await createStudentAccessToken({
      studentName: "طالب تجريبي",
      recordNumber: "12345",
      lessonId: 7,
      grade: "الأول الإعدادي",
      scope: "unit",
      unitTitle: "النحو",
    });

    expect(await readStudentAccessToken(token, 99, "النحو")).not.toBeNull();
    expect(await readStudentAccessToken(token, 99, "البلاغة")).toBeNull();
  });
});
