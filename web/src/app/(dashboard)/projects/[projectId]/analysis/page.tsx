import { AppHeader } from "@/components/layout/app-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { auth } from "@/auth";
import { listInsights } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import Link from "next/link";
import { notFound } from "next/navigation";

function formatGeneratedAt(iso: string): string {
  try {
    return new Intl.DateTimeFormat("ja-JP", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default async function AnalysisPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProject(projectId);
  if (!project) notFound();
  const session = await auth();
  const insights = await listInsights(projectId, 50);

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="分析"
        subtitle={`${project.projectName} — AI インサイトの一覧と詳細。ファクト → 課題 → 仮説 → 打ち手の 4 段階レポートをここから辿れます。`}
        executeHref={`/projects/${projectId}/insights/generate`}
        userEmail={session?.user?.email}
      />

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-slate-400">
          週次バンドルに基づく生成レポートです。KPI の前提は{" "}
          <Link href={`/projects/${projectId}`} className="text-cyan-300 hover:text-cyan-200">
            Intelligence
          </Link>{" "}
          で確認できます。
        </p>
        <Link href={`/projects/${projectId}/insights/generate`}>
          <Button className="gap-2 rounded-xl">
            <span className="text-base leading-none" aria-hidden>
              ✦
            </span>
            新しい分析を実行
          </Button>
        </Link>
      </div>

      {insights.length === 0 ? (
        <Card className="mt-8 border-dashed border-white/20 bg-white/[0.02] p-10 text-center">
          <p className="text-sm font-medium text-slate-200">まだレポートがありません</p>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
            データ同期後に「新しい分析を実行」で Gemini が 4 段階インサイトを生成し、ここに履歴が並びます。
          </p>
          <Link href={`/projects/${projectId}/insights/generate`} className="mt-6 inline-block">
            <Button className="rounded-xl">分析を開始</Button>
          </Link>
        </Card>
      ) : (
        <ul className="mt-8 space-y-4">
          {insights.map((i) => {
            const href = `/projects/${projectId}/insights/${encodeURIComponent(i.sk)}`;
            const snippet = i.summary.length > 160 ? `${i.summary.slice(0, 160)}…` : i.summary;
            return (
              <li key={i.sk}>
                <Link
                  href={href}
                  className="group block rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-400/80"
                >
                  <Card className="border-white/10 transition group-hover:border-cyan-500/35 group-hover:bg-white/[0.04]">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium text-slate-500">
                            {formatGeneratedAt(i.generatedAtIso)}
                          </span>
                          <Badge tone="neutral" className="normal-case text-[10px]">
                            {i.type}
                          </Badge>
                          {i.pipeline ? (
                            <Badge tone="ai" className="normal-case text-[10px]">
                              4 段階パイプライン
                            </Badge>
                          ) : (
                            <Badge tone="warning" className="normal-case text-[10px]">
                              従来形式
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-600">
                            {i.period.start} — {i.period.end}
                          </span>
                        </div>
                        <p className="mt-3 text-sm font-medium leading-snug text-white group-hover:text-cyan-100">
                          {snippet}
                        </p>
                        {i.topPriority?.action ? (
                          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
                            <span className="font-semibold text-slate-400">最優先: </span>
                            {i.topPriority.action}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center sm:pt-1">
                        <span className="rounded-lg border border-cyan-500/30 bg-cyan-500/5 px-3 py-2 text-xs font-medium text-cyan-100 transition group-hover:bg-cyan-500/15">
                          開く →
                        </span>
                      </div>
                    </div>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
