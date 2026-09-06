import { SignJWT, jwtVerify } from "jose";
import { jwtSecretKey } from "./teacherAuth";

export type StudentAccess = {
  studentName: string;
  recordNumber?: string;
  /** Legacy compatibility for existing sessions/tests. New clients should use recordNumber. */
  phone?: string;
  lessonId: number;
  grade: string;
  scope: "lesson" | "unit";
  unitTitle?: string;
};

export async function createStudentAccessToken(access: StudentAccess) {
  return new SignJWT({
    type: "student_access",
    studentName: access.studentName,
    recordNumber: access.recordNumber ?? access.phone ?? "",
    lessonId: access.lessonId,
    grade: access.grade,
    scope: access.scope,
    unitTitle: access.unitTitle,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("student")
    .setIssuedAt()
    .setExpirationTime("2h")
    .sign(jwtSecretKey());
}

export async function readStudentAccessToken(token: string, lessonId: number, unitTitle?: string) {
  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    if (payload.sub !== "student" || payload.type !== "student_access") return null;
    if (payload.scope === "unit" && unitTitle && payload.unitTitle !== unitTitle) return null;
    if (Number(payload.lessonId) !== lessonId && payload.scope !== "unit") return null;
    return payload as unknown as StudentAccess;
  } catch {
    return null;
  }
}
