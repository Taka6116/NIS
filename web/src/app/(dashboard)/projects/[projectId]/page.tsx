import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { KpiCards } from "@/components/dashboard/kpi-cards";
import { IntelligenceChartTabs } from "@/components/dashboard/intelligence-chart-tabs";
import { IntelligenceDateRange } from "@/components/dashboard/intelligence-date-range";
import { auth } from "@/auth";
import { listInsights } from "@/lib/dynamodb/repositories/insights";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import {
  getContributingFactorsForDates,
  getMetricsBundleForDates,
  getTimeseriesForDates,
} from "@/lib/metrics/aggregate";
import { buildIntelligenceQuery, resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function IntelligencePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ view?: string; from?: string; to?: string; range?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;
  const project = await getProject(projectId);
  if (!project) notFound();

  const metricsWindow = resolveMetricsWindowOrDefault({
    from: sp.from,
    to: sp.to,
    range: sp.range,
  });

  const session = await auth();
  const [bundle, contributors, insights, series] = await Promise.all([
    getMetricsBundleForDates(projectId, metricsWindow.start, metricsWindow.end),
    getContributingFactorsForDates(projectId, metricsWindow.start, metricsWindow.end),
    listInsights(projectId, 3),
    getTimeseriesForDates(projectId, "sessions", metricsWindow.start, metricsWindow.end),
  ]);

  const latest = insights[0];

  const activeTab = sp.view && ["global", "anomalies", "forecast"].includes(sp.view) ? sp.view : "global";
  const viewParam = activeTab === "global" ? "global" : activeTab;

  const tabs = [
    { id: "global", label: "Global view", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "global")}` },
    { id: "anomalies", label: "Anomalies", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "anomalies")}` },
    { id: "forecast", label: "Forecasting", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "forecast")}` },
  ];

  const activePreset =
    metricsWindow.source === "preset" ? (metricsWindow.preset ?? "7d") : null;

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="Insight engine"
        subtitle={`${project.projectName} — 主要KPIと AI インサイトのハブ`}
        tabs={tabs}
        activeTabId={activeTab}
        executeHref={`/projects/${projectId}/insights/generate`}
        userEmail={session?.user?.email}
      />

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            表示期間{" "}
            <span className="font-medium text-slate-200">
              {metricsWindow.start} 〜 {metricsWindow.end}
            </span>
            （前期間との比較は自動計算）
          </p>
        </div>
        <IntelligenceDateRange
          projectId={projectId}
          view={viewParam}
          rangeStart={metricsWindow.start}
          rangeEnd={metricsWindow.end}
          activePreset={activePreset}
        />
      </div>

      <div className="mt-8 space-y-6">
        <KpiCards
          sessions={bundle.current.sessions}
          conversions={bundle.current.conversions}
          impressions={bundle.current.impressions}
          avgPosition={bundle.current.avgPosition}
          change={{
            sessions: bundle.change.sessions,
            conversions: bundle.change.conversions,
            impressions: bundle.change.impressions,
            avgPosition: bundle.change.avgPosition,
          }}
        />

        {latest?.topPriority ? (
          <Card className="glow-border grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="ai">AI recommended</Badge>
                <span className="text-xs font-semibold text-rose-200">Critical priority</span>
              </div>
              <h2 className="mt-3 text-xl font-semibold text-white">今週の最優先アクション</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-300">{latest.topPriority.action}</p>
              <p className="mt-2 text-xs text-slate-500">{latest.topPriority.reason}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Link href={`/projects/${projectId}/insights/generate`}>
                  <Button className="rounded-xl">Run analysis</Button>
                </Link>
                <Link href={latest ? `/projects/${projectId}/insights/${encodeURIComponent(latest.sk)}` : "#"}>
                  <Button variant="outline" className="rounded-xl">
                    Review data
                  </Button>
                </Link>
              </div>
            </div>
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-cyan-500/10 via-transparent to-violet-500/10 p-6">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Insight snapshot</div>
              <p className="mt-3 text-sm text-slate-200">{latest?.summary ?? "まだインサイトがありません。Run analysis を実行してください。"}</p>
            </div>
          </Card>
        ) : (
          <Card>
            <p className="text-sm text-slate-300">
              インサイトがまだありません。右上の <span className="font-semibold text-white">Execute report</span> またはサイドバーの
              New Analysis から生成できます。
            </p>
          </Card>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
          <Card className="min-w-0">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Performance velocity</h2>
              <Badge tone="neutral">{bundle.freshnessNote.slice(0, 40)}…</Badge>
            </div>
            <p className="mt-1 text-xs text-slate-500">{bundle.freshnessNote}</p>
            <div className="mt-4">
              <IntelligenceChartTabs
                projectId={projectId}
                initialMetric="sessions"
                initialData={series.data}
                rangeStart={metricsWindow.start}
                rangeEnd={metricsWindow.end}
              />
            </div>
          </Card>

          <Card>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Clarity UX score</h2>
            <div className="mt-4 flex items-end gap-3">
              <div className="text-5xl font-semibold text-emerald-300">{bundle.clarityUx.score}</div>
              <div className="pb-1 text-xs text-slate-400">composite</div>
            </div>
            <div className="mt-4 space-y-2 text-sm text-slate-300">
              <div className="flex justify-between">
                <span>Dead clicks (est.)</span>
                <span>{(bundle.clarityUx.deadClickRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Rage clicks (est.)</span>
                <span>{(bundle.clarityUx.rageClickRate * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span>Scroll depth (avg)</span>
                <span>{bundle.clarityUx.scrollDepth.toFixed(1)}</span>
              </div>
            </div>
            <div className="mt-4 rounded-lg bg-violet-500/10 p-3 text-xs text-violet-100 ring-1 ring-violet-400/20">
              Clarity の生ヒートマップは API から取得できません。詳細確認は公式ダッシュボードへ遷移してください。
            </div>
          </Card>
        </div>

        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Contributing factors & top performers</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2">Source / Query</th>
                  <th className="py-2">Volume (clicks)</th>
                  <th className="py-2">CTR (proxy)</th>
                  <th className="py-2">Trend</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {contributors.map((c) => (
                  <tr key={c.label} className="text-slate-200">
                    <td className="py-3 font-medium">{c.label}</td>
                    <td className="py-3">{c.volume.toLocaleString()}</td>
                    <td className="py-3">{(c.conversion * 100).toFixed(2)}%</td>
                    <td className="py-3">
                      <span
                        className={
                          c.trend === "up"
                            ? "text-emerald-300"
                            : c.trend === "down"
                              ? "text-rose-300"
                              : "text-slate-400"
                        }
                      >
                        {c.trend}
                      </span>
                    </td>
                  </tr>
                ))}
                {contributors.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-6 text-slate-500">
                      データがありません。Settings から接続情報を保存し、同期を実行してください。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid gap-4 md:grid-cols-3">
          {(latest?.findings ?? []).slice(0, 3).map((f, idx) => (
            <Card key={`${f.title}-${idx}`} className="border-white/10">
              <Badge
                tone={f.severity === "high" ? "danger" : f.category === "ux" ? "success" : "neutral"}
                className="normal-case"
              >
                {f.category}
              </Badge>
              <h3 className="mt-3 text-sm font-semibold text-white">{f.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs text-slate-400">{f.observation}</p>
            </Card>
          ))}
        </div>
      </div>
    </main>
  );
}
