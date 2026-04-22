import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
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
import type { KpiSnapshot } from "@/lib/metrics/aggregate";
import type {
  InsightActionItem,
  InsightFact,
  InsightHypothesisItem,
  InsightIssue,
  InsightPipeline,
} from "@/types/nis";

/**
 * Bedrock 経由で Claude を直接呼ぶ。Next.js サーバランタイム（Vercel）から実行する想定。
 * 4 段階パイプラインを 1 ショット（全段）/ Stage1-2 / Stage3-4 で呼び出せるよう関数を分割。
 */

export type ClaudeBedrockInput = {
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

export type ClaudeBedrockResult = {
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

export type ClaudeStage12Result = {
  facts: InsightFact[];
  issues: InsightIssue[];
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

export type ClaudeStage34Input = ClaudeBedrockInput & {
  facts: InsightFact[];
  issues: InsightIssue[];
};

export type ClaudeStage34Result = {
  hypotheses: InsightHypothesisItem[];
  actions: InsightActionItem[];
  summary: string;
  topPriority: { action: string; reason: string };
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

type BedrockClaudeResponse = {
  content?: Array<{ text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function resolveClient(): { client: BedrockRuntimeClient; modelId: string } {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId?.trim()) {
    throw new Error(
      "BEDROCK_MODEL_ID is not set. Set it to an active Claude model or inference profile ID " +
        "(e.g. jp.anthropic.claude-sonnet-4-5-20250929-v1:0 for Tokyo, or global.anthropic.claude-sonnet-4-5-20250929-v1:0).",
    );
  }
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
  const client = new BedrockRuntimeClient({ region });
  return { client, modelId };
}

async function invokeStage<T>(
  client: BedrockRuntimeClient,
  modelId: string,
  system: string,
  userContent: string,
  guard: (o: unknown) => o is T,
  stageLabel: string,
): Promise<{ data: T; raw: string; tokens?: number }> {
  const run = async (content: string) => {
    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 8192,
      temperature: 0.2,
      system,
      messages: [{ role: "user", content }],
    };
    const cmd = new InvokeModelCommand({
      modelId,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(body),
    });
    const res = await client.send(cmd);
    const decoded = JSON.parse(new TextDecoder().decode(res.body)) as BedrockClaudeResponse;
    const text = decoded.content?.[0]?.text ?? "";
    const usage = decoded.usage;
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleanJsonText(text));
    } catch {
      parsed = null;
    }
    return { parsed, raw: text, usage };
  };

  let { parsed, raw, usage } = await run(userContent);
  if (!guard(parsed)) {
    const retry = await run(
      `${userContent}\n\n※ 有効な JSON オブジェクトのみを出力し、前後に説明文を付けないでください。`,
    );
    parsed = retry.parsed;
    raw = retry.raw;
    usage = retry.usage;
  }
  if (!guard(parsed)) {
    throw new Error(`${stageLabel}: Claude(Bedrock) JSON schema mismatch`);
  }

  let tokens: number | undefined;
  if (typeof usage?.input_tokens === "number" && typeof usage?.output_tokens === "number") {
    tokens = usage.input_tokens + usage.output_tokens;
  }
  return { data: parsed, raw, tokens };
}

function sumTokens(...arr: Array<number | undefined>): number | undefined {
  const defined = arr.filter((t): t is number => typeof t === "number");
  return defined.length ? defined.reduce((a, b) => a + b, 0) : undefined;
}

function joinRaws(raws: Array<{ stage: number; raw: string }>): string {
  return raws.map((r) => `--- stage ${r.stage} ---\n${r.raw}`).join("\n\n");
}

/** Stage 1 + 2 のみ実行（Draft 用） */
export async function invokeInsightClaudeStage12(input: ClaudeBedrockInput): Promise<ClaudeStage12Result> {
  const { client, modelId } = resolveClient();
  const metricsBlock = buildMetricsBlock(input);
  const s1 = await invokeStage(client, modelId, STAGE1_SYSTEM, metricsBlock, isStage1, "stage1");

  const user2 = [
    "=== Stage1 出力（facts） ===",
    JSON.stringify({ facts: s1.data.facts }, null, 2),
    "",
    "=== 参考（メトリクス要約） ===",
    `期間: ${input.periodLabel}。変化率キー例: ${Object.keys(input.change || {}).slice(0, 12).join(", ")}`,
  ].join("\n");
  const s2 = await invokeStage(client, modelId, STAGE2_SYSTEM, user2, isStage2, "stage2");

  return {
    facts: s1.data.facts,
    issues: s2.data.issues,
    rawJoined: joinRaws([
      { stage: 1, raw: s1.raw },
      { stage: 2, raw: s2.raw },
    ]),
    modelId,
    tokenUsage: sumTokens(s1.tokens, s2.tokens),
  };
}

/** Stage 3 + 4 のみ実行（Draft レビュー後の最終化用） */
export async function invokeInsightClaudeStage34(input: ClaudeStage34Input): Promise<ClaudeStage34Result> {
  const { client, modelId } = resolveClient();

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
  const s3 = await invokeStage(client, modelId, STAGE3_SYSTEM, user3, isStage3, "stage3");

  const user4 = [
    "=== Stage2 issues（ユーザー編集済み） ===",
    JSON.stringify({ issues: input.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses: s3.data.hypotheses }, null, 2),
  ].join("\n");
  const s4 = await invokeStage(client, modelId, STAGE4_SYSTEM, user4, isStage4, "stage4");

  return {
    hypotheses: s3.data.hypotheses.map(normalizeHypothesis),
    actions: s4.data.actions.map(normalizeAction),
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    rawJoined: joinRaws([
      { stage: 3, raw: s3.raw },
      { stage: 4, raw: s4.raw },
    ]),
    modelId,
    tokenUsage: sumTokens(s3.tokens, s4.tokens),
  };
}

export async function invokeInsightClaudeBedrock(input: ClaudeBedrockInput): Promise<ClaudeBedrockResult> {
  const stage12 = await invokeInsightClaudeStage12(input);
  const stage34 = await invokeInsightClaudeStage34({
    ...input,
    facts: stage12.facts,
    issues: stage12.issues,
  });

  return {
    pipeline: {
      facts: stage12.facts,
      issues: stage12.issues,
      hypotheses: stage34.hypotheses,
      actions: stage34.actions,
    },
    summary: stage34.summary,
    topPriority: stage34.topPriority,
    rawJoined: `${stage12.rawJoined}\n\n${stage34.rawJoined}`,
    modelId: stage34.modelId,
    tokenUsage: sumTokens(stage12.tokenUsage, stage34.tokenUsage),
  };
}
