import { queryClarityByProject } from "@/lib/dynamodb/repositories/metrics";
import type { ClarityDailyRow } from "@/types/nis";

function inRange(dateStr: string, start: string, end: string) {
  return dateStr >= start && dateStr <= end;
}

function isClarityPageRow(r: ClarityDailyRow): boolean {
  if (r.rowKind === "page") return true;
  if (r.rowKind === "summary" || r.rowKind === "referrer" || r.rowKind === "device" || r.rowKind === "geo") {
    return false;
  }
  return Boolean(r.url && r.url !== "(project-summary)");
}

async function loadClarityInWindow(projectId: string, start: string, end: string): Promise<ClarityDailyRow[]> {
  const all = await queryClarityByProject(projectId);
  return all.filter((r) => inRange(r.date, start, end));
}

export type ClarityUrlBreakdownRow = {
  url: string;
  traffic: number;
  deadClickCount: number;
  rageClickCount: number;
  scriptErrorCount: number;
  quickbackCount: number;
  excessiveScrollCount: number;
  /** API 値の合計（秒相当の指標として表示） */
  engagementTimeTotal: number;
  /** traffic 加重平均 */
  scrollDepthWeighted: number;
};

/** 期間内の Clarity 行を URL 単位に集計（テーブル表示用） */
export async function getClarityUrlBreakdownForDates(
  projectId: string,
  start: string,
  end: string,
): Promise<ClarityUrlBreakdownRow[]> {
  const rows = (await loadClarityInWindow(projectId, start, end)).filter(isClarityPageRow);
  const byUrl = new Map<
    string,
    {
      traffic: number;
      deadClickCount: number;
      rageClickCount: number;
      scriptErrorCount: number;
      quickbackCount: number;
      excessiveScrollCount: number;
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
        quickbackCount: 0,
        excessiveScrollCount: 0,
        engagementTimeTotal: 0,
        scrollWeight: 0,
        scrollWeightedSum: 0,
      };
    cur.traffic += r.traffic || 0;
    cur.deadClickCount += r.deadClickCount;
    cur.rageClickCount += r.rageClickCount;
    cur.scriptErrorCount += r.scriptErrorCount;
    cur.quickbackCount += r.quickbackCount ?? 0;
    cur.excessiveScrollCount += r.excessiveScrollCount ?? 0;
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
      quickbackCount: v.quickbackCount,
      excessiveScrollCount: v.excessiveScrollCount,
      engagementTimeTotal: v.engagementTimeTotal,
      scrollDepthWeighted: v.scrollWeight > 0 ? v.scrollWeightedSum / v.scrollWeight : 0,
    }))
    .sort((a, b) => b.traffic - a.traffic);
}

export type ClarityReferrerBreakdownRow = { referrer: string; visits: number };

export async function getClarityReferrerBreakdownForDates(
  projectId: string,
  start: string,
  end: string,
): Promise<ClarityReferrerBreakdownRow[]> {
  const rows = (await loadClarityInWindow(projectId, start, end)).filter((r) => r.rowKind === "referrer");
  const byRef = new Map<string, number>();
  for (const r of rows) {
    const k = r.referrer ?? "(unknown)";
    byRef.set(k, (byRef.get(k) ?? 0) + r.traffic);
  }
  return [...byRef.entries()]
    .map(([referrer, visits]) => ({ referrer, visits }))
    .sort((a, b) => b.visits - a.visits);
}
