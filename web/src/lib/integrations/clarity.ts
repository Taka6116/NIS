import type { ClarityDailyRow } from "@/types/nis";

type ClarityExportResponse = {
  metrics?: Array<Record<string, string | number>>;
};

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

  const json = (await res.json()) as ClarityExportResponse;
  const metrics = json.metrics ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const rows: ClarityDailyRow[] = [];

  for (let i = 0; i < metrics.length; i++) {
    const m = metrics[i] ?? {};
    const urlDim = String(m.URL ?? m.url ?? m.Page ?? `(row-${i})`).replaceAll("#", "_");
    const sk = `${today}#${urlDim.slice(0, 400)}`;
    rows.push({
      projectId: opts.projectId,
      sk,
      date: today,
      url: urlDim,
      traffic: Number(m.Traffic ?? m.traffic ?? 0),
      engagementTime: Number(m["Engagement Time"] ?? m.engagementTime ?? 0),
      scrollDepth: Number(m["Scroll Depth"] ?? m.scrollDepth ?? 0),
      deadClickCount: Number(m["Dead Click Count"] ?? m.deadClickCount ?? 0),
      rageClickCount: Number(m["Rage Click Count"] ?? m.rageClickCount ?? 0),
      scriptErrorCount: Number(m["Script Error Count"] ?? m.scriptErrorCount ?? 0),
    });
  }

  return rows;
}

export function clarityDashboardUrl(clarityProjectId: string) {
  return `https://clarity.microsoft.com/projects/view/${clarityProjectId}/`;
}
