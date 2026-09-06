import type { HomeworkSubmission } from "../drizzle/schema";

export type HomeworkSyncResult = { synced: boolean; reason?: string };

export async function syncApprovedHomework(submission: HomeworkSubmission): Promise<HomeworkSyncResult> {
  const endpoint = process.env.GOOGLE_SHEETS_UPDATE_WEBHOOK_URL?.trim();
  if (!endpoint) return { synced: false, reason: "missing_configuration" };

  const token = process.env.GOOGLE_SHEETS_UPDATE_TOKEN?.trim();
  const headers: Record<string, string> = { "content-type": "application/json", accept: "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const payload = {
    submissionId: submission.id,
    studentName: submission.studentName,
    phone: submission.phone,
    grade: submission.grade,
    lessonId: submission.lessonId,
    assignmentTitle: submission.assignmentTitle,
    score: submission.score,
    maxScore: submission.maxScore,
    feedback: submission.feedback,
    reviewedAt: submission.reviewedAt?.toISOString() ?? new Date().toISOString(),
    ...(token ? { token } : {}),
  };

  const response = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    return { synced: false, reason: `webhook_${response.status}${detail ? `: ${detail.slice(0, 180)}` : ""}` };
  }
  return { synced: true };
}
