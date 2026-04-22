import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { auth } from "@/auth";
import { getInsightDraft } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { DraftReviewForm } from "@/components/insights/draft-review-form";
import { notFound } from "next/navigation";

export default async function InsightDraftPage({
  params,
}: {
  params: Promise<{ projectId: string; draftId: string }>;
}) {
  const { projectId, draftId: rawDraftId } = await params;
  const draftId = decodeURIComponent(rawDraftId);
  const project = await getProject(projectId);
  if (!project) notFound();
  const draft = await getInsightDraft(projectId, draftId);
  if (!draft) notFound();
  const session = await auth();

  const compLabel = draft.comparison === "yoy" ? "前年同期" : "直前期間";
  const windowBadge = `今期 ${draft.period.start}〜${draft.period.end} vs ${compLabel} ${draft.previousPeriod.start}〜${draft.previousPeriod.end}`;

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Draft review — Step 2/3"
        subtitle="Stage1/2 のドラフトを確認・編集し、Step 3 で示唆・仮説と打ち手を生成します。"
        userEmail={session?.user?.email}
      />

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Badge tone="ai" className="normal-case">{windowBadge}</Badge>
        <Badge tone="neutral" className="normal-case">{draft.modelProvider === "claude" ? "Claude (Bedrock)" : "Gemini"}</Badge>
        <Badge tone="neutral" className="normal-case">Draft ID: {draft.draftId.slice(0, 19)}</Badge>
      </div>

      <Card className="mt-6 glow-border">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Stage 1 — Facts（読み取り専用）
        </div>
        <div className="mt-4 space-y-3">
          {draft.facts.length === 0 ? (
            <p className="text-sm text-slate-500">Facts が生成されませんでした。</p>
          ) : null}
          {draft.facts.map((f) => (
            <div key={f.id} className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-mono text-slate-500">{f.id}</span>
                {f.source ? (
                  <Badge tone="neutral" className="normal-case text-[10px]">
                    {f.source}
                  </Badge>
                ) : null}
              </div>
              <p className="mt-2 text-sm text-slate-200">{f.statement}</p>
              {f.metricRef || f.valueText ? (
                <p className="mt-1 text-xs text-slate-500">
                  {[f.metricRef, f.valueText].filter(Boolean).join(" · ")}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      </Card>

      <DraftReviewForm
        projectId={projectId}
        draftId={draft.draftId}
        issues={draft.issues}
        modelProvider={draft.modelProvider}
      />
    </main>
  );
}
