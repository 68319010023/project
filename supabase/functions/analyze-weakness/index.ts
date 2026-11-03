// supabase/functions/analyze-weakness/index.ts
import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { callGemini, getModels } from "../_shared/gemini.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { student_id, classroom_id } = await req.json();
    if (!student_id || !classroom_id) {
      return Response.json({ error: "missing params" }, { status: 400 });
    }

    // ตรวจว่าเป็นครูเจ้าของห้อง
    const { data: { user } } = await ctx.supabase.auth.getUser();
    const { data: classroom } = await ctx.supabase
      .from("classrooms").select("id, teacher_id").eq("id", classroom_id).single();
    if (!user || !classroom || classroom.teacher_id !== user.id) {
      return Response.json({ error: "ไม่มีสิทธิ์ดูห้องเรียนนี้" }, { status: 403 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return Response.json({ error: "missing GEMINI_API_KEY" }, { status: 500 });

    const t0 = Date.now();
    const now = new Date();
    const [{ data: enr }, { data: assignments }, { data: quizzes }] = await Promise.all([
      ctx.supabase.from("classroom_enrollments").select("id")
        .eq("classroom_id", classroom_id).eq("student_id", student_id)
        .eq("status", "accepted").maybeSingle(),
      ctx.supabase.from("assignments")
        .select("id, title, due_date, max_score").eq("classroom_id", classroom_id),
      ctx.supabase.from("quizzes")
        .select("id, title, due_date, max_score").eq("classroom_id", classroom_id),
    ]);
    if (!enr) return Response.json({ error: "ไม่พบนักเรียนในห้องนี้" }, { status: 404 });

    const aIds = (assignments ?? []).map((a) => a.id);
    const qIds = (quizzes ?? []).map((q) => q.id);
    const [{ data: aSubs }, { data: qSubs }] = await Promise.all([
      aIds.length
        ? ctx.supabase.from("assignment_submissions")
            .select("assignment_id, score, feedback, submitted_at")
            .eq("student_id", student_id).in("assignment_id", aIds)
        : Promise.resolve({ data: [] }),
      qIds.length
        ? ctx.supabase.from("quiz_submissions")
            .select("quiz_id, score, is_graded, submitted_at")
            .eq("student_id", student_id).in("quiz_id", qIds)
        : Promise.resolve({ data: [] }),
    ]);

    const toRow = (
      kind: string,
      item: { title: string; due_date: string | null; max_score: number | null },
      sub: any,
    ) => {
      const max = Number(item.max_score) || 100;
      const due = item.due_date ? new Date(item.due_date) : null;
      const submitted = !!sub?.submitted_at;
      const graded = submitted && sub.score != null && (kind === "การบ้าน" || sub.is_graded);
      if (!submitted && !(due && due < now)) return null; // ยังไม่ถึงกำหนด ไม่นับ
      return {
        ประเภท: kind,
        ชื่องาน: item.title,
        สถานะ: !submitted ? "ไม่ได้ส่ง (เลยกำหนดแล้ว)" : graded ? "ตรวจแล้ว" : "ส่งแล้วรอตรวจ",
        ...(graded
          ? { คะแนน: `${sub.score}/${max}`, เปอร์เซ็นต์: Math.round((Number(sub.score) / max) * 100) }
          : {}),
        ส่งล่าช้า: submitted && due ? new Date(sub.submitted_at) > due : false,
        ...(sub?.feedback ? { feedback_จากครู: sub.feedback } : {}),
      };
    };

    const rows = [
      ...(assignments ?? []).map((a) =>
        toRow("การบ้าน", a, (aSubs ?? []).find((s) => s.assignment_id === a.id))),
      ...(quizzes ?? []).map((q) =>
        toRow("แบบทดสอบ", q, (qSubs ?? []).find((s) => s.quiz_id === q.id))),
    ].filter(Boolean);

    if (rows.length === 0) {
      return Response.json({ ok: false, reason: "no_graded_work" });
    }
    // ไม่ส่งชื่อนักเรียนไปให้ AI
    const prompt = `คุณเป็นผู้ช่วยครู วิเคราะห์ผลการเรียนของนักเรียนหนึ่งคนจากข้อมูลด้านล่าง
กติกา:
- ใช้เฉพาะข้อมูลที่ให้มา (ประเภท ชื่องาน สถานะ คะแนน feedback จากครู) ห้ามแต่งเนื้อหาหรือหัวข้อที่ไม่มีในข้อมูล
- แยกประเด็นด้านผลการเรียน (คะแนนการบ้าน/แบบทดสอบ) ออกจากประเด็นด้านวินัย (ส่งล่าช้า/ไม่ได้ส่ง) และเปรียบเทียบการบ้านกับแบบทดสอบถ้ามีทั้งสองประเภท
- จุดแข็งต้องอิงจากตัวเลขหรือ feedback โดยตรงเท่านั้น ห้ามอนุมานนิสัยหรือเจตคติของนักเรียน
- ถ้ามีรายการข้อมูลน้อยกว่า 3 ชิ้น ให้ระบุว่าข้อมูลน้อย และตั้ง confidence ต่ำ (ไม่เกิน 0.4)
- ตอบเป็นภาษาไทย กระชับ เป็นมิตร


ข้อมูลงานทั้งหมดของนักเรียนในห้องนี้ (รวมงานที่ไม่ได้ส่ง):
${JSON.stringify(rows, null, 2)}

ตอบเป็น JSON เท่านั้น โครงสร้างดังนี้
{
  "summary": "สรุปภาพรวม 1-2 ประโยค",
  "weaknesses": [{"topic": "หัวข้อ", "evidence": "หลักฐานจากข้อมูล"}],
  "strengths": ["จุดแข็ง ไม่เกิน 3 ข้อ"],
  "suggestions": ["แนวทางช่วยเหลือที่ครูทำได้จริง ไม่เกิน 3 ข้อ"],
  "confidence": 0.0
}`;


    const t1 = Date.now();
    const result = await callGemini({
      apiKey,
      models: getModels(),
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      json: true,
      temperature: 0.3,
      thinkingLevel: Deno.env.get("GEMINI_THINKING_LEVEL") ?? "low",
    });
    if (result.error) {
      console.error(`weakness failed: db=${t1 - t0}ms gemini=${Date.now() - t1}ms`);
      return Response.json({ error: "AI ใช้งานไม่ได้ชั่วคราว" }, { status: 502 });
    }
    console.log(`weakness: db=${t1 - t0}ms gemini=${Date.now() - t1}ms model=${result.model}`);

    await logAiUsage(ctx.supabaseAdmin, {
      user_id: user.id,
      classroom_id,
      feature: "weakness",
      model: result.model,
      usage: result.data.usageMetadata,
    });

    const text = (result.data.candidates?.[0]?.content?.parts ?? [])
      .filter((p: any) => !p.thought)
      .map((p: any) => p.text ?? "")
      .join("");
    let parsed: any = {};
    try {
      parsed = JSON.parse(text);
    } catch {
      return Response.json({ error: "bad_json_from_model" }, { status: 502 });
    }

    const out = {
      summary: parsed.summary ?? "",
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
       based_on: {
        total: rows.length,
        graded: rows.filter((r: any) => r.สถานะ === "ตรวจแล้ว").length,
      },
    };
    const confidence = Math.min(1, Math.max(0, Number(parsed.confidence) || 0));

    const { error: saveErr } = await ctx.supabaseAdmin
      .from("ai_analysis_cache")
      .upsert(
        {
          student_id,
          classroom_id,
          analysis_type: "weakness",
          result: out,
          confidence,
          created_at: new Date().toISOString(),
        },
        { onConflict: "student_id,classroom_id,analysis_type" },
      );
    if (saveErr) console.error("save weakness failed:", saveErr.message);

    return Response.json({ ok: true, result: out, confidence });
  }),
};