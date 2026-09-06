import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createContext(): { ctx: TrpcContext; headers: string[] } {
  const headers: string[] = [];
  return {
    headers,
    ctx: {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: {
        setHeader: (_name: string, value: string | string[]) => {
          headers.push(...(Array.isArray(value) ? value : [value]));
        },
      } as TrpcContext["res"],
    },
  };
}

describe("teacher.login", () => {
  it("accepts the server-configured teacher secret pair", async () => {
    const { ctx, headers } = createContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.platform.teacher.login({
      username: process.env.TEACHER_USERNAME ?? "",
      password: process.env.TEACHER_PASSWORD ?? "",
    });

    expect(result.success).toBe(true);
    expect(result.teacherName).toBe("أ. احمد رضا");
    expect(headers.join(";")).toContain("teacher_session=");
    expect(headers.join(";")).toContain("HttpOnly");
  });

  it("rejects a wrong password", async () => {
    const { ctx } = createContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.platform.teacher.login({
        username: process.env.TEACHER_USERNAME ?? "",
        password: "wrong-password",
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
