import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RuleAlert } from "@/lib/insights/rules";
import type {
  InsightActionItem,
  InsightFact,
  InsightHypothesisItem,
  InsightIssue,
  InsightPipeline,
} from "@/types/nis";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

const STAGE1_SYSTEM = `あなたはWebマーケティングのデータ記録者です。
【重要】①現状整理（Fact）のみを出力します。課題・原因・仮説・打ち手・推奨アクションは一切書かないでください。数値・トレンド・ルール検知の事実だけを列挙してください。
次の JSON のみを返答（前後に説明禁止）:
{
  "facts": [
    {
      "id": "f1",
      "statement": "1文で観測事実のみ",
      "metricRef": "任意。指標名やキー",
      "valueText": "任意。具体値や変化の短文",
      "source": "gsc|ga4|clarity|rule"
    }
  ]
}`;

const STAGE2_SYSTEM = `あなたはWebマーケティングのアナリストです。
入力の Stage1「facts」のみを根拠に②課題（Issue）を整理してください。新しい数値の捏造は禁止。facts にない内容は推測で補わず、関連 fact の id を relatedFactIds に列挙。
次の JSON のみ:
{
  "issues": [
    {
      "id": "i1",
      "severity": "high|medium|low",
      "title": "課題の短い見出し",
      "description": "何が問題か（根拠は facts 由来であること）",
      "relatedFactIds": ["f1"],
      "category": "seo|traffic|ux|conversion"
    }
  ]
}`;

const STAGE3_SYSTEM = `あなたはWebマーケティングのリサーチャーです。
入力の facts と issues に基づき③示唆・仮説を出してください。dataSupport には「データが示すこと」と「解釈・仮説」の区別を書いてください。
次の JSON のみ:
{
  "hypotheses": [
    {
      "id": "h1",
      "issueId": "i1",
      "statement": "仮説・示唆（1〜2文）",
      "dataSupport": "事実と解釈の区別",
      "confidence": "high|medium|low"
    }
  ]
}`;

const STAGE4_SYSTEM = `あなたはWeb施策のプランナーです。
入力の issues と hypotheses のみを踏まえ④具体打ち手を提案してください。各打ち手は優先度・工数見積り・期待効果・実行ステップを含める（新しい課題を増やさないこと）。
次の JSON のみ:
{
  "summary": "全体要約（クライアント向け、平易な日本語）",
  "actions": [
    {
      "id": "a1",
      "hypothesisId": "h1",
      "issueId": "i1",
      "title": "打ち手の見出し",
      "priority": "high|medium|low",
      "effort": "工数・難易の目安（例: 小/中/大、または人日感）",
      "expectedImpact": "期待効果",
      "steps": ["具体的なステップ1", "…"]
    }
  ],
  "topPriority": { "action": "string", "reason": "string" }
}`;

function cleanJsonText(json: string): string {
  return json.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
}

function tokenSum(usage: { totalTokenCount?: number } | undefined): number | undefined {
  if (!usage?.totalTokenCount) return undefined;
  return usage.totalTokenCount;
}

export type GeminiPipelineResult = {
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  raws: { stage: number; text: string }[];
  rawJoined: string;
  model: string;
  tokenUsage?: number;
};

type Stage1Payload = { facts: InsightFact[] };
type Stage2Payload = { issues: InsightIssue[] };
type Stage3Payload = { hypotheses: InsightHypothesisItem[] };
type Stage4Payload = {
  summary: string;
  actions: InsightActionItem[];
  topPriority: { action: string; reason: string };
};

function isStage1(o: unknown): o is Stage1Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage1Payload;
  return Array.isArray(x.facts);
}

function isStage2(o: unknown): o is Stage2Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage2Payload;
  return Array.isArray(x.issues);
}

function isStage3(o: unknown): o is Stage3Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage3Payload;
  return Array.isArray(x.hypotheses);
}

function isStage4(o: unknown): o is Stage4Payload {
  if (!o || typeof o !== "object") return false;
  const x = o as Stage4Payload;
  return (
    typeof x.summary === "string" &&
    Array.isArray(x.actions) &&
    x.topPriority != null &&
    typeof (x.topPriority as { action?: string }).action === "string"
  );
}

async function generateStageJson<T>(
  model: ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  userContent: string,
  isT: (o: unknown) => o is T,
): Promise<{ data: T; raw: string; tokens?: number }> {
  const result = await model.generateContent(userContent);
  let raw = result.response.text();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleanJsonText(raw));
  } catch {
    parsed = null;
  }
  if (!isT(parsed)) {
    const retry = await model.generateContent(
      `${userContent}\n\n※ 有効な JSON オブジェクトのみを出力し、前後に説明文を付けないでください。`,
    );
    raw = retry.response.text();
    try {
      parsed = JSON.parse(cleanJsonText(raw));
    } catch {
      throw new Error("Failed to parse Gemini JSON after retry");
    }
    if (!isT(parsed)) throw new Error("Gemini JSON schema mismatch after retry");
    return {
      data: parsed,
      raw,
      tokens: tokenSum(retry.response.usageMetadata),
    };
  }
  return { data: parsed, raw, tokens: tokenSum(result.response.usageMetadata) };
}

function buildMetricsBlock(input: {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
}): string {
  return [
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
}

export async function generateInsightPipeline(input: {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
}): Promise<GeminiPipelineResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  const genAI = new GoogleGenerativeAI(key);

  const baseModel = (systemInstruction: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction,
    });

  const metricsBlock = buildMetricsBlock(input);

  const stage1Model = baseModel(STAGE1_SYSTEM);
  const s1 = await generateStageJson(stage1Model, metricsBlock, isStage1);

  const stage2Model = baseModel(STAGE2_SYSTEM);
  const user2 = [
    "=== Stage1 出力（facts） ===",
    JSON.stringify({ facts: s1.data.facts }, null, 2),
    "",
    "=== 参考（メトリクス要約） ===",
    `期間: ${input.periodLabel}。変化率キー例: ${Object.keys(input.change).slice(0, 12).join(", ")}`,
  ].join("\n");
  const s2 = await generateStageJson(stage2Model, user2, isStage2);

  const stage3Model = baseModel(STAGE3_SYSTEM);
  const user3 = [
    "=== Stage1 facts ===",
    JSON.stringify({ facts: s1.data.facts }, null, 2),
    "",
    "=== Stage2 issues ===",
    JSON.stringify({ issues: s2.data.issues }, null, 2),
  ].join("\n");
  const s3 = await generateStageJson(stage3Model, user3, isStage3);

  const stage4Model = baseModel(STAGE4_SYSTEM);
  const user4 = [
    "=== Stage2 issues ===",
    JSON.stringify({ issues: s2.data.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses: s3.data.hypotheses }, null, 2),
  ].join("\n");
  const s4 = await generateStageJson(stage4Model, user4, isStage4);

  const tokens = [s1.tokens, s2.tokens, s3.tokens, s4.tokens].filter(
    (t): t is number => typeof t === "number",
  );
  const tokenUsage = tokens.length > 0 ? tokens.reduce((a, b) => a + b, 0) : undefined;

  const raws = [
    { stage: 1, text: s1.raw },
    { stage: 2, text: s2.raw },
    { stage: 3, text: s3.raw },
    { stage: 4, text: s4.raw },
  ];

  const rawJoined = raws.map((r) => `--- stage ${r.stage} ---\n${r.text}`).join("\n\n");

  return {
    pipeline: {
      facts: s1.data.facts,
      issues: s2.data.issues,
      hypotheses: s3.data.hypotheses,
      actions: s4.data.actions,
    },
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    raws,
    rawJoined,
    model: modelName,
    tokenUsage,
  };
}
