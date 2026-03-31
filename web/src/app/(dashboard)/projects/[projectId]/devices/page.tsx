import { AppHeader } from "@/components/layout/app-header";
import { Card } from "@/components/ui/card";
import { IntelligenceDateRange } from "@/components/dashboard/intelligence-date-range";
import { auth } from "@/auth";
import { getProject } from "@/lib/dynamodb/repositories/projects";
import { loadClarityRowsForDates, loadGa4RowsForDates, loadGscRowsForDates } from "@/lib/metrics/aggregate";
import { buildIntelligenceQuery, resolveMetricsWindowOrDefault } from "@/lib/metrics/date-range";
import type { ClarityDailyRow, Ga4DailyRow, GscDailyRow } from "@/types/nis";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function sumGscDevice(rows: GscDailyRow[]) {
  const m = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rows.filter((x) => x.rowType === "device")) {
    const k = r.device ?? "(not set)";
    const cur = m.get(k) ?? { clicks: 0, impressions: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([device, v]) => ({ device, ...v }))
    .sort((a, b) => b.impressions - a.impressions);
}

function sumGscCountry(rows: GscDailyRow[]) {
  const m = new Map<string, { clicks: number; impressions: number }>();
  for (const r of rows.filter((x) => x.rowType === "country")) {
    const k = r.country ?? "(not set)";
    const cur = m.get(k) ?? { clicks: 0, impressions: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([country, v]) => ({ country, ...v }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 25);
}

function sumGa4DeviceGeo(rows: Ga4DailyRow[]) {
  const m = new Map<string, { sessions: number; users: number; bounce: number; dur: number }>();
  for (const r of rows.filter((x) => x.rowType === "deviceGeo")) {
    const k = `${r.deviceCategory ?? "?"}\t${r.country ?? "?"}`;
    const cur = m.get(k) ?? { sessions: 0, users: 0, bounce: 0, dur: 0 };
    cur.sessions += r.sessions;
    cur.users += r.activeUsers;
    cur.bounce += r.bounceRate * r.sessions;
    cur.dur += (r.userEngagementDuration ?? 0) * r.sessions;
    m.set(k, cur);
  }
  return [...m.entries()]
    .map(([key, v]) => {
      const [deviceCategory, country] = key.split("\t");
      return {
        deviceCategory,
        country,
        sessions: v.sessions,
        users: v.users,
        bounceRate: v.sessions > 0 ? v.bounce / v.sessions : 0,
        avgDur: v.sessions > 0 ? v.dur / v.sessions : 0,
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 60);
}

function sumClarityDevice(rows: ClarityDailyRow[]) {
  const m = new Map<string, number>();
  for (const r of rows.filter((x) => x.rowKind === "device")) {
    const k = [r.clarityBrowser, r.clarityDevice, r.clarityOs].filter(Boolean).join(" · ") || "(unknown)";
    m.set(k, (m.get(k) ?? 0) + r.traffic);
  }
  return [...m.entries()]
    .map(([label, visits]) => ({ label, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 40);
}

function sumClarityGeo(rows: ClarityDailyRow[]) {
  const m = new Map<string, number>();
  for (const r of rows.filter((x) => x.rowKind === "geo")) {
    const k = r.clarityDevice ?? "(unknown)";
    m.set(k, (m.get(k) ?? 0) + r.traffic);
  }
  return [...m.entries()]
    .map(([country, visits]) => ({ country, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 25);
}

export default async function DevicesGeoPage({
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
  const [gscRows, ga4Rows, clarityRows] = await Promise.all([
    loadGscRowsForDates(projectId, metricsWindow.start, metricsWindow.end),
    loadGa4RowsForDates(projectId, metricsWindow.start, metricsWindow.end),
    loadClarityRowsForDates(projectId, metricsWindow.start, metricsWindow.end),
  ]);

  const gscDevices = sumGscDevice(gscRows);
  const gscCountries = sumGscCountry(gscRows);
  const ga4Dg = sumGa4DeviceGeo(ga4Rows);
  const clarityDev = sumClarityDevice(clarityRows);
  const clarityGeo = sumClarityGeo(clarityRows);

  const gscCountryByName = new Map(gscCountries.map((c) => [c.country, c]));
  const ga4CountryAgg = ga4Rows
    .filter((r) => r.rowType === "deviceGeo")
    .reduce((acc, r) => {
      const k = r.country ?? "(not set)";
      const cur = acc.get(k) ?? 0;
      acc.set(k, cur + r.sessions);
      return acc;
    }, new Map<string, number>());
  const clarityGeoMap = new Map(clarityGeo.map((c) => [c.country, c.visits]));

  const unionCountries = new Set<string>([
    ...gscCountries.map((c) => c.country),
    ...ga4CountryAgg.keys(),
    ...clarityGeoMap.keys(),
  ]);
  const crossCountry = [...unionCountries]
    .map((country) => ({
      country,
      gscImpr: gscCountryByName.get(country)?.impressions ?? 0,
      gscClicks: gscCountryByName.get(country)?.clicks ?? 0,
      ga4Sessions: ga4CountryAgg.get(country) ?? 0,
      clarityVisits: clarityGeoMap.get(country) ?? 0,
    }))
    .sort((a, b) => b.gscImpr + b.ga4Sessions - (a.gscImpr + a.ga4Sessions))
    .slice(0, 30);

  const viewParam = sp.view && ["global", "anomalies", "forecast"].includes(sp.view) ? sp.view : "global";
  const activePreset = metricsWindow.source === "preset" ? (metricsWindow.preset ?? "7d") : null;
  const tabs = [
    { id: "global", label: "Global view", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "global")}` },
    { id: "anomalies", label: "Anomalies", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "anomalies")}` },
    { id: "forecast", label: "Forecasting", href: `/projects/${projectId}${buildIntelligenceQuery(metricsWindow, "forecast")}` },
  ];

  const totalGscDevImp = gscDevices.reduce((s, x) => s + x.impressions, 0) || 1;

  return (
    <main className="min-w-0 flex-1 p-8">
      <AppHeader
        title="デバイス & 地域"
        subtitle={`${project.projectName} — GSC / GA4 / Clarity のクロスビュー`}
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
          navigateBasePath={`/projects/${projectId}/devices`}
        />
      </div>

      <div className="mt-6">
        <Link href={`/projects/${projectId}`} className="text-xs text-cyan-300 hover:text-cyan-200">
          ← Intelligence
        </Link>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">GSC デバイス別</h2>
          <p className="mt-1 text-xs text-slate-500">表示回数の割合</p>
          <ul className="mt-4 space-y-2 text-sm text-slate-200">
            {gscDevices.map((row) => (
              <li key={row.device} className="flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-cyan-400/80"
                    style={{ width: `${Math.min(100, (row.impressions / totalGscDevImp) * 100)}%` }}
                  />
                </div>
                <span className="w-24 shrink-0 text-xs text-slate-400">{row.device}</span>
                <span className="w-20 shrink-0 text-right tabular-nums">{row.impressions.toLocaleString()}</span>
              </li>
            ))}
            {gscDevices.length === 0 ? (
              <li className="text-slate-500">デバイス行がありません。同期後に再表示されます。</li>
            ) : null}
          </ul>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">GSC 国別（上位）</h2>
          <div className="mt-4 max-h-[280px] space-y-2 overflow-auto text-sm">
            {gscCountries.map((row) => (
              <div key={row.country} className="flex justify-between gap-2 border-b border-white/5 py-1 text-slate-200">
                <span className="truncate">{row.country}</span>
                <span className="shrink-0 tabular-nums text-slate-400">
                  {row.impressions.toLocaleString()} impr / {row.clicks} clk
                </span>
              </div>
            ))}
            {gscCountries.length === 0 ? <p className="text-slate-500">国別データなし</p> : null}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">GA4 デバイス × 国</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">デバイス</th>
                <th className="py-2 pr-4">国</th>
                <th className="py-2">セッション</th>
                <th className="py-2">ユーザー</th>
                <th className="py-2">直帰率</th>
                <th className="py-2">UE 時間(秒)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {ga4Dg.map((row) => (
                <tr key={`${row.deviceCategory}-${row.country}`}>
                  <td className="py-2 pr-4">{row.deviceCategory}</td>
                  <td className="py-2 pr-4">{row.country}</td>
                  <td className="py-2">{row.sessions.toLocaleString()}</td>
                  <td className="py-2">{row.users.toLocaleString()}</td>
                  <td className="py-2">{(row.bounceRate * 100).toFixed(1)}%</td>
                  <td className="py-2">{row.avgDur.toFixed(0)}</td>
                </tr>
              ))}
              {ga4Dg.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-slate-500">
                    deviceGeo 行がありません。同期を実行してください。
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Clarity ブラウザ / 端末</h2>
          <div className="mt-4 max-h-[300px] space-y-2 overflow-auto text-sm text-slate-200">
            {clarityDev.map((row) => (
              <div key={row.label} className="flex justify-between gap-2 border-b border-white/5 py-1">
                <span className="truncate text-xs">{row.label}</span>
                <span className="shrink-0 tabular-nums">{row.visits.toLocaleString()}</span>
              </div>
            ))}
            {clarityDev.length === 0 ? <p className="text-slate-500">Clarity の端末内訳がありません。</p> : null}
          </div>
        </Card>
        <Card>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">Clarity 国・地域</h2>
          <div className="mt-4 max-h-[300px] space-y-2 overflow-auto text-sm text-slate-200">
            {clarityGeo.map((row) => (
              <div key={row.country} className="flex justify-between gap-2 border-b border-white/5 py-1">
                <span>{row.country}</span>
                <span className="tabular-nums text-slate-400">{row.visits.toLocaleString()}</span>
              </div>
            ))}
            {clarityGeo.length === 0 ? <p className="text-slate-500">データなし</p> : null}
          </div>
        </Card>
      </div>

      <Card className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">国別クロス（概算）</h2>
        <p className="mt-1 text-xs text-slate-500">
          ソースごとの定義が異なるため参考値です。Clarity はスナップショットのみ反映されます。
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="text-xs text-slate-500">
              <tr>
                <th className="py-2 pr-4">国</th>
                <th className="py-2">GSC 表示</th>
                <th className="py-2">GSC クリック</th>
                <th className="py-2">GA4 セッション</th>
                <th className="py-2">Clarity 訪問</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-200">
              {crossCountry.map((row) => (
                <tr key={row.country}>
                  <td className="py-2 pr-4 font-medium">{row.country}</td>
                  <td className="py-2">{row.gscImpr.toLocaleString()}</td>
                  <td className="py-2">{row.gscClicks.toLocaleString()}</td>
                  <td className="py-2">{row.ga4Sessions.toLocaleString()}</td>
                  <td className="py-2">{row.clarityVisits.toLocaleString()}</td>
                </tr>
              ))}
              {crossCountry.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-500">
                    結合できる国データがありません。
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
