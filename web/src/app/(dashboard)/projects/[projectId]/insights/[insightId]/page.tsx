import { AppHeader } from "@/components/layout/app-header";
import { InsightStageTabs } from "@/components/insights/insight-stage-tabs";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { getInsight } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { notFound } from "next/navigation";

export default async function InsightDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; insightId: string }>;
}) {
  const { projectId, insightId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const sk = decodeURIComponent(insightId);
  const insight = await getInsight(projectId, sk);
  if (!insight) notFound();
  const session = await auth();

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Insight detail"
        subtitle={`${insight.type} — ${insight.period.start} 〜 ${insight.period.end}${
          insight.modelProvider ? ` — ${insight.modelProvider === "claude" ? "Claude (Lambda)" : "Gemini"}${insight.modelVersion ? ` · ${insight.modelVersion}` : ""}` : ""
        }`}
        userEmail={session?.user?.email}
      />
      <Card className="mt-8 glow-border">
        <p className="text-sm leading-relaxed text-slate-200">{insight.summary}</p>
        <div className="mt-4 rounded-lg border border-white/10 bg-white/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Top priority</div>
          <p className="mt-2 text-sm text-white">{insight.topPriority.action}</p>
          <p className="mt-1 text-xs text-slate-500">{insight.topPriority.reason}</p>
        </div>
      </Card>

      {insight.pipeline ? (
        <InsightStageTabs pipeline={insight.pipeline} />
      ) : (
        <div className="mt-6 space-y-4">
          <p className="text-xs text-slate-500">
            このレポートは旧形式です。4段階パイプライン無しのまま表示しています。
          </p>
          {insight.findings.map((f) => (
            <Card key={f.title}>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ai" className="normal-case">
                  {f.category}
                </Badge>
                <Badge tone={f.severity === "high" ? "danger" : "neutral"} className="normal-case">
                  {f.severity}
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold text-white">{f.title}</h2>
              <p className="mt-2 text-sm text-slate-300">{f.observation}</p>
              <p className="mt-2 text-sm text-slate-400">仮説: {f.hypothesis}</p>
              {f.risk ? <p className="mt-2 text-sm text-rose-200/90">リスク: {f.risk}</p> : null}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-cyan-100/90">
                {f.actions.map((a) => (
                  <li key={a}>{a}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-slate-500">期待効果: {f.expectedImpact}</p>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
