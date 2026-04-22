import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { detectAnomalies } from "@/lib/insights/anomaly";

export async function AnomalyCard({ projectId }: { projectId: string }) {
  const anomalies = await detectAnomalies(projectId).catch(() => []);
  if (anomalies.length === 0) {
    return (
      <Card className="border-white/10">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Anomaly spotlight
          </h2>
          <Badge tone="success">Stable</Badge>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          直近 45 日で有意な異常値（Z ≧ 2.0）は検出されていません。
        </p>
      </Card>
    );
  }

  const top = anomalies.slice(0, 4);

  return (
    <Card className="border-rose-400/20">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
            Anomaly spotlight
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Z-score 2.0 以上の日次異常値（sessions / conversions / impressions）
          </p>
        </div>
        <Badge tone="danger">{anomalies.length} 件</Badge>
      </div>
      <ul className="mt-3 space-y-2">
        {top.map((a) => (
          <li
            key={`${a.metric}-${a.date}`}
            className="flex items-center justify-between rounded-md border border-white/5 bg-white/5 px-3 py-2 text-xs"
          >
            <div>
              <span className="text-slate-400">{a.date}</span>
              <span className="ml-2 text-slate-200">{a.metric}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-slate-300">
                {a.value.toLocaleString()}{" "}
                <span className="text-slate-500">
                  (μ {a.mean.toFixed(0)})
                </span>
              </span>
              <span
                className={
                  "font-mono " + (Math.abs(a.zScore) >= 3 ? "text-rose-300" : "text-amber-300")
                }
              >
                z={a.zScore.toFixed(2)}
              </span>
              <span>{a.direction === "up" ? "↑" : "↓"}</span>
            </div>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Link href={`/projects/${projectId}/insights/generate`}>
          <Button className="h-8 rounded-lg px-3 text-xs">クイック分析を開始</Button>
        </Link>
        <Link
          href={`/projects/${projectId}/alerts`}
          className="text-[11px] text-sky-300 hover:text-sky-200"
        >
          アラート設定を見る →
        </Link>
      </div>
    </Card>
  );
}
