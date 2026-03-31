import { invokeInsightClaudeLambda } from "@/lib/integrations/claude-lambda";
import { generateInsightPipeline } from "@/lib/integrations/gemini";
import { putInsight } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { runRules } from "@/lib/insights/rules";
import { deriveFindingsFromPipeline } from "@/lib/insights/pipeline";
import { getMetricsBundle } from "@/lib/metrics/aggregate";
import type { InsightRecord } from "@/types/nis";

export type InsightProvider = "gemini" | "claude";

export async function runInsightGeneration(
  projectId: string,
  options?: { provider?: InsightProvider },
): Promise<InsightRecord> {
  const provider: InsightProvider = options?.provider ?? "gemini";
  const project = await getProject(projectId);
  if (!project) throw new Error("Project not found");

  const bundle = await getMetricsBundle(projectId, "7d");
  const alerts = runRules({
    current: bundle.current,
    previous: bundle.previous,
    change: bundle.change,
  });

  const clarityNote = bundle.clarityUx
    ? `推定UXスコア ${bundle.clarityUx.score}。Dead click 率 ${(bundle.clarityUx.deadClickRate * 100).toFixed(2)}%、Rage ${(bundle.clarityUx.rageClickRate * 100).toFixed(2)}%、Scroll depth ${bundle.clarityUx.scrollDepth.toFixed(1)}、即戻り ${bundle.clarityUx.quickbackCount}、過剰スクロール ${bundle.clarityUx.excessiveScrollCount}、ボット率 ${(bundle.clarityUx.botTrafficRate * 100).toFixed(1)}%。`
    : undefined;

  const periodLabel = `${bundle.range.start} 〜 ${bundle.range.end}`;
  const commonInput = {
    projectName: project.projectName,
    domain: project.domain,
    periodLabel,
    current: bundle.current,
    previous: bundle.previous,
    change: bundle.change as unknown as Record<string, number>,
    alerts,
    clarityNote,
  };

  const generatedAtIso = new Date().toISOString();
  const sk = `${generatedAtIso}#weekly`;

  if (provider === "claude") {
    const out = await invokeInsightClaudeLambda({
      version: 1,
      ...commonInput,
    });

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
