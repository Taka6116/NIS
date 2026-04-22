import {
  invokeInsightClaudeBedrock,
  invokeInsightClaudeStage12,
  invokeInsightClaudeStage34,
} from "@/lib/integrations/claude-bedrock";
import { generateInsightPipeline, generateStage12, generateStage34 } from "@/lib/integrations/gemini";
import { putInsight, putInsightDraft, getInsightDraft, deleteInsightDraft, draftSkFromId } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { runRules } from "@/lib/insights/rules";
import { deriveFindingsFromPipeline } from "@/lib/insights/pipeline";
import { getMetricsBundleForWindow } from "@/lib/metrics/aggregate";
import {
  resolveMetricsWindow,
  formatWindowLabel,
  type ResolvedMetricsWindow,
} from "@/lib/metrics/date-range";
import type { InsightDraftRecord, InsightFact, InsightIssue, InsightRecord } from "@/types/nis";

export type InsightProvider = "gemini" | "claude";

export type InsightWindowInput = {
  from?: string;
  to?: string;
  range?: string;
  comparison?: "previous" | "yoy";
};

const DRAFT_TTL_SECONDS = 24 * 60 * 60;

function coerceWindow(input: InsightWindowInput | undefined): ResolvedMetricsWindow {
  const r = resolveMetricsWindow({
    from: input?.from,
    to: input?.to,
    range: input?.range ?? "28d",
    comparison: input?.comparison ?? "previous",
  });
  if (!r.ok) throw new Error(r.error);
  return r.window;
}

async function buildCommonInput(projectId: string, window: ResolvedMetricsWindow) {
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const bundle = await getMetricsBundleForWindow(projectId, {
    start: window.start,
    end: window.end,
    prevStart: window.prevStart,
    prevEnd: window.prevEnd,
  });

  const alerts = runRules({
    current: bundle.current,
    previous: bundle.previous,
    change: bundle.change,
  });

  const clarityNote = bundle.clarityUx
    ? `推定UXスコア ${bundle.clarityUx.score}。Dead click 率 ${(bundle.clarityUx.deadClickRate * 100).toFixed(2)}%、Rage ${(bundle.clarityUx.rageClickRate * 100).toFixed(2)}%、Scroll depth ${bundle.clarityUx.scrollDepth.toFixed(1)}、即戻り ${bundle.clarityUx.quickbackCount}、過剰スクロール ${bundle.clarityUx.excessiveScrollCount}、ボット率 ${(bundle.clarityUx.botTrafficRate * 100).toFixed(1)}%。`
    : undefined;

  const periodLabel = formatWindowLabel(window);

  const commonInput = {
    projectName: project.projectName,
    domain: project.domain,
    periodLabel,
    current: bundle.current,
    previous: bundle.previous,
    change: bundle.change as unknown as Record<string, number>,
    alerts,
    clarityNote,
    currentStart: window.start,
    currentEnd: window.end,
    previousStart: window.prevStart,
    previousEnd: window.prevEnd,
    comparison: window.comparison,
  };

  return { project, bundle, alerts, clarityNote, periodLabel, commonInput };
}

/**
 * 1 ショット互換モード。cron や外部呼び出し後方互換。既定 28d・previous。
 */
export async function runInsightGeneration(
  projectId: string,
  options?: { provider?: InsightProvider; window?: InsightWindowInput },
): Promise<InsightRecord> {
  const provider: InsightProvider = options?.provider ?? "gemini";
  const window = coerceWindow(options?.window);
  const { commonInput, bundle } = await buildCommonInput(projectId, window);

  const generatedAtIso = new Date().toISOString();
  const sk = `${generatedAtIso}#weekly`;

  if (provider === "claude") {
    const out = await invokeInsightClaudeBedrock(commonInput);
    const findings = deriveFindingsFromPipeline(out.pipeline);
    const row: InsightRecord = {
      projectId,
      sk,
      type: "weekly",
      period: { start: bundle.range.start, end: bundle.range.end },
      summary: out.summary,
      findings,
      topPriority: out.topPriority,
      pipeline: out.pipeline,
      modelProvider: "claude",
      rawPrompt: out.rawJoined.slice(0, 12000),
      modelVersion: out.modelId,
      tokenUsage: out.tokenUsage,
      generatedAtIso,
    };
    await putInsight(row);
    return row;
  }

  const result = await generateInsightPipeline(commonInput);
  const findings = deriveFindingsFromPipeline(result.pipeline);
  const row: InsightRecord = {
    projectId,
    sk,
    type: "weekly",
    period: { start: bundle.range.start, end: bundle.range.end },
    summary: result.summary,
    findings,
    topPriority: result.topPriority,
    pipeline: result.pipeline,
    modelProvider: "gemini",
    rawPrompt: result.rawJoined.slice(0, 12000),
    modelVersion: result.model,
    tokenUsage: result.tokenUsage,
    generatedAtIso,
  };
  await putInsight(row);
  return row;
}

/**
 * Step 1: Facts + Issues だけを生成して Draft として永続化する。
 * 返り値の `draftId` を URL に含めて Draft レビュー画面に遷移する。
 */
export async function runInsightDraft(
  projectId: string,
  window: ResolvedMetricsWindow,
  provider: InsightProvider,
): Promise<InsightDraftRecord> {
  const { commonInput } = await buildCommonInput(projectId, window);

  let facts: InsightFact[];
  let issues: InsightIssue[];
  let rawJoined: string;
  let modelVersion: string;
  let tokenUsage: number | undefined;

  if (provider === "claude") {
    const r = await invokeInsightClaudeStage12(commonInput);
    facts = r.facts;
    issues = r.issues;
    rawJoined = r.rawJoined;
    modelVersion = r.modelId;
    tokenUsage = r.tokenUsage;
  } else {
    const r = await generateStage12(commonInput);
    facts = r.facts;
    issues = r.issues;
    rawJoined = r.rawJoined;
    modelVersion = r.model;
    tokenUsage = r.tokenUsage;
  }

  const generatedAtIso = new Date().toISOString();
  const draftId = generatedAtIso;
  const expiresAt = Math.floor(Date.now() / 1000) + DRAFT_TTL_SECONDS;

  const row: InsightDraftRecord = {
    projectId,
    sk: draftSkFromId(draftId),
    draftId,
    type: "draft",
    period: { start: window.start, end: window.end },
    comparison: window.comparison,
    previousPeriod: { start: window.prevStart, end: window.prevEnd },
    facts,
    issues,
    modelProvider: provider,
    modelVersion,
    rawPrompt: rawJoined.slice(0, 12000),
    tokenUsage,
    generatedAtIso,
    expiresAt,
  };
  await putInsightDraft(row);
  return row;
}

/**
 * Step 2: ユーザー編集済みの Issues を入力し、Hypotheses + Actions を生成して最終保存。
 */
export async function runInsightFinalize(
  projectId: string,
  draftId: string,
  provider: InsightProvider,
  overrides?: { editedIssues?: InsightIssue[] },
): Promise<InsightRecord> {
  const draft = await getInsightDraft(projectId, draftId);
  if (!draft) throw new Error("Draft not found or expired");

  const window: ResolvedMetricsWindow = {
    start: draft.period.start,
    end: draft.period.end,
    prevStart: draft.previousPeriod.start,
    prevEnd: draft.previousPeriod.end,
    comparison: draft.comparison,
    source: "custom",
  };

  const { commonInput, bundle } = await buildCommonInput(projectId, window);

  const issues = overrides?.editedIssues ?? draft.issues;
  const facts = draft.facts;

  const stage34Input = { ...commonInput, facts, issues };

  let pipeline: import("@/types/nis").InsightPipeline;
  let summary: string;
  let topPriority: { action: string; reason: string };
  let rawJoined: string;
  let modelVersion: string;
  let tokenUsage: number | undefined;

  if (provider === "claude") {
    const r = await invokeInsightClaudeStage34(stage34Input);
    pipeline = { facts, issues, hypotheses: r.hypotheses, actions: r.actions };
    summary = r.summary;
    topPriority = r.topPriority;
    rawJoined = r.rawJoined;
    modelVersion = r.modelId;
    tokenUsage = r.tokenUsage;
  } else {
    const r = await generateStage34(stage34Input);
    pipeline = { facts, issues, hypotheses: r.hypotheses, actions: r.actions };
    summary = r.summary;
    topPriority = r.topPriority;
    rawJoined = r.rawJoined;
    modelVersion = r.model;
    tokenUsage = r.tokenUsage;
  }

  const findings = deriveFindingsFromPipeline(pipeline);
  const generatedAtIso = new Date().toISOString();
  const sk = `${generatedAtIso}#weekly`;

  const row: InsightRecord = {
    projectId,
    sk,
    type: "weekly",
    period: { start: bundle.range.start, end: bundle.range.end },
    summary,
    findings,
    topPriority,
    pipeline,
    modelProvider: provider,
    rawPrompt: rawJoined.slice(0, 12000),
    modelVersion,
    tokenUsage,
    generatedAtIso,
  };
  await putInsight(row);
  await deleteInsightDraft(projectId, draftId).catch(() => {});
  return row;
}
