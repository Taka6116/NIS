import { addDays, format, parseISO, subDays } from "date-fns";
import { computePreviousWindow } from "@/lib/metrics/date-range";
import type { RangeKey } from "@/lib/metrics/date-range";
import { queryClarityByProject, queryGa4ByProject, queryGscByProjectAndDatePrefix } from "@/lib/dynamodb/repositories/metrics";
import type { ClarityDailyRow, Ga4DailyRow, GscDailyRow } from "@/types/nis";

export type { RangeKey } from "@/lib/metrics/date-range";

function rangeDays(key: RangeKey): number {
  if (key === "7d") return 7;
  if (key === "30d") return 30;
  return 90;
}

function inRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

function isGscQueryRow(r: GscDailyRow): boolean {
  return r.rowType === "query" || r.rowType === undefined;
}

function isGa4MainRow(r: Ga4DailyRow): boolean {
  return r.rowType === "main" || r.rowType === undefined;
}

function isClaritySummary(r: ClarityDailyRow): boolean {
  return r.rowKind === "summary" || r.url === "(project-summary)";
}

async function loadGscForDates(projectId: string, start: string, end: string): Promise<GscDailyRow[]> {
  const out: GscDailyRow[] = [];
  let d = parseISO(start);
  const endDate = parseISO(end);
  while (d <= endDate) {
    const prefix = format(d, "yyyy-MM-dd");
    const chunk = await queryGscByProjectAndDatePrefix(projectId, prefix);
    out.push(...chunk);
    d = addDays(d, 1);
  }
  return out.filter((r) => inRange(r.date, start, end));
}

export async function loadGscRowsForDates(projectId: string, start: string, end: string): Promise<GscDailyRow[]> {
  return loadGscForDates(projectId, start, end);
}

async function loadGa4ForDates(projectId: string, start: string, end: string): Promise<Ga4DailyRow[]> {
  const all = await queryGa4ByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

export async function loadGa4RowsForDates(projectId: string, start: string, end: string): Promise<Ga4DailyRow[]> {
  return loadGa4ForDates(projectId, start, end);
}

async function loadClarityForDates(projectId: string, start: string, end: string): Promise<ClarityDailyRow[]> {
  const all = await queryClarityByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

export async function loadClarityRowsForDates(projectId: string, start: string, end: string): Promise<ClarityDailyRow[]> {
  return loadClarityForDates(projectId, start, end);
}

function aggregateGsc(rows: GscDailyRow[]) {
  const q = rows.filter(isGscQueryRow);
  let clicks = 0;
  let impressions = 0;
  let weightedPos = 0;
  for (const r of q) {
    clicks += r.clicks;
    impressions += r.impressions;
    weightedPos += r.position * (r.impressions || 0);
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const avgPosition = impressions > 0 ? weightedPos / impressions : 0;
  return { clicks, impressions, ctr, avgPosition };
}

function aggregateGa4(rows: Ga4DailyRow[]) {
  const m = rows.filter(isGa4MainRow);
  let sessions = 0;
  let users = 0;
  let conversions = 0;
  let bounceWeighted = 0;
  let engageWeighted = 0;
  let engagedSessions = 0;
  let durWeighted = 0;
  for (const r of m) {
    sessions += r.sessions;
    users += r.activeUsers;
    conversions += r.conversions;
    bounceWeighted += r.bounceRate * r.sessions;
    const er = r.engagementRate ?? 0;
    engageWeighted += er * r.sessions;
    engagedSessions += r.engagedSessions ?? 0;
    durWeighted += (r.userEngagementDuration ?? 0) * r.sessions;
  }
  const bounceRate = sessions > 0 ? bounceWeighted / sessions : 0;
  const engagementRateAvg = sessions > 0 ? engageWeighted / sessions : 0;
  const avgUserEngagementDuration = sessions > 0 ? durWeighted / sessions : 0;
  return {
    sessions,
    users,
    conversions,
    bounceRate,
    engagementRateAvg,
    engagedSessions,
    avgUserEngagementDuration,
  };
}

export type ClarityUxAggregate = {
  deadClickRate: number;
  rageClickRate: number;
  scrollDepth: number;
  score: number;
  quickbackCount: number;
  excessiveScrollCount: number;
  botTrafficRate: number;
  totalPageviews: number;
  distinctUsers: number;
  pagesPerSession: number;
};

function aggregateClarityUx(rows: ClarityDailyRow[]): ClarityUxAggregate {
  const summary = rows.find(isClaritySummary);
  if (!summary) {
    return {
      deadClickRate: 0,
      rageClickRate: 0,
      scrollDepth: 0,
      score: 0,
      quickbackCount: 0,
      excessiveScrollCount: 0,
      botTrafficRate: 0,
      totalPageviews: 0,
      distinctUsers: 0,
      pagesPerSession: 0,
    };
  }
  const traffic = Math.max(1, summary.traffic || 1);
  const deadClickRate = summary.deadClickCount / traffic;
  const rageClickRate = summary.rageClickCount / traffic;
  const scrollDepth = summary.scrollDepth;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - deadClickRate * 200 - rageClickRate * 300 + scrollDepth * 0.2),
    ),
  );
  const bots = summary.botSessionCount ?? 0;
  const humanSessions = summary.traffic || 0;
  const botTrafficRate = bots + humanSessions > 0 ? bots / (bots + humanSessions) : 0;

  return {
    deadClickRate,
    rageClickRate,
    scrollDepth,
    score,
    quickbackCount: summary.quickbackCount ?? 0,
    excessiveScrollCount: summary.excessiveScrollCount ?? 0,
    botTrafficRate,
    totalPageviews: summary.totalPageviews ?? 0,
    distinctUsers: summary.distinctUsers ?? 0,
    pagesPerSession: summary.pagesPerSession ?? 0,
  };
}

export type KpiSnapshot = {
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number;
  engagementRate: number;
  engagedSessions: number;
  avgUserEngagementDuration: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
};

async function buildMetricsBundleFromSpans(
  projectId: string,
  start: string,
  end: string,
  prevStart: string,
  prevEnd: string,
) {
  const [gscCur, gscPrev, ga4Cur, ga4Prev, clarityCur] = await Promise.all([
    loadGscForDates(projectId, start, end),
    loadGscForDates(projectId, prevStart, prevEnd),
    loadGa4ForDates(projectId, start, end),
    loadGa4ForDates(projectId, prevStart, prevEnd),
    loadClarityForDates(projectId, start, end),
  ]);

  const gC = aggregateGsc(gscCur);
  const gP = aggregateGsc(gscPrev);
  const aC = aggregateGa4(ga4Cur);
  const aP = aggregateGa4(ga4Prev);
  const ux = aggregateClarityUx(clarityCur);

  const current: KpiSnapshot = {
    sessions: aC.sessions,
    users: aC.users,
    conversions: aC.conversions,
    bounceRate: aC.bounceRate,
    engagementRate: aC.engagementRateAvg,
    engagedSessions: aC.engagedSessions,
    avgUserEngagementDuration: aC.avgUserEngagementDuration,
    impressions: gC.impressions,
    clicks: gC.clicks,
    ctr: gC.ctr,
    avgPosition: gC.avgPosition,
  };

  const previous: KpiSnapshot = {
    sessions: aP.sessions,
    users: aP.users,
    conversions: aP.conversions,
    bounceRate: aP.bounceRate,
    engagementRate: aP.engagementRateAvg,
    engagedSessions: aP.engagedSessions,
    avgUserEngagementDuration: aP.avgUserEngagementDuration,
    impressions: gP.impressions,
    clicks: gP.clicks,
    ctr: gP.ctr,
    avgPosition: gP.avgPosition,
  };

  const pct = (cur: number, prev: number) => {
    if (prev === 0) return cur === 0 ? 0 : 100;
    return ((cur - prev) / prev) * 100;
  };

  const change = {
    sessions: pct(current.sessions, previous.sessions),
    users: pct(current.users, previous.users),
    conversions: pct(current.conversions, previous.conversions),
    bounceRate: current.bounceRate - previous.bounceRate,
    engagementRate: current.engagementRate - previous.engagementRate,
    impressions: pct(current.impressions, previous.impressions),
    clicks: pct(current.clicks, previous.clicks),
    ctr: (current.ctr - previous.ctr) * 100,
    avgPosition: current.avgPosition - previous.avgPosition,
  };

  return {
    range: { start, end, prevStart, prevEnd },
    current,
    previous,
    change,
    freshnessNote:
      "Search Console のデータは通常 2–3 日遅れます。表示は蓄積済みの最新日付に基づきます。",
    clarityUx: ux,
  };
}

/** 明示的な開始・終了日（YYYY-MM-DD）で KPI バンドルを取得 */
export async function getMetricsBundleForDates(projectId: string, start: string, end: string) {
  const { prevStart, prevEnd } = computePreviousWindow(start, end);
  return buildMetricsBundleFromSpans(projectId, start, end, prevStart, prevEnd);
}

export async function getMetricsBundle(projectId: string, range: RangeKey) {
  const days = rangeDays(range);
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const { prevStart, prevEnd } = computePreviousWindow(start, end);
  return buildMetricsBundleFromSpans(projectId, start, end, prevStart, prevEnd);
}

export type ChannelMixRow = { name: string; value: number; sessions: number; conversions: number };

/** GA4 チャネル（Default channel group）× 期間の集計 */
export async function getChannelMixForDates(projectId: string, start: string, end: string): Promise<ChannelMixRow[]> {
  const rows = (await loadGa4ForDates(projectId, start, end)).filter((r) => r.rowType === "channel");
  const by = new Map<string, { sessions: number; conversions: number }>();
  for (const r of rows) {
    const k = r.channelGroup ?? "(not set)";
    const cur = by.get(k) ?? { sessions: 0, conversions: 0 };
    cur.sessions += r.sessions;
    cur.conversions += r.conversions;
    by.set(k, cur);
  }
  const totalSessions = [...by.values()].reduce((s, v) => s + v.sessions, 0) || 1;
  return [...by.entries()]
    .map(([name, v]) => ({
      name,
      sessions: v.sessions,
      conversions: v.conversions,
      value: Math.round((v.sessions / totalSessions) * 1000) / 10,
    }))
    .sort((a, b) => b.sessions - a.sessions);
}

export type ContributingRow = {
  label: string;
  volume: number;
  conversion: number;
  trend: "up" | "down" | "flat";
};

export async function getContributingFactorsForDates(projectId: string, start: string, end: string): Promise<ContributingRow[]> {
  const gscRows = (await loadGscForDates(projectId, start, end)).filter(isGscQueryRow);
  const byQuery = new Map<string, { clicks: number; impressions: number }>();
  for (const r of gscRows) {
    const q = r.query ?? "(not set)";
    const cur = byQuery.get(q) ?? { clicks: 0, impressions: 0 };
    cur.clicks += r.clicks;
    cur.impressions += r.impressions;
    byQuery.set(q, cur);
  }
  const sorted = [...byQuery.entries()]
    .map(([label, v]) => ({
      label,
      volume: v.clicks,
      conversion: v.impressions > 0 ? v.clicks / v.impressions : 0,
      trend: "flat" as const,
    }))
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 8);
  return sorted.map((r) => ({
    ...r,
    trend: r.conversion > 0.05 ? "up" : r.conversion < 0.02 ? "down" : "flat",
  }));
}

export async function getContributingFactors(projectId: string, range: RangeKey): Promise<ContributingRow[]> {
  const days = rangeDays(range);
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  return getContributingFactorsForDates(projectId, start, end);
}

export async function getTimeseries(
  projectId: string,
  metric: "sessions" | "conversions" | "impressions" | "avgPosition",
  range: RangeKey,
) {
  const days = rangeDays(range);
  const end = new Date();
  const start = subDays(end, days - 1);
  const dates: string[] = [];
  for (let i = 0; i < days; i++) {
    dates.push(format(addDays(start, i), "yyyy-MM-dd"));
  }

  const gscAll = await Promise.all(dates.map((d) => queryGscByProjectAndDatePrefix(projectId, d)));
  const ga4All = await queryGa4ByProject(projectId);

  const byDate: Record<string, { gsc: GscDailyRow[]; ga4: Ga4DailyRow[] }> = {};
  for (const d of dates) byDate[d] = { gsc: [], ga4: [] };
  for (const chunk of gscAll) {
    for (const r of chunk) {
      if (byDate[r.date]) byDate[r.date]!.gsc.push(r);
    }
  }
  for (const r of ga4All) {
    if (byDate[r.date]) byDate[r.date]!.ga4.push(r);
  }

  const data = dates.map((d) => {
    const g = aggregateGsc(byDate[d]!.gsc);
    const a = aggregateGa4(byDate[d]!.ga4);
    let value = 0;
    if (metric === "sessions") value = a.sessions;
    if (metric === "conversions") value = a.conversions;
    if (metric === "impressions") value = g.impressions;
    if (metric === "avgPosition") value = g.avgPosition;
    return { date: d, value };
  });

  return { metric, data };
}

export async function getTimeseriesForDates(
  projectId: string,
  metric: "sessions" | "conversions" | "impressions" | "avgPosition",
  start: string,
  end: string,
) {
  const dates: string[] = [];
  let d = parseISO(start);
  const endDate = parseISO(end);
  while (d <= endDate) {
    dates.push(format(d, "yyyy-MM-dd"));
    d = addDays(d, 1);
  }

  const gscAll = await Promise.all(dates.map((day) => queryGscByProjectAndDatePrefix(projectId, day)));
  const ga4All = await queryGa4ByProject(projectId);

  const byDate: Record<string, { gsc: GscDailyRow[]; ga4: Ga4DailyRow[] }> = {};
  for (const day of dates) byDate[day] = { gsc: [], ga4: [] };
  for (const chunk of gscAll) {
    for (const r of chunk) {
      if (byDate[r.date]) byDate[r.date]!.gsc.push(r);
    }
  }
  for (const r of ga4All) {
    if (byDate[r.date]) byDate[r.date]!.ga4.push(r);
  }

  const data = dates.map((day) => {
    const g = aggregateGsc(byDate[day]!.gsc);
    const a = aggregateGa4(byDate[day]!.ga4);
    let value = 0;
    if (metric === "sessions") value = a.sessions;
    if (metric === "conversions") value = a.conversions;
    if (metric === "impressions") value = g.impressions;
    if (metric === "avgPosition") value = g.avgPosition;
    return { date: day, value };
  });

  return { metric, data };
}
