import { GoogleGenerativeAI } from "@google/generative-ai";
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
  segment?: InsightSegment;
  historicalInsights?: InsightRecord[];
  multiPersona?: boolean;
  selfCritique?: boolean;
  kwSummary?: KwSummary;
};

export type GeminiPipelineResult = {
  pipeline: InsightPipeline;
  summary: string;
  topPriority: { action: string; reason: string };
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
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
  doNotDo?: InsightDoNotDo[];
  talkingPoints?: InsightTalkingPoints;
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
  const facts = s1.data.facts.map(normalizeFact);

  const user2 = [
    "=== Stage1 出力（facts） ===",
    JSON.stringify({ facts }, null, 2),
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
    facts,
    issues: s2.data.issues,
    rawJoined,
    model: modelName,
    tokenUsage: sumTokens(s1.tokens, s2.tokens),
  };
}

async function runGeminiStage3MultiPersona(
  getModel: (sys: string) => ReturnType<GoogleGenerativeAI["getGenerativeModel"]>,
  userContent: string,
  knownFactIds: Set<string>,
): Promise<{ hypotheses: InsightHypothesisItem[]; raws: string[]; tokens?: number }> {
  const personas: Array<"seo-lead" | "ux-researcher" | "cro-specialist"> = [
    "seo-lead",
    "ux-researcher",
    "cro-specialist",
  ];
  const raws: string[] = [];
  const tokens: Array<number | undefined> = [];
  const perPersona: Stage3Payload[] = [];
  for (const p of personas) {
    const r = await generateStageJson(getModel(buildStage3SystemForPersona(p)), userContent, isStage3);
    raws.push(`stage 3 ${p}: ${r.raw}`);
    tokens.push(r.tokens);
    perPersona.push({
      hypotheses: r.data.hypotheses.map((h) => ({ ...h, persona: p })),
    });
  }
  const merged = await generateStageJson(
    getModel(STAGE3_MERGER_SYSTEM),
    [
      "=== 各ペルソナの仮説 ===",
      JSON.stringify(
        { perPersona: perPersona.map((pp, i) => ({ persona: personas[i], ...pp })) },
        null,
        2,
      ),
    ].join("\n"),
    isStage3,
  );
  raws.push(`stage 3 merger: ${merged.raw}`);
  tokens.push(merged.tokens);
  return {
    hypotheses: merged.data.hypotheses.map((h) =>
      normalizeHypothesis({ ...h, persona: h.persona ?? "merged" }, knownFactIds),
    ),
    raws,
    tokens: sumTokens(...tokens),
  };
}

export async function generateStage34(input: GeminiStage34Input): Promise<GeminiStage34Result> {
  const { genAI, modelName } = resolveGenAI();
  const baseModel = (systemInstruction: string) =>
    genAI.getGenerativeModel({
      model: modelName,
      generationConfig: { responseMimeType: "application/json" },
      systemInstruction,
    });

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

  const raws: string[] = [];
  const tokens: Array<number | undefined> = [];

  let hypotheses: InsightHypothesisItem[];
  if (input.multiPersona !== false) {
    const mp = await runGeminiStage3MultiPersona(baseModel, user3, knownFactIds);
    hypotheses = mp.hypotheses;
    raws.push(...mp.raws);
    tokens.push(mp.tokens);
  } else {
    const s3 = await generateStageJson(baseModel(STAGE3_SYSTEM), user3, isStage3);
    raws.push(`stage 3: ${s3.raw}`);
    tokens.push(s3.tokens);
    hypotheses = s3.data.hypotheses.map((h) =>
      normalizeHypothesis({ ...h, persona: h.persona ?? "merged" }, knownFactIds),
    );
  }

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
  const s4 = await generateStageJson(baseModel(STAGE4_SYSTEM), user4, isStage4);
  raws.push(`stage 4: ${s4.raw}`);
  tokens.push(s4.tokens);

  let actions = s4.data.actions.map((a) => normalizeAction(a, knownFactIds));
  let doNotDo = normalizeDoNotDo(s4.data.doNotDo);
  const talkingPoints = normalizeTalkingPoints(s4.data.talkingPoints);

  if (input.selfCritique !== false) {
    try {
      const s45 = await generateStageJson<Stage45Payload>(
        baseModel(STAGE4_5_SYSTEM),
        ["=== 現在の actions ===", JSON.stringify({ actions }, null, 2)].join("\n"),
        isStage45,
      );
      raws.push(`stage 4.5: ${s45.raw}`);
      tokens.push(s45.tokens);
      const merged = applyStage45(actions, s45.data);
      actions = merged.actions;
      if (merged.additionalDoNotDo && merged.additionalDoNotDo.length) {
        doNotDo = [...(doNotDo ?? []), ...merged.additionalDoNotDo];
      }
    } catch (e) {
      raws.push(`stage 4.5 error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return {
    hypotheses,
    actions,
    summary: s4.data.summary,
    topPriority: s4.data.topPriority,
    doNotDo,
    talkingPoints,
    rawJoined: raws.map((r) => `--- ${r}`).join("\n\n"),
    model: modelName,
    tokenUsage: sumTokens(...tokens),
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
    doNotDo: s34.doNotDo,
    talkingPoints: s34.talkingPoints,
    raws: [
      { stage: 1, text: s12.rawJoined },
      { stage: 3, text: s34.rawJoined },
    ],
    rawJoined: `${s12.rawJoined}\n\n${s34.rawJoined}`,
    model: s34.model,
    tokenUsage: sumTokens(s12.tokenUsage, s34.tokenUsage),
  };
}
