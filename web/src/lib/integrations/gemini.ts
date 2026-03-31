import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RuleAlert } from "@/lib/insights/rules";
import {
  cleanJsonText,
  isStage1,
  isStage2,
  isStage3,
  isStage4,
} from "@/lib/insights/pipeline-stage-guards";
import { buildMetricsBlock, STAGE1_SYSTEM, STAGE2_SYSTEM, STAGE3_SYSTEM, STAGE4_SYSTEM } from "@/lib/insights/stage-prompts";
import type { InsightPipeline } from "@/types/nis";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

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
