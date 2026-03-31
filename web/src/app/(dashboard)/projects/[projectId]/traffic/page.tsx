import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { ChannelMixPie } from "@/components/dashboard/channel-mix-pie";
import { IntelligenceDateRange } from "@/components/dashboard/intelligence-date-range";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { getChannelMixForDates, loadGa4RowsForDates } from "@/lib/metrics/aggregate";
import { buildIntelligenceQuery, resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import type { Ga4DailyRow } from "@/types/nis";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function isMainRow(r: Ga4DailyRow) {
  return r.rowType === "main" || r.rowType === undefined;
}

export default async function TrafficAnalyticsPage({
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
  const [ga4Rows, channelMix] = await Promise.all([
    loadGa4RowsForDates(projectId, metricsWindow.start, metricsWindow.end),
    getChannelMixForDates(projectId, metricsWindow.start, metricsWindow.end),
  ]);

  const mainRows = ga4Rows.filter(isMainRow);
  const channelRows = ga4Rows.filter((r) => r.rowType === "channel");

  let sessions = 0;
  let newUsers = 0;
  let conversions = 0;
  let bounceWeighted = 0;
  let engageWeighted = 0;
  let durWeighted = 0;
  let engagedSessions = 0;
  for (const r of mainRows) {
    sessions += r.sessions;
    newUsers += r.newUsers;
    conversions += r.conversions;
    bounceWeighted += r.bounceRate * r.sessions;
    engageWeighted += (r.engagementRate ?? 0) * r.sessions;
    durWeighted += (r.userEngagementDuration ?? 0) * r.sessions;
    engagedSessions += r.engagedSessions ?? 0;
  }
  const bounceRate = sessions > 0 ? bounceWeighted / sessions : 0;
  const engagementRate = sessions > 0 ? engageWeighted / sessions : 0;
  const avgDur = sessions > 0 ? durWeighted / sessions : 0;

  const bySource = new Map<
    string,
    { sessions: number; newUsers: number; engagement: number; dur: number }
  >();
  for (const r of mainRows) {
    const k = r.sourceMedium ?? "(not set)";
    const cur = bySource.get(k) ?? { sessions: 0, newUsers: 0, engagement: 0, dur: 0 };
    cur.sessions += r.sessions;
    cur.newUsers += r.newUsers;
    cur.engagement += (r.engagementRate ?? 0) * r.sessions;
    cur.dur += (r.userEngagementDuration ?? 0) * r.sessions;
    bySource.set(k, cur);
  }
  const sourceRows = [...bySource.entries()]
    .map(([sourceMedium, v]) => ({
      sourceMedium,
      sessions: v.sessions,
      newUsers: v.newUsers,
      engagementRate: v.sessions > 0 ? v.engagement / v.sessions : 0,
      avgDur: v.sessions > 0 ? v.dur / v.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 40);

  const byLanding = new Map<string, { sessions: number; bounce: number; conversions: number }>();
  for (const r of channelRows) {
    const lp = r.landingPage ?? "(not set)";
    const cur = byLanding.get(lp) ?? { sessions: 0, bounce: 0, conversions: 0 };
    cur.sessions += r.sessions;
    cur.conversions += r.conversions;
    byLanding.set(lp, cur);
  }
  const landingRows = [...byLanding.entries()]
    .map(([landingPage, v]) => ({
      landingPage,
      sessions: v.sessions,
      conversions: v.conversions,
    }))
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 40);

  const byCh = new Map<string, { sessions: number; users: number; engaged: number; er: number; conv: number }>();
  for (const r of channelRows) {
    const k = r.channelGroup ?? "(not set)";
    const cur = byCh.get(k) ?? { sessions: 0, users: 0, engaged: 0, er: 0, conv: 0 };
    cur.sessions += r.sessions;
    cur.users += r.activeUsers;
    cur.engaged += r.engagedSessions ?? 0;
    cur.er += (r.engagementRate ?? 0) * r.sessions;
    cur.conv += r.conversions;
    byCh.set(k, cur);
  }
  const channelTable = [...byCh.entries()]
    .map(([channel, v]) => ({
      channel,
      sessions: v.sessions,
      users: v.users,
      engagementRate: v.sessions > 0 ? v.er / v.sessions : 0,
      conversions: v.conv,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const viewParam = sp.view && ["global", "anomalies", "forecast"].includes(sp.view) ? sp.view : "global";
  const activePreset = metricsWindow.source === "preset" ? (metricsWindow.preset ?? "7d") : null;
  const tabs = [
    { id: "global", label: "Global view", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "global")}` },
    { id: "anomalies", label: "Anomalies", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "anomalies")}` },
    { id: "forecast", label: "Forecasting", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "forecast")}` },
  ];

  const formatDur = (sec: number) => {
    if (!Number.isFinite(sec) || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="トラフィック分析"
        subtitle={`${project.projectName} — GA4 チャネル・ランディング・流入元`}
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
          navigateBasePath={`/projects/${projectId}/traffic`}
        />
      </div>

      <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Sessions</div>
          <div className="mt-0.5 text-xs text-slate-300">セッション数</div>
          <div className="mt-2 text-2xl font-semibold text-white">{sessions.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Engagement rate</div>
          <div className="mt-0.5 text-xs text-slate-300">エンゲージメント率</div>
          <div className="mt-2 text-2xl font-semibold text-white">{(engagementRate * 100).toFixed(1)}%</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">New users</div>
          <div className="mt-0.5 text-xs text-slate-300">新規ユーザー</div>
          <div className="mt-2 text-2xl font-semibold text-white">{newUsers.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Conversions</div>
          <div className="mt-0.5 text-xs text-slate-300">コンバージョン（イベント）</div>
          <div className="mt-2 text-2xl font-semibold text-white">{conversions.toLocaleString()}</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Bounce rate</div>
          <div className="mt-0.5 text-xs text-slate-300">直帰率（セッション加重）</div>
          <div className="mt-2 text-2xl font-semibold text-white">{(bounceRate * 100).toFixed(1)}%</div>
        </Card>
        <Card>
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Avg engagement</div>
          <div className="mt-0.5 text-xs text-slate-300">ユーザー エンゲージメント時間（加重平均・秒）</div>
          <div className="mt-2 text-2xl font-semibold text-white">{formatDur(avgDur)}</div>
          <p className="mt-1 text-[10px] text-slate-500">エンゲージド セッション: {engagedSessions.toLocaleString()}</p>
        </Card>
      </div>

      <div className="mt-6">
        <Link href={`/projects/${projectId}`} className="text-xs text-cyan-300 hover:text-cyan-200">
          ← Intelligence
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">チャネル構成</h2>
          <p className="mt-1 text-xs text-slate-500">セッション数ベース</p>
          <ChannelMixPie data={channelMix} />
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">チャネル別テーブル</h2>
          <div className="mt-4 max-h-[320px] overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-[#0f141d] text-xs text-slate-500">
                <tr className="border-b border-white/10 text-slate-500">
                  <th className="py-2">チャネル</th>
                  <th className="py-2">セッション</th>
                  <th className="py-2">ユーザー</th>
                  <th className="py-2">ER%</th>
                  <th className="py-2">CV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-200">
                {channelTable.map((row) => (
                  <tr key={row.channel}>
                    <td className="py-2 font-medium">{row.channel}</td>
                    <td className="py-2">{row.sessions.toLocaleString()}</td>
                    <td className="py-2">{row.users.toLocaleString()}</td>
                    <td className="py-2">{(row.engagementRate * 100).toFixed(1)}%</td>
                    <td className="py-2">{row.conversions.toLocaleString()}</td>
                  </tr>
                ))}
                {channelTable.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      チャネル行がありません。GA4 同期を実行してください。
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">ランディングページ別</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">ランディング</th>
                <th className="py-2">セッション</th>
                <th className="py-2">コンバージョン</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {landingRows.map((row) => (
                <tr key={row.landingPage}>
                  <td className="max-w-lg truncate py-3 pr-4 font-mono text-xs" title={row.landingPage}>
                    {row.landingPage}
                  </td>
                  <td className="py-3">{row.sessions.toLocaleString()}</td>
                  <td className="py-3">{row.conversions.toLocaleString()}</td>
                </tr>
              ))}
              {landingRows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-8 text-center text-slate-500">
                    データがありません。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">流入元 / メディア</h2>
        <p className="mt-1 text-xs text-slate-500">GA4 の source / medium（メイン行の集計）</p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">Source / Medium</th>
                <th className="py-2">セッション</th>
                <th className="py-2">新規ユーザー</th>
                <th className="py-2">ER%</th>
                <th className="py-2">滞在(秒)※加重</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {sourceRows.map((row) => (
                <tr key={row.sourceMedium}>
                  <td className="max-w-md truncate py-3 pr-4" title={row.sourceMedium}>
                    {row.sourceMedium}
                  </td>
                  <td className="py-3">{row.sessions.toLocaleString()}</td>
                  <td className="py-3">{row.newUsers.toLocaleString()}</td>
                  <td className="py-3">{(row.engagementRate * 100).toFixed(1)}%</td>
                  <td className="py-3">{row.avgDur.toFixed(0)}</td>
                </tr>
              ))}
              {sourceRows.length === 0 ? (
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
    </main>
  );
}
