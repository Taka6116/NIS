import { queryClarityByProject } from "@/lib/dynamodb/repositories/metrics";
import type { ClarityDailyRow } from "@/types/nis";

function inRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

export type ClarityUrlBreakdownRow = {
  url: string;
  traffic: number;
  deadClickCount: number;
  rageClickCount: number;
  scriptErrorCount: number;
  /** API 値の合計（秒相当の指標として表示） */
  engagementTimeTotal: number;
  /** traffic 加重平均 */
  scrollDepthWeighted: number;
};

async function loadClarityInWindow(projectId: string, start: string, end: string): Promise<ClarityDailyRow[]> {
  const all = await queryClarityByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

/** 期間内の Clarity 行を URL 単位に集計（テーブル表示用） */
export async function getClarityUrlBreakdownForDates(
  projectId: string,
  start: string,
  end: string,
): Promise<ClarityUrlBreakdownRow[]> {
  const rows = await loadClarityInWindow(projectId, start, end);
  const byUrl = new Map<
    string,
    {
      traffic: number;
      deadClickCount: number;
      rageClickCount: number;
      scriptErrorCount: number;
      engagementTimeTotal: number;
      scrollWeight: number;
      scrollWeightedSum: number;
    }
  >();

  for (const r of rows) {
    const key = (r.url ?? "(not set)").slice(0, 500);
    const w = Math.max(1, r.traffic || 0);
    const cur =
      byUrl.get(key) ??
      {
        traffic: 0,
        deadClickCount: 0,
        rageClickCount: 0,
        scriptErrorCount: 0,
        engagementTimeTotal: 0,
        scrollWeight: 0,
        scrollWeightedSum: 0,
      };
    cur.traffic += r.traffic || 0;
    cur.deadClickCount += r.deadClickCount;
    cur.rageClickCount += r.rageClickCount;
    cur.scriptErrorCount += r.scriptErrorCount;
    cur.engagementTimeTotal += r.engagementTime;
    cur.scrollWeight += w;
    cur.scrollWeightedSum += r.scrollDepth * w;
    byUrl.set(key, cur);
  }

  return [...byUrl.entries()]
    .map(([url, v]) => ({
      url,
      traffic: v.traffic,
      deadClickCount: v.deadClickCount,
      rageClickCount: v.rageClickCount,
      scriptErrorCount: v.scriptErrorCount,
      engagementTimeTotal: v.engagementTimeTotal,
      scrollDepthWeighted: v.scrollWeight > 0 ? v.scrollWeightedSum / v.scrollWeight : 0,
    }))
    .sort((a, b) => b.traffic - a.traffic);
}
