import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { logAiUsage } from "../_shared/aiUsage.ts";
import { callGemini, getModels } from "../_shared/gemini.ts";

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : null);

export default {
  fetch: withSupabase({ auth: "user" }, async (req, ctx) => {
    const { classroom_id } = await req.json();
    if (!classroom_id) {
      return Response.json({ error: "missing classroom_id" }, { status: 400 });
    }

    // ตรวจสิทธิ์ก่อนเริ่มส่งสตรีม (ถ้าไม่ผ่านจะตอบ JSON ปกติ)
    const { data: { user } } = await ctx.supabase.auth.getUser();
    const { data: classroom } = await ctx.supabase
      .from("classrooms")
      .select("id, name, grade_level, teacher_id")
      .eq("id", classroom_id)
      .single();
    if (!user || !classroom || classroom.teacher_id !== user.id) {
      return Response.json({ error: "ไม่มีสิทธิ์ดูห้องเรียนนี้" }, { status: 403 });
    }

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "missing GEMINI_API_KEY" }, { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (obj: unknown) =>
          controller.enqueue(encoder.encode(JSON.stringify(obj) + "\n"));
        const stage = (key: string, text: string) => send({ type: "stage", key, text });

        try {
          stage("collect", "กำลังรวบรวมข้อมูลห้องเรียน...");

          const [{ count }, { data: assignments }, { data: quizzes }] = await Promise.all([
            ctx.supabase.from("classroom_enrollments")
              .select("*", { count: "exact", head: true })
              .eq("classroom_id", classroom_id).eq("status", "accepted"),
            ctx.supabase.from("assignments")
              .select("id, title, due_date, max_score").eq("classroom_id", classroom_id),
            ctx.supabase.from("quizzes")
              .select("id, title, due_date, max_score").eq("classroom_id", classroom_id),
          ]);
          const memberCount = count ?? 0;

          if (!memberCount || ((assignments?.length ?? 0) + (quizzes?.length ?? 0)) === 0) {
            send({
              type: "result",
              data: {
                summary: "ห้องนี้ยังไม่มีนักเรียนหรือยังไม่มีงาน จึงยังสรุปภาพรวมไม่ได้",
                concerns: [],
                suggestions: [],
              },
              updated_at: new Date().toISOString(),
            });
            return;
          }

          const [{ data: aSubs }, { data: qSubs }] = await Promise.all([
            ctx.supabase.from("assignment_submissions")
              .select("assignment_id, submitted_at, score")
              .in("assignment_id", (assignments ?? []).map((a) => a.id)),
            ctx.supabase.from("quiz_submissions")
              .select("quiz_id, submitted_at, score, is_graded")
              .in("quiz_id", (quizzes ?? []).map((q) => q.id)),
          ]);

          stage(
            "stats",
            `กำลังคำนวณสถิติ (${memberCount} นักเรียน, ${(assignments?.length ?? 0) + (quizzes?.length ?? 0)} งาน)...`,
          );

          const now = new Date();
          const stat = (
            kind: string,
            item: { title: string; due_date: string | null; max_score: number | null },
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
              ยังไม่ส่งกี่คน: Math.max(0, memberCount - submitted.length),
              อัตราส่งเป็นเปอร์เซ็นต์: pct(submitted.length, memberCount),
              ส่งล่าช้ากี่คน: due
                ? submitted.filter((s) => new Date(s.submitted_at!) > due).length
                : 0,
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
กติกา:
- ใช้เฉพาะตัวเลขที่ให้มา ห้ามแต่งตัวเลขหรือข้อมูลเพิ่ม ถ้าข้อมูลไม่พอให้บอกตรงๆ
- ตอบเป็นภาษาไทย กระชับ เป็นมิตร
- ถ้าจำนวนนักเรียนน้อยกว่า 5 คน ให้ระบุว่าข้อมูลน้อยเกินกว่าจะสรุปแนวโน้มของทั้งห้อง และห้ามใช้เปอร์เซ็นต์เป็นแนวโน้มของห้อง
- แยก "การบ้าน" กับ "แบบทดสอบ" ตามฟิลด์ ประเภท ให้ถูกต้อง ห้ามเรียกรวมกัน
- ใช้ฟิลด์ ยังไม่ส่งกี่คน และ เลยกำหนดแล้ว ในการบอกว่างานไหนค้างส่ง ห้ามเดา
- ถ้าคะแนนเฉลี่ยเป็น null แปลว่ายังตรวจไม่ครบ ให้บอกว่ายังประเมินคะแนนไม่ได้

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

          stage("ai", "กำลังส่งข้อมูลให้ AI วิเคราะห์...");
          let tries = 0;
          const result = await callGemini({
            apiKey,
            models: getModels(),
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            json: true,
            temperature: 0.4,
            thinkingLevel: Deno.env.get("GEMINI_THINKING_LEVEL") ?? "low",
            onTry: (model) => {
              tries++;
              stage(
                "ai",
                tries === 1
                  ? `AI กำลังวิเคราะห์ข้อมูล (${model})...`
                  : `รุ่นก่อนหน้าไม่ตอบสนอง กำลังลองรุ่นสำรอง (${model})...`,
              );
            },
          });

          if (result.error) {
            send({
              type: "error",
              message: "ตอนนี้ AI ยังใช้งานไม่ได้ กรุณาลองใหม่อีกครั้งในอีกสักครู่",
            });
            return;
          }

          await logAiUsage(ctx.supabaseAdmin, {
            user_id: user.id,
            classroom_id,
            feature: "classroom_summary",
            model: result.model,
            usage: result.data.usageMetadata,
          });

          stage("save", "กำลังจัดรูปแบบและบันทึกผล...");
          const text = result.data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
          let parsed: any = {};
          try {
            parsed = JSON.parse(text);
          } catch {
            parsed = { summary: text };
          }
          const out = {
            summary: parsed.summary ?? "",
            concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
            suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
          };

          const updated_at = new Date().toISOString();
          try {
            await ctx.supabaseAdmin
              .from("ai_summaries")
              .upsert({ classroom_id, result: out, updated_at }, { onConflict: "classroom_id" });
          } catch (e) {
            console.error("save summary failed:", String(e));
          }

          send({ type: "result", data: out, updated_at });
        } catch (e) {
          console.error("summarize-classroom failed:", String(e));
          send({ type: "error", message: "เกิดข้อผิดพลาดระหว่างสรุป กรุณาลองใหม่" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  }),
};