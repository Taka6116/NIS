import { Card } from "@/components/ui/card";
import { formatPercentChange } from "@/lib/utils";

type Props = {
  sessions: number;
  conversions: number;
  impressions: number;
  avgPosition: number;
  change: {
    sessions: number;
    conversions: number;
    impressions: number;
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

export function KpiCards({ sessions, conversions, impressions, avgPosition, change }: Props) {
  const items = [
    {
      title: "Sessions",
      value: sessions.toLocaleString(),
      delta: change.sessions,
      positive: change.sessions >= 0,
    },
    {
      title: "Conversion (events)",
      value: String(conversions),
      delta: change.conversions,
      positive: change.conversions >= 0,
    },
    {
      title: "Impressions",
      value: impressions.toLocaleString(),
      delta: change.impressions,
      positive: change.impressions >= 0,
    },
    {
      title: "Avg. position",
      value: avgPosition.toFixed(1),
      delta: -change.avgPosition,
      positive: change.avgPosition <= 0,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {items.map((k) => (
        <Card key={k.title} className="glow-border/50 relative overflow-hidden">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{k.title}</div>
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
