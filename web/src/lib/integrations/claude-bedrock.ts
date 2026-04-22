import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { RuleAlert } from "@/lib/insights/rules";
import {
  cleanJsonText,
  isStage1,
  isStage2,
  isStage3,
  isStage4,
} from "@/lib/insights/pipeline-stage-guards";
import {
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  STAGE4_SYSTEM,
  buildMetricsBlock,
} from "@/lib/insights/stage-prompts";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";
import type { InsightPipeline } from "@/types/nis";

/**
 * Bedrock 経由で Claude を直接呼ぶ。Next.js サーバランタイム（Vercel）から実行する想定。
 * 旧 lambda/insight-claude/index.mjs と同じ 4 段パイプラインを実行する。
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
};

export type ClaudeBedrockResult = {
  pipeline: InsightPipeline;
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

export async function invokeInsightClaudeBedrock(
  input: ClaudeBedrockInput,
): Promise<ClaudeBedrockResult> {
  const modelId = process.env.BEDROCK_MODEL_ID;
  if (!modelId?.trim()) {
    throw new Error(
      "BEDROCK_MODEL_ID is not set. Set it to an active Claude model or inference profile ID " +
        "(e.g. jp.anthropic.claude-sonnet-4-5-20250929-v1:0 for Tokyo, or global.anthropic.claude-sonnet-4-5-20250929-v1:0).",
    );
  }
  const region = process.env.AWS_REGION ?? process.env.AWS_DEFAULT_REGION ?? "ap-northeast-1";
  const client = new BedrockRuntimeClient({ region });

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

  const user3 = [
    "=== Stage1 facts ===",
    JSON.stringify({ facts: s1.data.facts }, null, 2),
    "",
    "=== Stage2 issues ===",
    JSON.stringify({ issues: s2.data.issues }, null, 2),
  ].join("\n");
  const s3 = await invokeStage(client, modelId, STAGE3_SYSTEM, user3, isStage3, "stage3");

  const user4 = [
    "=== Stage2 issues ===",
    JSON.stringify({ issues: s2.data.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses: s3.data.hypotheses }, null, 2),
  ].join("\n");
  const s4 = await invokeStage(client, modelId, STAGE4_SYSTEM, user4, isStage4, "stage4");

  const tokenParts = [s1.tokens, s2.tokens, s3.tokens, s4.tokens].filter(
    (t): t is number => typeof t === "number",
  );
  const tokenUsage = tokenParts.length ? tokenParts.reduce((a, b) => a + b, 0) : undefined;

  const rawJoined = [
    `--- stage 1 ---\n${s1.raw}`,
    `--- stage 2 ---\n${s2.raw}`,
    `--- stage 3 ---\n${s3.raw}`,
    `--- stage 4 ---\n${s4.raw}`,
  ].join("\n\n");

  return {
    pipeline: {
      facts: s1.data.facts,
      issues: s2.data.issues,
      hypotheses: s3.data.hypotheses,
      actions: s4.data.actions,
    },
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    rawJoined,
    modelId,
    tokenUsage,
  };
}
