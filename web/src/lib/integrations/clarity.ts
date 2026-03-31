import type { ClarityDailyRow } from "@/types/nis";

/* eslint-disable @typescript-eslint/no-explicit-any */
type ClarityMetricEntry = { metricName: string; information?: any[] };
/* eslint-enable @typescript-eslint/no-explicit-any */

function num(v: unknown): number {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function find(entries: ClarityMetricEntry[], name: string): Record<string, unknown> | undefined {
  return entries.find((e) => e.metricName === name)?.information?.[0] as
    | Record<string, unknown>
    | undefined;
}

function findAll(entries: ClarityMetricEntry[], name: string): Array<Record<string, unknown>> {
  const e = entries.find((m) => m.metricName === name);
  return (e?.information ?? []) as Array<Record<string, unknown>>;
}

export async function fetchClarityLiveInsights(opts: {
  projectId: string;
  clarityProjectId: string;
  token: string;
  numOfDays: 1 | 2 | 3;
}): Promise<ClarityDailyRow[]> {
  const url = new URL("https://www.clarity.ms/export-data/api/v1/project-live-insights");
  url.searchParams.set("numOfDays", String(opts.numOfDays));

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${opts.token}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Clarity API ${res.status}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  const entries: ClarityMetricEntry[] = Array.isArray(json) ? json : [];

  if (process.env.NODE_ENV === "development") {
    console.log("[Clarity] metrics:", entries.map((e) => e.metricName));
  }
  if (entries.length === 0) return [];

  const dead = find(entries, "DeadClickCount");
  const rage = find(entries, "RageClickCount");
  const scrollInfo = find(entries, "ScrollDepth");
  const trafficInfo = find(entries, "Traffic");
  const engInfo = find(entries, "EngagementTime");
  const scriptErr = find(entries, "ScriptErrorCount");
  const pages = findAll(entries, "PopularPages");

  const totalSessions = num(trafficInfo?.totalSessionCount ?? dead?.sessionsCount);
  const avgScrollDepth = num(scrollInfo?.averageScrollDepth);
  const activeTime = num(engInfo?.activeTime);
  const today = new Date().toISOString().slice(0, 10);

  const rows: ClarityDailyRow[] = [];

  rows.push({
    projectId: opts.projectId,
    sk: `${today}#(project-summary)`,
    date: today,
    url: "(project-summary)",
    traffic: totalSessions,
    engagementTime: activeTime,
    scrollDepth: avgScrollDepth,
    deadClickCount: num(dead?.subTotal),
    rageClickCount: num(rage?.subTotal),
    scriptErrorCount: num(scriptErr?.subTotal),
  });

  for (const p of pages) {
    const pageUrl = String(p.url ?? "(unknown)").replaceAll("#", "_");
    rows.push({
      projectId: opts.projectId,
      sk: `${today}#${pageUrl.slice(0, 400)}`,
      date: today,
      url: pageUrl,
      traffic: num(p.visitsCount),
      engagementTime: 0,
      scrollDepth: 0,
      deadClickCount: 0,
      rageClickCount: 0,
      scriptErrorCount: 0,
    });
  }

  return rows;
}

export function clarityDashboardUrl(clarityProjectId: string) {
  return `https://clarity.microsoft.com/projects/view/${clarityProjectId}/`;
}
