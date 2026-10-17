import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);
async function callGemini(prompt: string, apiKey: string, models: string[]) {
  let lastError = "Gemini error";
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseMimeType: "application/json", temperature: 0.4 },
          }),
        },
      );
      const data = await res.json();
      if (res.ok) return { data };

      lastError = data?.error?.message ?? lastError;
      console.error(`Gemini ${model} attempt ${attempt + 1}:`, res.status, lastError);

      // ยุ่ง/ล่มชั่วคราว: รอแล้วลองรุ่นเดิมอีกครั้ง, อย่างอื่น: ข้ามไปรุ่นถัดไปเลย
      const retryable = [429, 500, 503].includes(res.status);
      if (retryable && attempt === 0) {
        await new Promise((r) => setTimeout(r, 1500));
        continue;
      }
      break;
    }
  }
  return { error: lastError };
}
export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { classroom_id } = await req.json();
    if (!classroom_id) {
      return Response.json({ error: "missing classroom_id" }, { status: 400 });
    }

    // ตรวจว่าเป็นครูเจ้าของห้องจริง
    const { data: { user } } = await ctx.supabase.auth.getUser();
    const { data: classroom } = await ctx.supabase
      .from("classrooms")
      .select("id, name, grade_level, teacher_id")
      .eq("id", classroom_id)
      .single();
    if (!user || !classroom || classroom.teacher_id !== user.id) {
      return Response.json({ error: "ไม่มีสิทธิ์ดูห้องเรียนนี้" }, { status: 403 });
    }

    const { count: memberCount } = await ctx.supabase
      .from("classroom_enrollments")
      .select("*", { count: "exact", head: true })
      .eq("classroom_id", classroom_id)
      .eq("status", "accepted");

    const { data: assignments } = await ctx.supabase
      .from("assignments")
      .select("id, title, due_date, max_score")
      .eq("classroom_id", classroom_id);
    const { data: quizzes } = await ctx.supabase
      .from("quizzes")
      .select("id, title, due_date, max_score")
      .eq("classroom_id", classroom_id);

    if (!memberCount || ((assignments?.length ?? 0) + (quizzes?.length ?? 0)) === 0) {
      return Response.json({
        summary: "ห้องนี้ยังไม่มีนักเรียนหรือยังไม่มีงาน จึงยังสรุปภาพรวมไม่ได้",
        concerns: [],
        suggestions: [],
      });
    }

    const { data: aSubs } = await ctx.supabase
      .from("assignment_submissions")
      .select("assignment_id, submitted_at, score")
      .in("assignment_id", (assignments ?? []).map((a) => a.id));
    const { data: qSubs } = await ctx.supabase
      .from("quiz_submissions")
      .select("quiz_id, submitted_at, score, is_graded")
      .in("quiz_id", (quizzes ?? []).map((q) => q.id));

    const now = new Date();

    // รวมสถิติรายงาน (คำนวณเอง ไม่ให้ AI คำนวณ)
    const stat = (
      kind: string,
      item: { id: string; title: string; due_date: string | null; max_score: number | null },
      subs: { submitted_at: string | null; score: number | null }[],
    ) => {
      const submitted = subs.filter((s) => s.submitted_at);
      const scored = submitted.filter((s) => s.score !== null && s.score !== undefined);
      const avgScore = scored.length
        ? scored.reduce((sum, s) => sum + Number(s.score), 0) / scored.length
        : null;
      const due = item.due_date ? new Date(item.due_date) : null;
      return {
        ประเภท: kind,
        ชื่องาน: item.title,
        เลยกำหนดแล้ว: due ? due < now : false,
        ส่งแล้วกี่คน: submitted.length,
        ยังไม่ส่งกี่คน: Math.max(0, (memberCount ?? 0) - submitted.length),
        อัตราส่งเป็นเปอร์เซ็นต์: pct(submitted.length, memberCount),
        ส่งล่าช้ากี่คน: due ? submitted.filter((s) => new Date(s.submitted_at!) > due).length : 0,
        คะแนนเฉลี่ยเป็นเปอร์เซ็นต์: avgScore !== null && item.max_score
          ? Math.round((avgScore / Number(item.max_score)) * 100)
          : null,
        ตรวจแล้วกี่คน: scored.length,
      };
    };

    const items = [
      ...(assignments ?? []).map((a) =>
        stat("การบ้าน", a, (aSubs ?? []).filter((s) => s.assignment_id === a.id))
      ),
      ...(quizzes ?? []).map((q) =>
          stat(
        "แบบทดสอบ",
         q,
        (qSubs ?? [])
           .filter((s) => s.quiz_id === q.id)
          .map((s) => ({ ...s, score: s.is_graded ? s.score : null })),
       )
      ),
    ];

    const prompt = `คุณเป็นผู้ช่วยครู สรุปภาพรวมผลการเรียนของห้องเรียนจากสถิติด้านล่างให้ครูอ่านเข้าใจง่าย
ใช้เฉพาะตัวเลขที่ให้มา ห้ามแต่งตัวเลขหรือข้อมูลเพิ่ม ถ้าข้อมูลไม่พอให้บอกตรงๆ
ตอบเป็นภาษาไทย กระชับ เป็นมิตร
ถ้าจำนวนนักเรียนน้อยกว่า 5 คน ให้ระบุว่าข้อมูลน้อยเกินกว่าจะสรุปแนวโน้มของทั้งห้อง และห้ามใช้เปอร์เซ็นต์เป็นแนวโน้มของห้อง
 แยก "การบ้าน" กับ "แบบทดสอบ" ตามฟิลด์ ประเภท ให้ถูกต้อง ห้ามเรียกรวมกัน
ใช้ฟิลด์ ยังไม่ส่งกี่คน และ เลยกำหนดแล้ว ในการบอกว่างานไหนค้างส่ง ห้ามเดา
 ถ้าคะแนนเฉลี่ยเป็น null แปลว่ายังตรวจไม่ครบ ให้บอกว่ายังประเมินคะแนนไม่ได้
ห้องเรียน: ${classroom.name} (ระดับชั้น ${classroom.grade_level ?? "-"})
จำนวนนักเรียน: ${memberCount} คน

สถิติรายงาน:
${JSON.stringify(items, null, 2)}

ตอบเป็น JSON เท่านั้น โครงสร้างดังนี้
{
  "summary": "สรุปภาพรวม 2-3 ประโยค",
  "concerns": ["ประเด็นที่ควรจับตา ไม่เกิน 3 ข้อ"],
  "suggestions": ["ข้อเสนอแนะที่ครูทำได้จริง ไม่เกิน 3 ข้อ"]
}`;

   
       const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "missing GEMINI_API_KEY" }, { status: 500 });
    }
    const models = [
      Deno.env.get("GEMINI_MODEL") ?? "gemini-3.8-flash",
      Deno.env.get("GEMINI_FALLBACK_MODEL") ?? "gemini-3.1-flash-lite",
    ];

    const result = await callGemini(prompt, apiKey, models);
    if (result.error) {
      return Response.json(
        { error: "ตอนนี้ AI มีผู้ใช้งานจำนวนมาก กรุณาลองใหม่อีกครั้งในอีกสักครู่" },
        { status: 502 },
      );
    }
    const data = result.data;

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    try {
      const parsed = JSON.parse(text);
      return Response.json({
        summary: parsed.summary ?? "",
        concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      });
    } catch {
      // ถ้า AI ไม่ตอบเป็น JSON ให้แสดงข้อความดิบแทน
      return Response.json({ summary: text, concerns: [], suggestions: [] });
    }
  }),
};