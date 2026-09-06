import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyStudentInRoster } from "./roster";

afterEach(() => vi.unstubAllGlobals());

describe("Google Sheets roster verification", () => {
  it("matches Arabic names and phone numbers from the published CSV", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("الاسم,رقم الكشف\nأحمد رضا,٠١٢٨٣١٢٩٩٤٧\n")));
    await expect(verifyStudentInRoster(" أحمد رضا ", "01283129947")).resolves.toMatchObject({ valid: true, reason: "matched" });
  });

  it("fails closed when the roster is unavailable or empty", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));
    await expect(verifyStudentInRoster("طالب", "01000000000")).resolves.toMatchObject({ valid: false, reason: "student_not_found" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("error", { status: 503 })));
    await expect(verifyStudentInRoster("طالب", "01000000000")).resolves.toMatchObject({ valid: false, reason: "roster_unavailable" });
  });
});
