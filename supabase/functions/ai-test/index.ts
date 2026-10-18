import "@supabase/functions-js/edge-runtime.d.ts";
import { withSupabase } from "@supabase/server";
import { logAiUsage } from "../_shared/aiUsage.ts";

export default {
  fetch: withSupabase({ auth: "user" }, async (req, _ctx) => {
    const { prompt } = await req.json();

    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) {
      return Response.json({ error: "missing GEMINI_API_KEY" }, { status: 500 });
    }
    const model = Deno.env.get("GEMINI_MODEL") ?? "gemini-2.5-flash";

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      return Response.json(
        { error: data?.error?.message ?? "Gemini error" },
        { status: 502 },
      );
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return Response.json({ text });
  }),
};