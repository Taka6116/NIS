import { putInsight } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { generateInsightPipeline } from "@/lib/integrations/gemini";
import { runRules } from "@/lib/insights/rules";
import { deriveFindingsFromPipeline } from "@/lib/insights/pipeline";
import { getMetricsBundle } from "@/lib/metrics/aggregate";
import type { InsightRecord } from "@/types/nis";

export async function runInsightGeneration(projectId: string): Promise<InsightRecord> {
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

  const result = await generateInsightPipeline({
    projectName: project.projectName,
    domain: project.domain,
    periodLabel: `${bundle.range.start} 〜 ${bundle.range.end}`,
    current: bundle.current,
    previous: bundle.previous,
    change: bundle.change as unknown as Record<string, number>,
    alerts,
    clarityNote,
  });

  const generatedAtIso = new Date().toISOString();
  const sk = `${generatedAtIso}#weekly`;

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
    rawPrompt: result.rawJoined.slice(0, 12000),
    modelVersion: result.model,
    tokenUsage: result.tokenUsage,
    generatedAtIso,
  };

  await putInsight(row);

  return row;
}
