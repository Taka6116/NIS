import {
  invokeInsightClaudeBedrock,
  invokeInsightClaudeStage12,
  invokeInsightClaudeStage34,
} from "@/lib/integrations/claude-bedrock";
import { generateInsightPipeline, generateStage12, generateStage34 } from "@/lib/integrations/gemini";
import {
  putInsight,
  putInsightDraft,
  getInsight,
  getInsightDraft,
  deleteInsightDraft,
  draftSkFromId,
  listInsights,
} from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { listKwDatasets } from "@/lib/dynamodb/repositories/kw-datasets";
import { buildKwSummary } from "@/lib/ahrefs/analyzer";
import { runRules } from "@/lib/insights/rules";
import { deriveFindingsFromPipeline } from "@/lib/insights/pipeline";
import { getMetricsBundleForWindow } from "@/lib/metrics/aggregate";
import {
  resolveMetricsWindow,
  formatWindowLabel,
  type ResolvedMetricsWindow,
} from "@/lib/metrics/date-range";
import {
  buildDraftReadyMessage,
  buildFinalizeReadyMessage,
  postToSlack,
  resolveSlackWebhook,
} from "@/lib/integrations/slack";
import { computeIssueDiff, pickPreviousInsight, upgradeSeverityForRepeated } from "@/lib/insights/diff";
import type {
  InsightDraftRecord,
  InsightFact,
  InsightIssue,
  InsightRecord,
  InsightSegment,
  KwSummary,
} from "@/types/nis";

export type InsightProvider = "gemini" | "claude";

export type InsightWindowInput = {
  from?: string;
  to?: string;
  range?: string;
  comparison?: "previous" | "yoy";
};

export type InsightSegmentInput = InsightSegment;

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

function sanitizeSegment(seg?: InsightSegmentInput): InsightSegment | undefined {
  if (!seg) return undefined;
  const out: InsightSegment = {};
  if (seg.urlPrefix?.trim()) out.urlPrefix = seg.urlPrefix.trim();
  if (seg.channel?.trim()) out.channel = seg.channel.trim();
  if (seg.country?.trim()) out.country = seg.country.trim();
  if (seg.deviceCategory?.trim()) out.deviceCategory = seg.deviceCategory.trim();
  return Object.keys(out).length ? out : undefined;
}

async function buildCommonInput(
  projectId: string,
  window: ResolvedMetricsWindow,
  opts?: { segment?: InsightSegment; loadHistory?: boolean; historyLimit?: number },
) {
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

  let historicalInsights: InsightRecord[] | undefined;
  if (opts?.loadHistory) {
    const limit = opts.historyLimit ?? 3;
    try {
      const past = await listInsights(projectId, limit + 3);
      historicalInsights = past.filter((p) => p.pipeline).slice(0, limit);
    } catch {
      historicalInsights = undefined;
    }
  }

  // KW データを S3 からロードしてサマリを生成（失敗時は undefined でフォールバック）
  let kwSummary: KwSummary | undefined;
  try {
    const datasets = await listKwDatasets(projectId);
    if (datasets.length > 0) {
      // 最大 3 ファイル・1 ファイルあたり最大 200 件に絞ってトークン消費を抑制
      const capped = datasets.slice(0, 3).map((d) => ({
        ...d,
        keywords: d.keywords.slice(0, 200),
      }));
      kwSummary = buildKwSummary(capped);
    }
  } catch {
    kwSummary = undefined;
  }

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
    segment: opts?.segment,
    historicalInsights,
    kwSummary,
  };

  return { project, bundle, alerts, clarityNote, periodLabel, commonInput };
}

/** 1 ショット互換モード。cron や外部呼び出し後方互換。既定 28d・previous。 */
export async function runInsightGeneration(
  projectId: string,
  options?: {
    provider?: InsightProvider;
    window?: InsightWindowInput;
    segment?: InsightSegmentInput;
  },
): Promise<InsightRecord> {
  const provider: InsightProvider = options?.provider ?? "gemini";
  const window = coerceWindow(options?.window);
  const segment = sanitizeSegment(options?.segment);
  const { project, commonInput, bundle, periodLabel } = await buildCommonInput(projectId, window, {
    segment,
    loadHistory: true,
  });

  const generatedAtIso = new Date().toISOString();
  const sk = `${generatedAtIso}#weekly`;

  let pipeline: import("@/types/nis").InsightPipeline;
  let summary: string;
  let topPriority: { action: string; reason: string };
  let doNotDo: import("@/types/nis").InsightDoNotDo[] | undefined;
  let talkingPoints: import("@/types/nis").InsightTalkingPoints | undefined;
  let rawJoined: string;
  let modelVersion: string;
  let tokenUsage: number | undefined;

  if (provider === "claude") {
    const out = await invokeInsightClaudeBedrock(commonInput);
    pipeline = out.pipeline;
    summary = out.summary;
    topPriority = out.topPriority;
    doNotDo = out.doNotDo;
    talkingPoints = out.talkingPoints;
    rawJoined = out.rawJoined;
    modelVersion = out.modelId;
    tokenUsage = out.tokenUsage;
  } else {
    const out = await generateInsightPipeline(commonInput);
    pipeline = out.pipeline;
    summary = out.summary;
    topPriority = out.topPriority;
    doNotDo = out.doNotDo;
    talkingPoints = out.talkingPoints;
    rawJoined = out.rawJoined;
    modelVersion = out.model;
    tokenUsage = out.tokenUsage;
  }

  // B2: 差分計算
  const prev = pickPreviousInsight(commonInput.historicalInsights ?? [], generatedAtIso);
  const diffVsPrevious = computeIssueDiff(pipeline.issues, prev?.pipeline?.issues, prev?.sk);
  const upgradedIssues = upgradeSeverityForRepeated(pipeline.issues, diffVsPrevious.persistingIssueIds);
  pipeline = { ...pipeline, issues: upgradedIssues };

  const findings = deriveFindingsFromPipeline(pipeline);
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
    doNotDo,
    talkingPoints,
    diffVsPrevious,
    segment,
    comparison: window.comparison,
    previousPeriod: { start: window.prevStart, end: window.prevEnd },
  };
  await putInsight(row);
  void notifyFinalizeSlack(project.projectName, periodLabel, topPriority.action, projectId, sk).catch(() => {});
  return row;
}

/** Step 1: Facts + Issues だけを生成して Draft として永続化。 */
export async function runInsightDraft(
  projectId: string,
  window: ResolvedMetricsWindow,
  provider: InsightProvider,
  opts?: { segment?: InsightSegmentInput },
): Promise<InsightDraftRecord> {
  const segment = sanitizeSegment(opts?.segment);
  const { project, commonInput, periodLabel } = await buildCommonInput(projectId, window, {
    segment,
    loadHistory: false,
  });

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
    segment,
  };
  await putInsightDraft(row);
  void notifyDraftSlack(project.projectName, periodLabel, issues.length, projectId, draftId).catch(() => {});
  return row;
}

/** Step 2: ユーザー編集済みの Issues を入力し、Hypotheses + Actions を生成して最終保存。 */
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

  const { project, commonInput, bundle, periodLabel } = await buildCommonInput(projectId, window, {
    segment: draft.segment,
    loadHistory: true,
  });

  const issues = overrides?.editedIssues ?? draft.issues;
  const facts = draft.facts;

  const stage34Input = { ...commonInput, facts, issues };

  let pipeline: import("@/types/nis").InsightPipeline;
  let summary: string;
  let topPriority: { action: string; reason: string };
  let doNotDo: import("@/types/nis").InsightDoNotDo[] | undefined;
  let talkingPoints: import("@/types/nis").InsightTalkingPoints | undefined;
  let rawJoined: string;
  let modelVersion: string;
  let tokenUsage: number | undefined;

  if (provider === "claude") {
    const r = await invokeInsightClaudeStage34(stage34Input);
    pipeline = { facts, issues, hypotheses: r.hypotheses, actions: r.actions };
    summary = r.summary;
    topPriority = r.topPriority;
    doNotDo = r.doNotDo;
    talkingPoints = r.talkingPoints;
    rawJoined = r.rawJoined;
    modelVersion = r.modelId;
    tokenUsage = r.tokenUsage;
  } else {
    const r = await generateStage34(stage34Input);
    pipeline = { facts, issues, hypotheses: r.hypotheses, actions: r.actions };
    summary = r.summary;
    topPriority = r.topPriority;
    doNotDo = r.doNotDo;
    talkingPoints = r.talkingPoints;
    rawJoined = r.rawJoined;
    modelVersion = r.model;
    tokenUsage = r.tokenUsage;
  }

  // B2: 差分計算
  const prev = pickPreviousInsight(commonInput.historicalInsights ?? [], new Date().toISOString());
  const diffVsPrevious = computeIssueDiff(pipeline.issues, prev?.pipeline?.issues, prev?.sk);
  const upgradedIssues = upgradeSeverityForRepeated(pipeline.issues, diffVsPrevious.persistingIssueIds);
  pipeline = { ...pipeline, issues: upgradedIssues };

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
    doNotDo,
    talkingPoints,
    diffVsPrevious,
    segment: draft.segment,
    comparison: draft.comparison,
    previousPeriod: { start: draft.previousPeriod.start, end: draft.previousPeriod.end },
  };
  await putInsight(row);
  const saved = await getInsight(projectId, sk);
  if (!saved) {
    throw new Error("Insight finalized but saved record could not be read.");
  }
  if ((saved.pipeline?.hypotheses?.length ?? 0) === 0 || (saved.pipeline?.actions?.length ?? 0) === 0) {
    throw new Error("Insight finalized but hypotheses/actions are empty.");
  }
  await deleteInsightDraft(projectId, draftId).catch(() => {});
  void notifyFinalizeSlack(project.projectName, periodLabel, topPriority.action, projectId, sk).catch(() => {});
  return row;
}

async function notifyDraftSlack(
  projectName: string,
  periodLabel: string,
  issueCount: number,
  projectId: string,
  draftId: string,
): Promise<void> {
  const webhook = resolveSlackWebhook(undefined);
  if (!webhook) return;
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_BASE_URL ?? "";
  const reviewUrl = `${base}/projects/${projectId}/insights/drafts/${encodeURIComponent(draftId)}`;
  await postToSlack(
    webhook,
    buildDraftReadyMessage({ projectName, periodLabel, issueCount, reviewUrl }),
  );
}

async function notifyFinalizeSlack(
  projectName: string,
  periodLabel: string,
  topPriority: string,
  projectId: string,
  sk: string,
): Promise<void> {
  const webhook = resolveSlackWebhook(undefined);
  if (!webhook) return;
  const base = process.env.NEXT_PUBLIC_APP_BASE_URL ?? process.env.APP_BASE_URL ?? "";
  const reportUrl = `${base}/projects/${projectId}/insights/${encodeURIComponent(sk)}`;
  await postToSlack(
    webhook,
    buildFinalizeReadyMessage({ projectName, periodLabel, topPriority, reportUrl }),
  );
}
