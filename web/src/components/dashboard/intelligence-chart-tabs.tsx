"use client";

import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { useEffect, useState } from "react";

type Metric = "sessions" | "conversions" | "impressions" | "avgPosition";

const labels: Record<Metric, string> = {
  sessions: "Sessions",
  conversions: "Conversions",
  impressions: "Impressions",
  avgPosition: "Avg. position",
};

export function IntelligenceChartTabs({
  projectId,
  initialMetric,
  initialData,
  rangeStart,
  rangeEnd,
}: {
  projectId: string;
  initialMetric: Metric;
  initialData: { date: string; value: number }[];
  rangeStart: string;
  rangeEnd: string;
}) {
  const [metric, setMetric] = useState<Metric>(initialMetric);
  const [data, setData] = useState(initialData);

  useEffect(() => {
    setData(initialData);
  }, [initialData, rangeStart, rangeEnd]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const q = new URLSearchParams({ metric, from: rangeStart, to: rangeEnd });
      const res = await fetch(`/api/projects/${projectId}/metrics/timeseries?${q}`);
      if (!res.ok) return;
      const json = (await res.json()) as { data: { date: string; value: number }[] };
      if (!cancelled) setData(json.data);
    })();
    return () => {
      cancelled = true;
    };
  }, [metric, projectId, rangeStart, rangeEnd]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {(Object.keys(labels) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={
              metric === m
                ? "rounded-full bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/30"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
            }
          >
            {labels[m]}
          </button>
        ))}
      </div>
      <PerformanceChart data={data} metricLabel={labels[metric]} />
    </div>
  );
}
