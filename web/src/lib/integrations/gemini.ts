import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RuleAlert } from "@/lib/insights/rules";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

const SYSTEM = `あなたはWebマーケティングの上級データアナリストです。
クライアントのWeb担当者に向けて、専門用語を避け、具体的なアクションを提案してください。
必ず次の JSON だけを返答してください（前後に説明文を付けないこと）:
{
  "summary": "string",
  "findings": [
    {
      "category": "seo|traffic|ux|conversion",
      "severity": "high|medium|low",
      "title": "string",
      "observation": "string",
      "hypothesis": "string",
      "risk": "string",
      "actions": ["string"],
      "expectedImpact": "string"
    }
  ],
  "topPriority": { "action": "string", "reason": "string" }
}`;

export type GeminiInsightPayload = {
  summary: string;
  findings: Array<{
    category: "seo" | "traffic" | "ux" | "conversion";
    severity: "high" | "medium" | "low";
    title: string;
    observation: string;
    hypothesis: string;
    risk: string;
    actions: string[];
    expectedImpact: string;
  }>;
  topPriority: { action: string; reason: string };
};

function safeParse(json: string): GeminiInsightPayload | null {
  try {
    const cleaned = json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
    const obj = JSON.parse(cleaned) as GeminiInsightPayload;
    if (!obj.summary || !Array.isArray(obj.findings) || !obj.topPriority) return null;
    return obj;
  } catch {
    return null;
  }
}

export async function generateInsightJson(input: {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
}): Promise<{ payload: GeminiInsightPayload; raw: string; model: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not set");
  }
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
    },
    systemInstruction: SYSTEM,
  });

  const user = [
    `プロジェクト: ${input.projectName} (${input.domain})`,
    `期間: ${input.periodLabel}`,
    "",
    "=== メトリクス（現在） ===",
    JSON.stringify(input.current, null, 2),
    "",
    "=== メトリクス（前期） ===",
    JSON.stringify(input.previous, null, 2),
    "",
    "=== 変化率（% または pt） ===",
    JSON.stringify(input.change, null, 2),
    "",
    "=== ルールベース検知 ===",
    input.alerts.map((a) => `- [${a.severity}] ${a.code}: ${a.message}`).join("\n") || "(なし)",
    "",
    input.clarityNote ? `=== Clarity メモ ===\n${input.clarityNote}` : "",
  ].join("\n");

  const result = await model.generateContent(user);
  const raw = result.response.text();
  let payload = safeParse(raw);
  if (!payload) {
    // 1 retry with stricter instruction
    const retry = await model.generateContent(`${user}\n\nJSONのみを返してください。`);
    const raw2 = retry.response.text();
    payload = safeParse(raw2);
    if (!payload) throw new Error("Failed to parse Gemini JSON");
    return { payload, raw: raw2, model: modelName };
  }
  return { payload, raw, model: modelName };
}
