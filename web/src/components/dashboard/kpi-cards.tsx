import { Card } from "@/components/ui/card";
import { formatPercentChange } from "@/lib/utils";

type Props = {
  sessions: number;
  users: number;
  conversions: number;
  impressions: number;
  clicks: number;
  avgPosition: number;
  change: {
    sessions: number;
    users: number;
    conversions: number;
    impressions: number;
    clicks: number;
    avgPosition: number;
  };
};

function Spark({ positive }: { positive: boolean }) {
  return (
    <div className="mt-3 flex h-8 items-end gap-0.5">
      {Array.from({ length: 14 }).map((_, i) => {
        const h = 20 + ((i * 17) % 45);
        return (
          <div
            key={i}
            className="w-1 rounded-sm"
            style={{
              height: `${h}%`,
              background: positive
                ? "color-mix(in oklab, #34d399 60%, transparent)"
                : "color-mix(in oklab, #f97373 55%, transparent)",
            }}
          />
        );
      })}
    </div>
  );
}

export function KpiCards({
  sessions,
  users,
  conversions,
  impressions,
  clicks,
  avgPosition,
  change,
}: Props) {
  const items = [
    {
      titleEn: "Sessions",
      titleJa: "セッション数",
      value: sessions.toLocaleString(),
      delta: change.sessions,
      positive: change.sessions >= 0,
    },
    {
      titleEn: "Users",
      titleJa: "アクティブユーザー",
      value: users.toLocaleString(),
      delta: change.users,
      positive: change.users >= 0,
    },
    {
      titleEn: "Conversions",
      titleJa: "コンバージョン",
      value: String(conversions),
      delta: change.conversions,
      positive: change.conversions >= 0,
    },
    {
      titleEn: "Impressions",
      titleJa: "検索表示回数",
      value: impressions.toLocaleString(),
      delta: change.impressions,
      positive: change.impressions >= 0,
    },
    {
      titleEn: "Clicks",
      titleJa: "検索クリック数",
      value: clicks.toLocaleString(),
      delta: change.clicks,
      positive: change.clicks >= 0,
    },
    {
      titleEn: "Avg. position",
      titleJa: "平均掲載順位",
      value: avgPosition.toFixed(1),
      delta: -change.avgPosition,
      positive: change.avgPosition <= 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {items.map((k) => (
        <Card key={k.titleEn} className="glow-border/50 relative overflow-hidden">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{k.titleEn}</div>
          <div className="mt-0.5 text-xs font-medium text-slate-300">{k.titleJa}</div>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <div className="text-2xl font-semibold text-white">{k.value}</div>
            <div
              className={
                k.positive ? "text-xs font-semibold text-emerald-300" : "text-xs font-semibold text-rose-300"
              }
            >
              {formatPercentChange(k.delta)}
            </div>
          </div>
          <Spark positive={k.positive} />
        </Card>
      ))}
    </div>
  );
}
