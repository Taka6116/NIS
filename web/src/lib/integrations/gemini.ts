import { GoogleGenerativeAI } from "@google/generative-ai";
import type { RuleAlert } from "@/lib/insights/rules";
import {
  cleanJsonText,
  isStage1,
  isStage2,
  isStage3,
  isStage4,
  normalizeAction,
  normalizeHypothesis,
} from "@/lib/insights/pipeline-stage-guards";
import {
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  STAGE4_SYSTEM,
  buildMetricsBlock,
} from "@/lib/insights/stage-prompts";
import type {
  InsightActionItem,
  InsightFact,
  InsightHypothesisItem,
  InsightIssue,
  InsightPipeline,
} from "@/types/nis";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";

function tokenSum(usage: { totalTokenCount?: number } | undefined): number | undefined {
  if (!usage?.totalTokenCount) return undefined;
  return usage.totalTokenCount;
}

export type GeminiInput = {
  projectName: string;
  domain: string;
  periodLabel: string;
  current: KpiSnapshot;
  previous: KpiSnapshot;
  change: Record<string, number>;
  alerts: RuleAlert[];
  clarityNote?: string;
  currentStart?: string;
  currentEnd?: string;
  previousStart?: string;
  previousEnd?: string;
  comparison?: "previous" | "yoy";
};

export type GeminiPipelineResult = {
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  raws: { stage: number; text: string }[];
  rawJoined: string;
  model: string;
  tokenUsage?: number;
};

export type GeminiStage12Result = {
  facts: InsightFact[];
  issues: InsightIssue[];
  rawJoined: string;
  model: string;
  tokenUsage?: number;
};

export type GeminiStage34Input = GeminiInput & {
  facts: InsightFact[];
  issues: InsightIssue[];
};

export type GeminiStage34Result = {
  hypotheses: InsightHypothesisItem[];
  actions: InsightActionItem[];
  summary: string;
  topPriority: { action: string; reason: string };
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
    return { data: parsed, raw, tokens: tokenSum(retry.response.usageMetadata) };
  }
  return { data: parsed, raw, tokens: tokenSum(result.response.usageMetadata) };
}

function resolveGenAI(): { genAI: GoogleGenerativeAI; modelName: string } {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  const modelName = process.env.GEMINI_MODEL ?? "gemini-2.0-flash";
  return { genAI: new GoogleGenerativeAI(key), modelName };
}

function sumTokens(...arr: Array<number | undefined>): number | undefined {
  const defined = arr.filter((t): t is number => typeof t === "number");
  return defined.length ? defined.reduce((a, b) => a + b, 0) : undefined;
}

/** Stage 1 + 2 のみ実行（Draft 用） */
export async function generateStage12(input: GeminiInput): Promise<GeminiStage12Result> {
  const { genAI, modelName } = resolveGenAI();
  const baseModel = (systemInstruction: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction,
    });

  const metricsBlock = buildMetricsBlock(input);
  const s1 = await generateStageJson(baseModel(STAGE1_SYSTEM), metricsBlock, isStage1);

  const user2 = [
    "=== Stage1 出力（facts） ===",
    JSON.stringify({ facts: s1.data.facts }, null, 2),
    "",
    "=== 参考（メトリクス要約） ===",
    `期間: ${input.periodLabel}。変化率キー例: ${Object.keys(input.change).slice(0, 12).join(", ")}`,
  ].join("\n");
  const s2 = await generateStageJson(baseModel(STAGE2_SYSTEM), user2, isStage2);

  const rawJoined = [
    { stage: 1, text: s1.raw },
    { stage: 2, text: s2.raw },
  ]
    .map((r) => `--- stage ${r.stage} ---\n${r.text}`)
    .join("\n\n");

  return {
    facts: s1.data.facts,
    issues: s2.data.issues,
    rawJoined,
    model: modelName,
    tokenUsage: sumTokens(s1.tokens, s2.tokens),
  };
}

/** Stage 3 + 4 のみ実行 */
export async function generateStage34(input: GeminiStage34Input): Promise<GeminiStage34Result> {
  const { genAI, modelName } = resolveGenAI();
  const baseModel = (systemInstruction: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction,
    });

  const user3 = [
    "=== Stage1 facts ===",
    JSON.stringify({ facts: input.facts }, null, 2),
    "",
    "=== Stage2 issues（ユーザー編集済み） ===",
    JSON.stringify({ issues: input.issues }, null, 2),
    "",
    "=== 期間情報 ===",
    input.currentStart && input.currentEnd ? `今期: ${input.currentStart}〜${input.currentEnd}` : "",
    input.previousStart && input.previousEnd
      ? `比較（${input.comparison === "yoy" ? "前年同期" : "直前期間"}）: ${input.previousStart}〜${input.previousEnd}`
      : "",
  ]
    .filter(Boolean)
    .join("\n");
  const s3 = await generateStageJson(baseModel(STAGE3_SYSTEM), user3, isStage3);

  const user4 = [
    "=== Stage2 issues（ユーザー編集済み） ===",
    JSON.stringify({ issues: input.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses: s3.data.hypotheses }, null, 2),
  ].join("\n");
  const s4 = await generateStageJson(baseModel(STAGE4_SYSTEM), user4, isStage4);

  const rawJoined = [
    { stage: 3, text: s3.raw },
    { stage: 4, text: s4.raw },
  ]
    .map((r) => `--- stage ${r.stage} ---\n${r.text}`)
    .join("\n\n");

  return {
    hypotheses: s3.data.hypotheses.map(normalizeHypothesis),
    actions: s4.data.actions.map(normalizeAction),
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    rawJoined,
    model: modelName,
    tokenUsage: sumTokens(s3.tokens, s4.tokens),
  };
}

export async function generateInsightPipeline(input: GeminiInput): Promise<GeminiPipelineResult> {
  const s12 = await generateStage12(input);
  const s34 = await generateStage34({ ...input, facts: s12.facts, issues: s12.issues });

  return {
    pipeline: {
      facts: s12.facts,
      issues: s12.issues,
      hypotheses: s34.hypotheses,
      actions: s34.actions,
    },
    summary: s34.summary,
    topPriority: s34.topPriority,
    raws: [
      { stage: 1, text: s12.rawJoined },
      { stage: 3, text: s34.rawJoined },
    ],
    rawJoined: `${s12.rawJoined}\n\n${s34.rawJoined}`,
    model: s34.model,
    tokenUsage: sumTokens(s12.tokenUsage, s34.tokenUsage),
  };
}
