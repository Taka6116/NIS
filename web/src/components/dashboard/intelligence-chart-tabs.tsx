"use client";

import { PerformanceChart } from "@/components/dashboard/performance-chart";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useEffect, useRef, useState } from "react";

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
  const [loading, setLoading] = useState(false);
  const firstRender = useRef(true);

  useEffect(() => {
    setData(initialData);
  }, [initialData, rangeStart, rangeEnd]);

  useEffect(() => {
    // 初回レンダリングはサーバーから受け取ったデータを使う
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const q = new URLSearchParams({ metric, from: rangeStart, to: rangeEnd });
      const res = await fetch(`/api/projects/${projectId}/metrics/timeseries?${q}`);
      if (!res.ok) {
        if (!cancelled) setLoading(false);
        return;
      }
      const json = (await res.json()) as { data: { date: string; value: number }[] };
      if (!cancelled) {
        setData(json.data);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [metric, projectId, rangeStart, rangeEnd]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {(Object.keys(labels) as Metric[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            className={
              metric === m
                ? "inline-flex items-center gap-1.5 rounded-full bg-cyan-500/15 px-4 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/30"
                : "rounded-full px-4 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200"
            }
          >
            {metric === m && loading ? (
              <LoadingSpinner variant="pulse" size="xs" className="text-cyan-300" />
            ) : null}
            {labels[m]}
          </button>
        ))}
        {loading ? (
          <span className="ml-1 flex items-center gap-1 text-[10px] text-slate-500">
            <LoadingSpinner variant="ring" size="xs" className="text-slate-400" />
            読み込み中
          </span>
        ) : null}
      </div>
      <div className={`transition-opacity duration-200 ${loading ? "opacity-50" : "opacity-100"}`}>
        <PerformanceChart data={data} metricLabel={labels[metric]} />
      </div>
    </div>
  );
}
