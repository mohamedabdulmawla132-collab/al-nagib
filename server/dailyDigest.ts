import type { Request, Response } from "express";
import { getTeacherSettingsByTaskUid, listHomeworkSubmissionsBetween, saveTeacherSettings } from "./db";
import { notifyOwner } from "./_core/notification";
import { sdk } from "./_core/sdk";

export async function dailyHomeworkDigestHandler(req: Request, res: Response) {
  const timestamp = new Date().toISOString();
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const settings = await getTeacherSettingsByTaskUid(user.taskUid);
    if (!settings) return res.json({ ok: true, skipped: "orphan" });
    const now = new Date();
    if (settings.lastDigestAt && now.getTime() - settings.lastDigestAt.getTime() < 20 * 60 * 60 * 1000) return res.json({ ok: true, skipped: "already-sent" });
    const start = settings.lastDigestAt ?? new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const rows = await listHomeworkSubmissionsBetween(start, now);
    const content = rows.length === 0
      ? "لا توجد واجبات جديدة خلال الفترة الأخيرة."
      : rows.map((item, index) => `${index + 1}. ${item.studentName} — ${item.phone} — ${item.grade} — ${item.assignmentTitle} — الدرجة: ${item.score ?? "قيد المراجعة"}/${item.maxScore} — الحالة: ${item.status}`).join("\n");
    const sent = await notifyOwner({ title: "ملخص واجبات النجيب اليومي", content });
    await saveTeacherSettings({ id: settings.id, lastDigestAt: now });
    return res.json({ ok: true, sent, count: rows.length });
  } catch (error) {
    return res.status(500).json({ error: String(error), timestamp });
  }
}
