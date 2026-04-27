import { BedrockRuntimeClient, InvokeModelCommand } from "@aws-sdk/client-bedrock-runtime";
import type { RuleAlert } from "@/lib/insights/rules";
import {
  applyStage45,
  cleanJsonText,
  isStage1,
  isStage2,
  isStage3,
  isStage4,
  isStage45,
  normalizeAction,
  normalizeDoNotDo,
  normalizeFact,
  normalizeHypothesis,
  normalizeTalkingPoints,
  type Stage3Payload,
  type Stage45Payload,
} from "@/lib/insights/pipeline-stage-guards";
import {
  STAGE1_SYSTEM,
  STAGE2_SYSTEM,
  STAGE3_SYSTEM,
  STAGE3_MERGER_SYSTEM,
  STAGE4_SYSTEM,
  STAGE4_5_SYSTEM,
  buildKwBlock,
  buildMetricsBlock,
  buildStage3SystemForPersona,
  buildStage3UserContent,
} from "@/lib/insights/stage-prompts";
import type { KpiSnapshot } from "@/lib/metrics/aggregate";
import type {
  InsightActionItem,
  InsightDoNotDo,
  InsightFact,
  InsightHypothesisItem,
  InsightIssue,
  InsightPipeline,
  InsightRecord,
  InsightSegment,
  InsightTalkingPoints,
  KwSummary,
} from "@/types/nis";

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
  segment?: InsightSegment;
  historicalInsights?: InsightRecord[];
  /** A2: Multi-persona を有効化するか（デフォルト true） */
  multiPersona?: boolean;
  /** A3: Self-critique Stage4.5 を有効化するか（デフォルト true） */
  selfCritique?: boolean;
  /** KW 連携: Ahrefs CSV から集約した KW サマリ。存在する場合は Stage1〜4 のプロンプトに注入される。 */
  kwSummary?: KwSummary;
};

export type ClaudeBedrockResult = {
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
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
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
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
  opts?: { maxTokens?: number; temperature?: number },
): Promise<{ data: T; raw: string; tokens?: number }> {
  const run = async (content: string) => {
    const body = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: opts?.maxTokens ?? 8192,
      temperature: opts?.temperature ?? 0.2,
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

function joinRaws(raws: Array<{ stage: string; raw: string }>): string {
  return raws.map((r) => `--- ${r.stage} ---\n${r.raw}`).join("\n\n");
}

export async function invokeInsightClaudeStage12(input: ClaudeBedrockInput): Promise<ClaudeStage12Result> {
  const { client, modelId } = resolveClient();
  const metricsBlock = buildMetricsBlock(input);
  const s1 = await invokeStage(client, modelId, STAGE1_SYSTEM, metricsBlock, isStage1, "stage1");

  const normalizedFacts = s1.data.facts.map(normalizeFact);

  const user2 = [
    "=== Stage1 出力（facts） ===",
    JSON.stringify({ facts: normalizedFacts }, null, 2),
    "",
    "=== 参考（メトリクス要約） ===",
    `期間: ${input.periodLabel}。変化率キー例: ${Object.keys(input.change || {}).slice(0, 12).join(", ")}`,
  ].join("\n");
  const s2 = await invokeStage(client, modelId, STAGE2_SYSTEM, user2, isStage2, "stage2");

  return {
    facts: normalizedFacts,
    issues: s2.data.issues,
    rawJoined: joinRaws([
      { stage: "stage 1", raw: s1.raw },
      { stage: "stage 2", raw: s2.raw },
    ]),
    modelId,
    tokenUsage: sumTokens(s1.tokens, s2.tokens),
  };
}

async function runStage3MultiPersona(
  client: BedrockRuntimeClient,
  modelId: string,
  userContent: string,
  knownFactIds: Set<string>,
): Promise<{ hypotheses: InsightHypothesisItem[]; raws: Array<{ stage: string; raw: string }>; tokens?: number }> {
  const personas: Array<"seo-lead" | "ux-researcher" | "cro-specialist"> = [
    "seo-lead",
    "ux-researcher",
    "cro-specialist",
  ];

  const personaResults = await Promise.all(
    personas.map((p) =>
      invokeStage(client, modelId, buildStage3SystemForPersona(p), userContent, isStage3, `stage3:${p}`).then(
        (r) => ({ p, r }),
      ),
    ),
  );

  const raws: Array<{ stage: string; raw: string }> = [];
  const tokensAll: Array<number | undefined> = [];
  const perPersona: Stage3Payload[] = [];
  for (const { p, r } of personaResults) {
    raws.push({ stage: `stage 3 ${p}`, raw: r.raw });
    tokensAll.push(r.tokens);
    perPersona.push({
      hypotheses: r.data.hypotheses.map((h) => ({ ...h, persona: p })),
    });
  }

  // Merger
  const merged = await invokeStage(
    client,
    modelId,
    STAGE3_MERGER_SYSTEM,
    [
      "=== 各ペルソナの仮説 ===",
      JSON.stringify(
        {
          perPersona: perPersona.map((p, i) => ({ persona: personas[i], ...p })),
        },
        null,
        2,
      ),
    ].join("\n"),
    isStage3,
    "stage3:merger",
  );
  raws.push({ stage: "stage 3 merger", raw: merged.raw });
  tokensAll.push(merged.tokens);

  const hypotheses = merged.data.hypotheses.map((h) =>
    normalizeHypothesis({ ...h, persona: h.persona ?? "merged" }, knownFactIds),
  );
  return { hypotheses, raws, tokens: sumTokens(...tokensAll) };
}

export async function invokeInsightClaudeStage34(input: ClaudeStage34Input): Promise<ClaudeStage34Result> {
  const { client, modelId } = resolveClient();
  const knownFactIds = new Set(input.facts.map((f) => f.id));
  const user3 = buildStage3UserContent({
    facts: input.facts,
    issues: input.issues,
    currentStart: input.currentStart,
    currentEnd: input.currentEnd,
    previousStart: input.previousStart,
    previousEnd: input.previousEnd,
    comparison: input.comparison,
    historicalInsights: input.historicalInsights,
  });

  const raws: Array<{ stage: string; raw: string }> = [];
  const tokens: Array<number | undefined> = [];

  // multi-persona は処理時間が 90〜120 秒増えるため、Vercel 300s 制限内で収めるため
  // 常に 1 回（STAGE3_SYSTEM / merged）で実行する。
  const s3 = await invokeStage(client, modelId, STAGE3_SYSTEM, user3, isStage3, "stage3");
  raws.push({ stage: "stage 3", raw: s3.raw });
  tokens.push(s3.tokens);
  const hypotheses: InsightHypothesisItem[] = s3.data.hypotheses.map((h) =>
    normalizeHypothesis({ ...h, persona: h.persona ?? "merged" }, knownFactIds),
  );

  const kwBlock = input.kwSummary ? buildKwBlock(input.kwSummary) : "";
  const user4 = [
    "=== Stage1 facts ===",
    JSON.stringify({ facts: input.facts }, null, 2),
    "",
    "=== Stage2 issues（ユーザー編集済み） ===",
    JSON.stringify({ issues: input.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses }, null, 2),
    kwBlock ? `\n${kwBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const s4 = await invokeStage(client, modelId, STAGE4_SYSTEM, user4, isStage4, "stage4", {
    maxTokens: 8000,
  });
  raws.push({ stage: "stage 4", raw: s4.raw });
  tokens.push(s4.tokens);

  let actions = s4.data.actions.map((a) => normalizeAction(a, knownFactIds));
  let doNotDo = normalizeDoNotDo(s4.data.doNotDo);
  const talkingPoints = normalizeTalkingPoints(s4.data.talkingPoints);

  // Stage4.5 は Vercel 300s 制限内に収めるためデフォルト OFF。
  // 明示的に selfCritique: true を渡した場合のみ実行する。
  if (input.selfCritique === true) {
    try {
      const s45user = [
        "=== 現在の actions ===",
        JSON.stringify({ actions }, null, 2),
      ].join("\n");
      const s45 = await invokeStage<Stage45Payload>(
        client,
        modelId,
        STAGE4_5_SYSTEM,
        s45user,
        isStage45,
        "stage4.5",
      );
      raws.push({ stage: "stage 4.5", raw: s45.raw });
      tokens.push(s45.tokens);
      const merged = applyStage45(actions, s45.data);
      actions = merged.actions;
      if (merged.additionalDoNotDo && merged.additionalDoNotDo.length) {
        doNotDo = [...(doNotDo ?? []), ...merged.additionalDoNotDo];
      }
    } catch (e) {
      raws.push({ stage: "stage 4.5", raw: `error: ${e instanceof Error ? e.message : String(e)}` });
    }
  }

  return {
    hypotheses,
    actions,
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    doNotDo,
    talkingPoints,
    rawJoined: joinRaws(raws),
    modelId,
    tokenUsage: sumTokens(...tokens),
  };
}

export type ClaudeStage3OnlyInput = ClaudeStage34Input;

export type ClaudeStage3OnlyResult = {
  hypotheses: InsightHypothesisItem[];
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

/** Stage3 のみ実行（仮説生成）。finalize を 2 ステップに分割する際に使用。 */
export async function invokeInsightClaudeStage3Only(input: ClaudeStage3OnlyInput): Promise<ClaudeStage3OnlyResult> {
  const { client, modelId } = resolveClient();
  const knownFactIds = new Set(input.facts.map((f) => f.id));
  const user3 = buildStage3UserContent({
    facts: input.facts,
    issues: input.issues,
    currentStart: input.currentStart,
    currentEnd: input.currentEnd,
    previousStart: input.previousStart,
    previousEnd: input.previousEnd,
    comparison: input.comparison,
    historicalInsights: input.historicalInsights,
  });
  const s3 = await invokeStage(client, modelId, STAGE3_SYSTEM, user3, isStage3, "stage3");
  const hypotheses = s3.data.hypotheses.map((h) =>
    normalizeHypothesis({ ...h, persona: h.persona ?? "merged" }, knownFactIds),
  );
  return {
    hypotheses,
    rawJoined: s3.raw,
    modelId,
    tokenUsage: s3.tokens,
  };
}

export type ClaudeStage4OnlyInput = ClaudeStage34Input & {
  hypotheses: InsightHypothesisItem[];
};

export type ClaudeStage4OnlyResult = {
  actions: InsightActionItem[];
  summary: string;
  topPriority: { action: string; reason: string };
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
  rawJoined: string;
  modelId: string;
  tokenUsage?: number;
};

/** Stage4 のみ実行（打ち手生成）。finalize を 2 ステップに分割する際に使用。 */
export async function invokeInsightClaudeStage4Only(input: ClaudeStage4OnlyInput): Promise<ClaudeStage4OnlyResult> {
  const { client, modelId } = resolveClient();
  const knownFactIds = new Set(input.facts.map((f) => f.id));
  const kwBlock = input.kwSummary ? buildKwBlock(input.kwSummary) : "";
  const user4 = [
    "=== Stage1 facts ===",
    JSON.stringify({ facts: input.facts }, null, 2),
    "",
    "=== Stage2 issues（ユーザー編集済み） ===",
    JSON.stringify({ issues: input.issues }, null, 2),
    "",
    "=== Stage3 hypotheses ===",
    JSON.stringify({ hypotheses: input.hypotheses }, null, 2),
    kwBlock ? `\n${kwBlock}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const s4 = await invokeStage(client, modelId, STAGE4_SYSTEM, user4, isStage4, "stage4", { maxTokens: 8000 });
  const actions = s4.data.actions.map((a) => normalizeAction(a, knownFactIds));
  const doNotDo = normalizeDoNotDo(s4.data.doNotDo);
  const talkingPoints = normalizeTalkingPoints(s4.data.talkingPoints);
  return {
    actions,
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    doNotDo,
    talkingPoints,
    rawJoined: s4.raw,
    modelId,
    tokenUsage: s4.tokens,
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
    doNotDo: stage34.doNotDo,
    talkingPoints: stage34.talkingPoints,
    rawJoined: `${stage12.rawJoined}\n\n${stage34.rawJoined}`,
    modelId: stage34.modelId,
    tokenUsage: sumTokens(stage12.tokenUsage, stage34.tokenUsage),
  };
}
