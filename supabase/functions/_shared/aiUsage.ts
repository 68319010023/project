type Usage = {
  promptTokenCount?: number;
  totalTokenCount?: number;
};

// totalTokenCount ของ Gemini รวม token ที่ใช้คิด (thinking) ด้วย
// จึงคำนวณ output = total - prompt เพื่อให้ตรงกับที่ถูกนับโควตาจริง
export async function logAiUsage(
  admin: any,
  row: {
    user_id: string | null;
    classroom_id: string | null;
    feature: string;
    model: string;
    usage?: Usage;
  },
) {
  const prompt = row.usage?.promptTokenCount ?? 0;
  const total = row.usage?.totalTokenCount ?? prompt;

  try {
    const { error } = await admin.from("ai_usage_log").insert({
     user_id: row.user_id,
    classroom_id: row.classroom_id,
    feature: row.feature,
    model: row.model,
     prompt_tokens: prompt,
     output_tokens: Math.max(0, total - prompt),
      total_tokens: total,
   });
    if (error) console.error("logAiUsage failed:", error.message);
  } catch (e) {
    console.error("logAiUsage threw:", String(e));
 }
}