import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { IntelligenceDateRange } from "@/components/dashboard/intelligence-date-range";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { getMetricsBundleForDates } from "@/lib/metrics/aggregate";
import { getClarityReferrerBreakdownForDates, getClarityUrlBreakdownForDates } from "@/lib/metrics/clarity-breakdown";
import { buildMetricsRangeQuery, resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import { clarityDashboardUrl } from "@/lib/integrations/clarity";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function ClarityDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ from?: string; to?: string; range?: string }>;
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
  const [bundle, breakdown, referrers] = await Promise.all([
    getMetricsBundleForDates(projectId, metricsWindow.start, metricsWindow.end),
    getClarityUrlBreakdownForDates(projectId, metricsWindow.start, metricsWindow.end),
    getClarityReferrerBreakdownForDates(projectId, metricsWindow.start, metricsWindow.end),
  ]);

  const ux = bundle.clarityUx;
  const activePreset = metricsWindow.source === "preset" ? (metricsWindow.preset ?? "7d") : null;
  const rangeHref = `/projects/${projectId}${buildMetricsRangeQuery(metricsWindow)}`;
  const refTotal = referrers.reduce((s, r) => s + r.visits, 0) || 1;

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="UX / Clarity"
        subtitle={`${project.projectName} — Microsoft Clarity の同期データ（ページ別・参照元）`}
        userEmail={session?.user?.email}
      />

      <div className="mt-6 space-y-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">
            表示期間{" "}
            <span className="font-medium text-slate-200">
              {metricsWindow.start} 〜 {metricsWindow.end}
            </span>
            <span className="ml-2 text-slate-600">·</span>
            <span className="ml-2">
              最終 Clarity 同期:{" "}
              <span className="text-slate-300">{project.lastClaritySyncAt ?? "—"}</span>
            </span>
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={rangeHref} className="text-xs text-cyan-300 hover:text-cyan-200">
              Intelligence（同じ期間）→
            </Link>
            {project.clarityProjectId ? (
              <a
                href={clarityDashboardUrl(project.clarityProjectId)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-violet-300 hover:text-violet-200"
              >
                Clarity 公式ダッシュボード（新しいタブ）
              </a>
            ) : null}
          </div>
        </div>
        <IntelligenceDateRange
          projectId={projectId}
          view="global"
          rangeStart={metricsWindow.start}
          rangeEnd={metricsWindow.end}
          activePreset={activePreset}
          navigateBasePath={`/projects/${projectId}/clarity`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Composite score</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">UX 総合スコア</div>
          <div className="mt-2 text-3xl font-semibold text-emerald-300">{ux.score}</div>
          <p className="mt-1 text-[10px] text-slate-500">100 点満点。高いほど良好</p>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Dead click</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">無反応クリック率</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{(ux.deadClickRate * 100).toFixed(2)}%</div>
          <p className="mt-1 text-[10px] text-slate-500">押しても反応がなかったクリックの割合</p>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rage click</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">連打クリック率</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{(ux.rageClickRate * 100).toFixed(2)}%</div>
          <p className="mt-1 text-[10px] text-slate-500">苛立ちによる連続クリックの割合</p>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Scroll depth</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">平均スクロール到達度</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{ux.scrollDepth.toFixed(1)}</div>
          <p className="mt-1 text-[10px] text-slate-500">ページをどこまで読んだかの平均</p>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quickback</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">即戻り件数</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{ux.quickbackCount.toLocaleString()}</div>
          <p className="mt-1 text-[10px] text-slate-500">すばやく前のページに戻った挙動</p>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Excessive scroll</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">過剰スクロール件数</div>
          <div className="mt-2 text-2xl font-semibold text-slate-100">{ux.excessiveScrollCount.toLocaleString()}</div>
          <p className="mt-1 text-[10px] text-slate-500">必要以上にスクロールしている兆候</p>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <Card>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Site traffic</div>
          <div className="mt-0.5 text-xs text-slate-300">総ページビュー（API）</div>
          <div className="mt-2 text-xl font-semibold text-white">{ux.totalPageviews.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Users</div>
          <div className="mt-0.5 text-xs text-slate-300">推定ユニークユーザー</div>
          <div className="mt-2 text-xl font-semibold text-white">{ux.distinctUsers.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase text-slate-500">Bot traffic</div>
          <div className="mt-0.5 text-xs text-slate-300">ボットセッション率（参考）</div>
          <div className="mt-2 text-xl font-semibold text-amber-200">{(ux.botTrafficRate * 100).toFixed(1)}%</div>
          <p className="mt-1 text-[10px] text-slate-500">Pages / session: {ux.pagesPerSession.toFixed(2)}</p>
        </Card>
      </div>

      <Card className="mt-6 border-violet-400/20 bg-violet-500/5">
        <p className="text-xs leading-relaxed text-violet-100/90">
          ヒートマップ・セッション録画は Data Export API では取得できません。レイアウトやインサイトの深掘りは公式ダッシュボードで確認してください。
        </p>
        <p className="mt-2 text-[10px] text-slate-500">
          Clarity API はプロジェクトあたり 1 日 10 リクエストまでです。1 回の同期で直近 3 日スナップショットを取得します。
        </p>
      </Card>

      <Card className="mt-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ページ別内訳</h2>
          <Badge tone="neutral">{breakdown.length} URLs</Badge>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Live Insights に基づく集計です。行が重複同期されている場合は数値が積み上がります。
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="text-xs tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">URL / ページ</th>
                <th className="py-2">
                  <span className="block text-slate-300">訪問数</span>
                  <span className="block text-[9px] text-slate-600">Traffic</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">無反応</span>
                  <span className="block text-[9px] text-slate-600">Dead</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">連打</span>
                  <span className="block text-[9px] text-slate-600">Rage</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">即戻り</span>
                  <span className="block text-[9px] text-slate-600">Quickback</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">過剰ｽｸﾛｰﾙ</span>
                  <span className="block text-[9px] text-slate-600">Excess</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">スクリプト</span>
                  <span className="block text-[9px] text-slate-600">Script</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">操作時間</span>
                  <span className="block text-[9px] text-slate-600">Engage</span>
                </th>
                <th className="py-2">
                  <span className="block text-slate-300">到達 %</span>
                  <span className="block text-[9px] text-slate-600">Scroll</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {breakdown.map((row) => (
                <tr key={row.url} className="text-slate-200">
                  <td className="max-w-md truncate py-3 pr-4 font-mono text-xs text-slate-300" title={row.url}>
                    {row.url}
                  </td>
                  <td className="py-3">{row.traffic.toLocaleString()}</td>
                  <td className="py-3">{row.deadClickCount.toLocaleString()}</td>
                  <td className="py-3">{row.rageClickCount.toLocaleString()}</td>
                  <td className="py-3">{row.quickbackCount.toLocaleString()}</td>
                  <td className="py-3">{row.excessiveScrollCount.toLocaleString()}</td>
                  <td className="py-3">{row.scriptErrorCount.toLocaleString()}</td>
                  <td className="py-3">{row.engagementTimeTotal.toLocaleString()}</td>
                  <td className="py-3">{row.scrollDepthWeighted.toFixed(1)}</td>
                </tr>
              ))}
              {breakdown.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 text-center text-slate-500">
                    期間内に Clarity データがありません。Settings で Project ID と API トークンを確認し、Sources で同期してください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">参照元（Referrers）</h2>
        <p className="mt-1 text-xs text-slate-500">同期レスポンスに含まれる場合のみ表示されます</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">参照元</th>
                <th className="py-2">訪問</th>
                <th className="py-2">割合</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {referrers.map((row) => (
                <tr key={row.referrer}>
                  <td className="max-w-lg truncate py-2 pr-4 font-mono text-xs" title={row.referrer}>
                    {row.referrer}
                  </td>
                  <td className="py-2">{row.visits.toLocaleString()}</td>
                  <td className="py-2">{((row.visits / refTotal) * 100).toFixed(1)}%</td>
                </tr>
              ))}
              {referrers.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    参照元データがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href={`/projects/${projectId}/sources`} className="text-cyan-300 hover:text-cyan-200">
          Sources で同期 →
        </Link>
        <Link href={`/projects/${projectId}/settings`} className="text-cyan-300 hover:text-cyan-200">
          Settings（Clarity 接続）→
        </Link>
      </div>
    </main>
  );
}
