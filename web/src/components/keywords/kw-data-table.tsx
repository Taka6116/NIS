"use client";

import type { ScoredKeyword } from "@/types/nis";
import { KwPriorityBadge } from "./kw-priority-badge";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

function kdColor(kd: number): string {
  if (kd <= 30) return "#16a34a";
  if (kd <= 60) return "#ca8a04";
  return "#dc2626";
}

function TrendIcon({ trend, pct }: { trend: string; pct: number }) {
  if (trend === "up")
    return (
      <span className="inline-flex items-center gap-1 text-emerald-400">
        <TrendingUp className="size-3" />
        <span className="text-[10px]">+{pct}%</span>
      </span>
    );
  if (trend === "down")
    return (
      <span className="inline-flex items-center gap-1 text-rose-400">
        <TrendingDown className="size-3" />
        <span className="text-[10px]">{pct}%</span>
      </span>
    );
  return <Minus className="size-3 text-slate-600" />;
}

type Props = {
  data: ScoredKeyword[];
  showCount: number;
  isOrganic: boolean;
};

export function KwDataTable({ data, showCount, isOrganic }: Props) {
  const visible = data.slice(0, showCount);

  if (!visible.length) {
    return <p className="py-12 text-center text-sm text-slate-500">データがありません</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[800px] table-fixed text-left text-sm">
        <thead className="text-[11px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="py-2" style={{ width: isOrganic ? "20%" : "28%" }}>
              Keyword
            </th>
            <th className="py-2 text-right" style={{ width: "7%" }}>
              Vol
            </th>
            <th className="py-2 text-right" style={{ width: "6%" }}>
              KD
            </th>
            <th className="py-2 text-right" style={{ width: "7%" }}>
              CPC
            </th>
            {isOrganic && (
              <th className="py-2 text-right" style={{ width: "6%" }}>
                順位
              </th>
            )}
            <th className="py-2 text-center" style={{ width: "8%" }}>
              優先度
            </th>
            <th className="py-2 text-right" style={{ width: "7%" }}>
              Score
            </th>
            <th className="py-2 text-center" style={{ width: "8%" }}>
              Trend
            </th>
            <th className="py-2" style={{ width: isOrganic ? "14%" : "18%" }}>
              カテゴリ
            </th>
            {isOrganic && (
              <th className="py-2" style={{ width: "17%" }}>
                URL
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-white/5">
          {visible.map((row, i) => (
            <tr key={`${row.keyword}-${i}`} className="text-slate-200 hover:bg-white/[0.03]">
              <td className="truncate py-2.5 pr-2 font-medium">{row.keyword}</td>
              <td className="py-2.5 text-right tabular-nums">{row.volume.toLocaleString()}</td>
              <td className="py-2.5 text-right tabular-nums">
                <span style={{ color: kdColor(row.kd) }}>{row.kd}</span>
              </td>
              <td className="py-2.5 text-right tabular-nums">¥{Math.round(row.cpc).toLocaleString()}</td>
              {isOrganic && (
                <td className="py-2.5 text-right tabular-nums">{row.position ?? "—"}</td>
              )}
              <td className="py-2.5 text-center">
                <KwPriorityBadge level={row.priority} />
              </td>
              <td className="py-2.5 text-right tabular-nums">{row.opportunityScore.toFixed(1)}</td>
              <td className="py-2.5 text-center">
                <TrendIcon trend={row.trend} pct={row.trendChangePercent} />
              </td>
              <td className="truncate py-2.5 text-xs text-slate-400">{row.category}</td>
              {isOrganic && (
                <td className="truncate py-2.5 text-xs text-slate-500" title={row.url}>
                  {row.url ? new URL(row.url, "https://example.com").pathname : "—"}
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
