import { invokeLLM } from "./_core/llm";

export type HomeworkGrade = {
  score: number;
  maxScore: number;
  confidence: number;
  extractedText: string;
  feedback: string;
  needsTeacherReview: boolean;
};

const gradingSchema = {
  type: "object",
  properties: {
    score: { type: "integer" },
    maxScore: { type: "integer" },
    confidence: { type: "integer" },
    extractedText: { type: "string" },
    feedback: { type: "string" },
    needsTeacherReview: { type: "boolean" },
  },
  required: ["score", "maxScore", "confidence", "extractedText", "feedback", "needsTeacherReview"],
};

const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : fallback;
};

function parseGrade(raw: unknown, maxScore: number): HomeworkGrade {
  const parsed = typeof raw === "string" ? JSON.parse(raw) : raw as Partial<HomeworkGrade>;
  const score = clamp((parsed as any)?.score, 0, maxScore, 0);
  const confidence = clamp((parsed as any)?.confidence, 0, 100, 0);
  return {
    score,
    maxScore,
    confidence,
    extractedText: typeof (parsed as any)?.extractedText === "string" ? (parsed as any).extractedText.slice(0, 12000) : "",
    feedback: typeof (parsed as any)?.feedback === "string" ? (parsed as any).feedback.slice(0, 4000) : "لم يتمكن المصحح الآلي من استخراج ملاحظات كافية.",
    needsTeacherReview: false,
  };
}

async function gradeWithGemini(input: { dataBase64: string; mime: string; studentName: string; assignmentTitle: string; maxScore: number }) {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GEMINI_API_KEY is not configured");
  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent", {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { text: `أنت المصحح الآلي الرسمي لمنصة النجيب لمادة اللغة العربية. صحح الواجب اعتمادًا على الصورة فقط.
اسم الطالب: ${input.studentName}
عنوان الواجب: ${input.assignmentTitle}
الدرجة القصوى: ${input.maxScore}
استخرج الإجابات الظاهرة، قيّم صحتها وفق قواعد اللغة العربية، ثم أعط درجة من ${input.maxScore}. لا تخمّن أي إجابة غير واضحة. إذا كانت الصورة غير مقروءة بدرجة كبيرة، اذكر ذلك بوضوح في feedback واختر درجة محافظة. أعد JSON مطابقًا للمخطط فقط.` },
        { inline_data: { mime_type: input.mime, data: input.dataBase64 } },
      ] }],
      generationConfig: {
        responseFormat: { text: { mimeType: "application/json", schema: gradingSchema } },
        temperature: 0.1,
      },
    }),
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const json = await response.json() as any;
  const text = json?.candidates?.[0]?.content?.parts?.map((p: any) => p.text || "").join("");
  if (!text) throw new Error("Gemini returned no grading result");
  return parseGrade(text, input.maxScore);
}

async function gradeWithForge(input: { dataBase64: string; mime: "image/jpeg" | "image/png" | "image/webp"; studentName: string; assignmentTitle: string; maxScore: number }) {
  const response = await invokeLLM({
    model: "gemini-2.5-flash",
    messages: [
      { role: "system", content: "أنت المصحح الآلي الرسمي لمنصة النجيب لمادة اللغة العربية. اقرأ صورة الواجب بدقة، استخرج النص الظاهر فقط، وصحح الإجابات الظاهرة. لا تخمّن. أخرج JSON فقط باللغة العربية." },
      { role: "user", content: [
        { type: "text", text: `اسم الطالب: ${input.studentName}\nعنوان الواجب: ${input.assignmentTitle}\nالدرجة القصوى: ${input.maxScore}\nأعط الدرجة والتغذية الراجعة والنص المستخرج.` },
        { type: "image_url", image_url: { url: `data:${input.mime};base64,${input.dataBase64}`, detail: "high" } },
      ] },
    ],
    response_format: { type: "json_schema", json_schema: { name: "homework_grade", strict: true, schema: gradingSchema } },
    maxTokens: 6000,
  });
  const content = response.choices?.[0]?.message?.content;
  return parseGrade(typeof content === "string" ? content : JSON.stringify(content), input.maxScore);
}

export async function gradeHomeworkImage(input: { dataBase64: string; mime: "image/jpeg" | "image/png" | "image/webp"; studentName: string; assignmentTitle: string; maxScore?: number }): Promise<HomeworkGrade> {
  const maxScore = input.maxScore ?? 10;
  try {
    return await gradeWithGemini({ ...input, maxScore });
  } catch (geminiError) {
    console.warn("[Homework] Direct Gemini grading failed, trying platform AI gateway:", geminiError);
    return gradeWithForge({ ...input, maxScore });
  }
}
