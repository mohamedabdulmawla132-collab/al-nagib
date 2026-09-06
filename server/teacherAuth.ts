import { createHash, timingSafeEqual } from "node:crypto";
import { SignJWT, jwtVerify } from "jose";
import { ENV } from "./_core/env";

export const TEACHER_COOKIE = "teacher_session";
const SESSION_TTL_SECONDS = 60 * 60 * 8;

function readCookieHeader(header: string, name: string) {
  const match = header.split(";").map(part => part.trim()).find(part => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined;
}

function writeCookie(name: string, value: string, options: { httpOnly: boolean; sameSite: "lax"; secure: boolean; path: string; maxAge: number }) {
  return `${name}=${encodeURIComponent(value)}; Max-Age=${options.maxAge}; Path=${options.path}; SameSite=Lax${options.httpOnly ? "; HttpOnly" : ""}${options.secure ? "; Secure" : ""}`;
}

export function jwtSecretKey() {
  if (!ENV.cookieSecret) {
    throw new Error("JWT_SECRET is required for teacher sessions");
  }
  return new TextEncoder().encode(ENV.cookieSecret);
}

function constantTimeEqual(left: string, right: string) {
  const leftHash = createHash("sha256").update(left).digest();
  const rightHash = createHash("sha256").update(right).digest();
  return timingSafeEqual(leftHash, rightHash);
}

export function verifyTeacherCredentials(username: string, password: string) {
  const expectedUsername = process.env.TEACHER_USERNAME ?? "";
  const expectedPassword = process.env.TEACHER_PASSWORD ?? "";
  return Boolean(expectedUsername && expectedPassword)
    && constantTimeEqual(username.trim(), expectedUsername)
    && constantTimeEqual(password, expectedPassword);
}

export async function createTeacherSession() {
  return new SignJWT({ role: "teacher", name: process.env.TEACHER_USERNAME ?? "" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject("teacher")
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(jwtSecretKey());
}

export async function isTeacherRequest(req: { headers: { cookie?: string } }) {
  const token = readCookieHeader(req.headers.cookie ?? "", TEACHER_COOKIE);
  if (!token) return false;

  try {
    const { payload } = await jwtVerify(token, jwtSecretKey());
    return payload.sub === "teacher" && payload.role === "teacher";
  } catch {
    return false;
  }
}

export function setTeacherSessionCookie(
  res: { setHeader?: (name: string, value: string | string[]) => void },
  req: { protocol?: string; headers: Record<string, string | string[] | undefined> },
  token: string,
) {
  const forwardedProto = req.headers["x-forwarded-proto"];
  const isHttps = req.protocol === "https"
    || (typeof forwardedProto === "string" && forwardedProto.split(",").some(v => v.trim() === "https"));
  const header = writeCookie(TEACHER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isHttps,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
  res.setHeader?.("Set-Cookie", header);
}

export function clearTeacherSessionCookie(
  res: { setHeader?: (name: string, value: string | string[]) => void },
) {
  res.setHeader?.("Set-Cookie", writeCookie(TEACHER_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: 0,
  }));
}
