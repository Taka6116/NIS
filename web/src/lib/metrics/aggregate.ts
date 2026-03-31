import { addDays, format, parseISO, subDays } from "date-fns";
import { queryClarityByProject, queryGa4ByProject, queryGscByProjectAndDatePrefix } from "@/lib/dynamodb/repositories/metrics";
import type { ClarityDailyRow, Ga4DailyRow, GscDailyRow } from "@/types/nis";

export type RangeKey = "7d" | "30d" | "90d";

function rangeDays(key: RangeKey): number {
  if (key === "7d") return 7;
  if (key === "30d") return 30;
  return 90;
}

function inRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

async function loadGsc(projectId: string, start: string, end: string): Promise<GscDailyRow[]> {
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

async function loadGa4(projectId: string, start: string, end: string): Promise<Ga4DailyRow[]> {
  const all = await queryGa4ByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

async function loadClarity(projectId: string, start: string, end: string): Promise<ClarityDailyRow[]> {
  const all = await queryClarityByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

function aggregateGsc(rows: GscDailyRow[]) {
  let clicks = 0;
  let impressions = 0;
  let weightedPos = 0;
  for (const r of rows) {
    clicks += r.clicks;
    impressions += r.impressions;
    weightedPos += r.position * (r.impressions || 0);
  }
  const ctr = impressions > 0 ? clicks / impressions : 0;
  const avgPosition = impressions > 0 ? weightedPos / impressions : 0;
  return { clicks, impressions, ctr, avgPosition };
}

function aggregateGa4(rows: Ga4DailyRow[]) {
  let sessions = 0;
  let users = 0;
  let conversions = 0;
  let bounceWeighted = 0;
  for (const r of rows) {
    sessions += r.sessions;
    users += r.activeUsers;
    conversions += r.conversions;
    bounceWeighted += r.bounceRate * r.sessions;
  }
  const bounceRate = sessions > 0 ? bounceWeighted / sessions : 0;
  return { sessions, users, conversions, bounceRate };
}

function aggregateClarityUx(rows: ClarityDailyRow[]) {
  if (!rows.length) {
    return {
      deadClickRate: 0,
      rageClickRate: 0,
      scrollDepth: 0,
      score: 0,
    };
  }
  let traffic = 0;
  let dead = 0;
  let rage = 0;
  let scroll = 0;
  for (const r of rows) {
    traffic += r.traffic || 1;
    dead += r.deadClickCount;
    rage += r.rageClickCount;
    scroll += r.scrollDepth;
  }
  const deadClickRate = traffic > 0 ? dead / traffic : 0;
  const rageClickRate = traffic > 0 ? rage / traffic : 0;
  const scrollDepth = scroll / rows.length;
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(100 - deadClickRate * 200 - rageClickRate * 300 + scrollDepth * 0.2),
    ),
  );
  return { deadClickRate, rageClickRate, scrollDepth, score };
}

export type KpiSnapshot = {
  sessions: number;
  users: number;
  conversions: number;
  bounceRate: number;
  impressions: number;
  clicks: number;
  ctr: number;
  avgPosition: number;
};

export async function getMetricsBundle(projectId: string, range: RangeKey) {
  const days = rangeDays(range);
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const prevEnd = format(subDays(parseISO(start), 1), "yyyy-MM-dd");
  const prevStart = format(subDays(parseISO(start), days), "yyyy-MM-dd");

  const [gscCur, gscPrev, ga4Cur, ga4Prev, clarityCur] = await Promise.all([
    loadGsc(projectId, start, end),
    loadGsc(projectId, prevStart, prevEnd),
    loadGa4(projectId, start, end),
    loadGa4(projectId, prevStart, prevEnd),
    loadClarity(projectId, start, end),
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

export type ContributingRow = {
  label: string;
  volume: number;
  conversion: number;
  trend: "up" | "down" | "flat";
};

export async function getContributingFactors(projectId: string, range: RangeKey): Promise<ContributingRow[]> {
  const days = rangeDays(range);
  const end = format(new Date(), "yyyy-MM-dd");
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const gscRows = await loadGsc(projectId, start, end);
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
