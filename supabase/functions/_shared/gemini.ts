type Opts = {
  apiKey: string;
  models: string[];
  contents: { role: "user" | "model"; parts: { text: string }[] }[];
  systemInstruction?: string;
  json?: boolean;
  temperature?: number;
  thinkingLevel?: string;
  onTry?: (model: string) => void;
};

export function getModels(): string[] {
  return (Deno.env.get("GEMINI_MODELS") ?? "gemini-3.1-flash-lite,gemini-3.8-flash")
    .split(",").map((m) => m.trim()).filter(Boolean);
}

async function request(model: string, o: Opts, withThinking: boolean) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": o.apiKey },
      body: JSON.stringify({
        contents: o.contents,
        ...(o.systemInstruction
          ? { systemInstruction: { parts: [{ text: o.systemInstruction }] } }
          : {}),
        generationConfig: {
          temperature: o.temperature ?? 0.4,
          ...(o.json ? { responseMimeType: "application/json" } : {}),
          ...(withThinking && o.thinkingLevel
            ? { thinkingConfig: { thinkingLevel: o.thinkingLevel } }
            : {}),
        },
      }),
    },
  );
  const data = await res.json();
  return { res, data };
}

export async function callGemini(o: Opts) {
  let lastError = "Gemini error";
  for (const model of o.models) {
    o.onTry?.(model);
    try {
      let { res, data } = await request(model, o, true);

      // รุ่นนี้ไม่รับ thinkingLevel → ลองรุ่นเดิมซ้ำโดยไม่ใส่
      if (res.status === 400 && o.thinkingLevel) {
        console.error(`Gemini ${model} rejected thinkingLevel:`, data?.error?.message);
        ({ res, data } = await request(model, o, false));
      }

      if (res.ok) return { data, model };
      lastError = data?.error?.message ?? lastError;
      console.error(`Gemini ${model}:`, res.status, lastError);
    } catch (e) {
      lastError = String(e);
      console.error(`Gemini ${model} threw:`, lastError);
    }
  }
  return { error: lastError };
}