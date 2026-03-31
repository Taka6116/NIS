import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { IntelligenceDateRange } from "@/components/dashboard/intelligence-date-range";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { loadGscRowsForDates } from "@/lib/metrics/aggregate";
import { buildIntelligenceQuery, buildMetricsRangeQuery, resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import type { GscDailyRow } from "@/types/nis";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function isQueryRow(r: GscDailyRow) {
  return r.rowType === "query" || r.rowType === undefined;
}

export default async function SeoPerformancePage({
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
  const gscRows = await loadGscRowsForDates(projectId, metricsWindow.start, metricsWindow.end);
  const queryRows = gscRows.filter(isQueryRow);
  const deviceRows = gscRows.filter((r) => r.rowType === "device");
  const countryRows = gscRows.filter((r) => r.rowType === "country");

  const byQuery = new Map<string, { clicks: number; impressions: number; weightedPos: number }>();
  for (const r of queryRows) {
    const q = r.query ?? "(not set)";
    const cur = byQuery.get(q) ?? { clicks: 0, impressions: 0, weightedPos: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weightedPos += r.position * (r.impressions || 0);
    byQuery.set(q, cur);
  }
  const topQueries = [...byQuery.entries()]
    .map(([query, v]) => ({
      query,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weightedPos / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50);

  const byPage = new Map<string, { clicks: number; impressions: number; weightedPos: number }>();
  for (const r of queryRows) {
    const p = r.page ?? "(not set)";
    const cur = byPage.get(p) ?? { clicks: 0, impressions: 0, weightedPos: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weightedPos += r.position * (r.impressions || 0);
    byPage.set(p, cur);
  }
  const topPages = [...byPage.entries()]
    .map(([page, v]) => ({
      page,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weightedPos / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 50);

  const totalsQ = queryRows.reduce(
    (acc, r) => ({
      clicks: acc.clicks + r.clicks,
      impressions: acc.impressions + r.impressions,
      weightedPos: acc.weightedPos + r.position * (r.impressions || 0),
    }),
    { clicks: 0, impressions: 0, weightedPos: 0 },
  );
  const avgCtr = totalsQ.impressions > 0 ? totalsQ.clicks / totalsQ.impressions : 0;
  const avgPos = totalsQ.impressions > 0 ? totalsQ.weightedPos / totalsQ.impressions : 0;

  const byCountry = new Map<string, { clicks: number; impressions: number; weightedPos: number }>();
  for (const r of countryRows) {
    const k = r.country ?? "(not set)";
    const cur = byCountry.get(k) ?? { clicks: 0, impressions: 0, weightedPos: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    cur.weightedPos += r.position * (r.impressions || 0);
    byCountry.set(k, cur);
  }
  const topCountries = [...byCountry.entries()]
    .map(([country, v]) => ({
      country,
      clicks: v.clicks,
      impressions: v.impressions,
      ctr: v.impressions > 0 ? v.clicks / v.impressions : 0,
      position: v.impressions > 0 ? v.weightedPos / v.impressions : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks)
    .slice(0, 40);

  const viewParam = sp.view && ["global", "anomalies", "forecast"].includes(sp.view) ? sp.view : "global";
  const activePreset = metricsWindow.source === "preset" ? (metricsWindow.preset ?? "7d") : null;
  const tabs = [
    { id: "global", label: "Global view", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "global")}` },
    { id: "anomalies", label: "Anomalies", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "anomalies")}` },
    { id: "forecast", label: "Forecasting", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "forecast")}` },
  ];

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="SEO パフォーマンス"
        subtitle={`${project.projectName} — Search Console 詳細（クエリ・ページ・デバイス・国）`}
        tabs={tabs}
        activeTabId={viewParam}
        userEmail={session?.user?.email}
      />

      <div className="mt-6 space-y-3">
        <p className="text-xs text-slate-500">
          表示期間{" "}
          <span className="font-medium text-slate-200">
            {metricsWindow.start} 〜 {metricsWindow.end}
          </span>
        </p>
        <IntelligenceDateRange
          projectId={projectId}
          view={viewParam}
          rangeStart={metricsWindow.start}
          rangeEnd={metricsWindow.end}
          activePreset={activePreset}
          navigateBasePath={`/projects/${projectId}/seo`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Impressions</div>
          <div className="mt-0.5 text-xs text-slate-300">表示回数</div>
          <div className="mt-2 text-2xl font-semibold text-white">{totalsQ.impressions.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Clicks</div>
          <div className="mt-0.5 text-xs text-slate-300">クリック数</div>
          <div className="mt-2 text-2xl font-semibold text-white">{totalsQ.clicks.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">CTR</div>
          <div className="mt-0.5 text-xs text-slate-300">平均クリック率</div>
          <div className="mt-2 text-2xl font-semibold text-white">{(avgCtr * 100).toFixed(2)}%</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Avg position</div>
          <div className="mt-0.5 text-xs text-slate-300">平均掲載順位</div>
          <div className="mt-2 text-2xl font-semibold text-white">{avgPos.toFixed(1)}</div>
        </Card>
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-xs">
        <Link href={`/projects/${projectId}${buildMetricsRangeQuery(metricsWindow)}`} className="text-cyan-300 hover:text-cyan-200">
          Intelligence に戻る →
        </Link>
      </div>

      <Card className="mt-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">クエリ別</h2>
        <p className="mt-1 text-xs text-slate-500">検索クエリごとのパフォーマンス</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">
                  <span className="block text-slate-300">クエリ</span>
                  <span className="block text-[9px] text-slate-600">Query</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">表示回数</span>
                  <span className="block text-[9px] text-slate-600">Impressions</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">クリック</span>
                  <span className="block text-[9px] text-slate-600">Clicks</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">CTR</span>
                  <span className="block text-[9px] text-slate-600">CTR</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">平均順位</span>
                  <span className="block text-[9px] text-slate-600">Position</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {topQueries.map((row) => (
                <tr key={row.query}>
                  <td className="max-w-md truncate py-3 pr-4 font-medium" title={row.query}>
                    {row.query}
                  </td>
                  <td className="py-3">{row.impressions.toLocaleString()}</td>
                  <td className="py-3">{row.clicks.toLocaleString()}</td>
                  <td className="py-3">{(row.ctr * 100).toFixed(2)}%</td>
                  <td className="py-3">{row.position.toFixed(1)}</td>
                </tr>
              ))}
              {topQueries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    データがありません。Sources で GSC 同期を実行してください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ページ別</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">
                  <span className="block text-slate-300">ページ URL</span>
                  <span className="block text-[9px] text-slate-600">Page</span>
                </th>
                <th className="py-2">表示回数</th>
                <th className="py-2">クリック</th>
                <th className="py-2">CTR</th>
                <th className="py-2">平均順位</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {topPages.map((row) => (
                <tr key={row.page}>
                  <td className="max-w-lg truncate py-3 pr-4 font-mono text-xs" title={row.page}>
                    {row.page}
                  </td>
                  <td className="py-3">{row.impressions.toLocaleString()}</td>
                  <td className="py-3">{row.clicks.toLocaleString()}</td>
                  <td className="py-3">{(row.ctr * 100).toFixed(2)}%</td>
                  <td className="py-3">{row.position.toFixed(1)}</td>
                </tr>
              ))}
              {topPages.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    データがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">デバイス × ページ</h2>
        <p className="mt-1 text-xs text-slate-500">モバイルとデスクトップの順位差の確認に使います</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">
                  <span className="block text-slate-300">ページ</span>
                  <span className="block text-[9px] text-slate-600">Page</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">デバイス</span>
                  <span className="block text-[9px] text-slate-600">Device</span>
                </th>
                <th className="py-2">表示回数</th>
                <th className="py-2">クリック</th>
                <th className="py-2">CTR</th>
                <th className="py-2">平均順位</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {deviceRows
                .slice()
                .sort((a, b) => b.clicks - a.clicks)
                .slice(0, 80)
                .map((r) => (
                  <tr key={r.sk}>
                    <td className="max-w-md truncate py-3 pr-4 font-mono text-xs" title={r.page}>
                      {r.page}
                    </td>
                    <td className="py-3">{r.device}</td>
                    <td className="py-3">{r.impressions.toLocaleString()}</td>
                    <td className="py-3">{r.clicks.toLocaleString()}</td>
                    <td className="py-3">{(r.ctr * 100).toFixed(2)}%</td>
                    <td className="py-3">{r.position.toFixed(1)}</td>
                </tr>
                ))}
              {deviceRows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    デバイス別データがありません。同期実行後に再度ご確認ください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">国・地域別</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">国</th>
                <th className="py-2">表示回数</th>
                <th className="py-2">クリック</th>
                <th className="py-2">CTR</th>
                <th className="py-2">平均順位</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {topCountries.map((row) => (
                <tr key={row.country}>
                  <td className="py-3 pr-4">{row.country}</td>
                  <td className="py-3">{row.impressions.toLocaleString()}</td>
                  <td className="py-3">{row.clicks.toLocaleString()}</td>
                  <td className="py-3">{(row.ctr * 100).toFixed(2)}%</td>
                  <td className="py-3">{row.position.toFixed(1)}</td>
                </tr>
              ))}
              {topCountries.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">
                    国別データがありません。同期後に表示されます。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
