import { Card } from "@/components/ui/card";
import type { ScoredKeyword } from "@/types/nis";

type Props = { data: ScoredKeyword[] };

export function KwSummaryCards({ data }: Props) {
  const total = data.length;
  const p3 = data.filter((k) => k.priority === 3).length;
  const p2 = data.filter((k) => k.priority === 2).length;
  const trending = data.filter((k) => k.trend !== "stable").length;

  const cards = [
    { label: "KW 総数", value: total, accent: "text-slate-200" },
    { label: "★★★ 即攻め", value: p3, accent: "text-amber-300" },
    { label: "★★ 有望", value: p2, accent: "text-blue-300" },
    { label: "トレンド KW", value: trending, accent: "text-emerald-300" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (
        <Card key={c.label} className="flex flex-col items-center py-4">
          <span className={`text-2xl font-bold ${c.accent}`}>{c.value}</span>
          <span className="mt-1 text-[11px] text-slate-500">{c.label}</span>
        </Card>
      ))}
    </div>
  );
}
