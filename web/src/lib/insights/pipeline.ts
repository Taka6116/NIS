import type { InsightFinding, InsightPipeline } from "@/types/nis";

/** ダッシュボード一覧用にパイプラインから従来型 findings を合成する */
export function deriveFindingsFromPipeline(pipeline: InsightPipeline): InsightFinding[] {
  return pipeline.issues.map((issue) => {
    const hyps = pipeline.hypotheses.filter((h) => h.issueId === issue.id);
    const primaryH = hyps[0];
    const acts = pipeline.actions.filter((a) => a.issueId === issue.id);
    const actions: string[] = [];
    for (const a of acts) {
      actions.push(a.title);
      actions.push(...a.steps);
    }
    return {
      category: issue.category,
      severity: issue.severity,
      title: issue.title,
      observation: issue.description,
      hypothesis: primaryH?.statement ?? "",
      risk: "",
      actions: actions.length > 0 ? actions : ["（打ち手は Stage 4 を参照）"],
      expectedImpact: acts.map((a) => a.expectedImpact).filter(Boolean).join(" / ") || undefined,
    };
  });
}
