"use client";

import { Cell, Pie, PieChart, ResponsiveContainer } from "recharts";

type ClarityUxDonutProps = {
  value: number;
  maxValue: number;
  label: string;
  sublabel: string;
  format: "score" | "percent";
  thresholds: [number, number];
  inverted?: boolean;
  description?: string;
};

function resolveColor(
  displayValue: number,
  thresholds: [number, number],
  inverted: boolean,
): string {
  if (inverted) {
    if (displayValue < thresholds[0]) return "#10b981";
    if (displayValue < thresholds[1]) return "#f59e0b";
    return "#f43f5e";
  }
  if (displayValue < thresholds[0]) return "#f43f5e";
  if (displayValue < thresholds[1]) return "#f59e0b";
  return "#10b981";
}

export function ClarityUxDonut({
  value,
  maxValue,
  label,
  sublabel,
  format,
  thresholds,
  inverted = false,
  description,
}: ClarityUxDonutProps) {
  const ratio = Math.min(1, Math.max(0, value / maxValue));
  const displayValue = format === "percent" ? value * 100 : value;
  const centerText =
    format === "percent"
      ? `${displayValue.toFixed(1)}%`
      : String(Math.round(displayValue));

  const color = resolveColor(displayValue, thresholds, inverted);
  const remaining = 1 - ratio;

  const data = [
    { name: "value", v: ratio },
    { name: "rest", v: remaining || 0.001 },
  ];

  return (
    <div className="flex flex-col items-center rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-0.5 text-xs font-medium text-slate-300">
        {sublabel}
      </div>

      <div className="relative mt-3 h-[120px] w-[120px]">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="v"
              cx="50%"
              cy="50%"
              innerRadius={36}
              outerRadius={52}
              startAngle={90}
              endAngle={-270}
              paddingAngle={0}
              stroke="none"
              isAnimationActive={true}
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.06)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <span
          className="absolute inset-0 flex items-center justify-center text-lg font-bold"
          style={{ color }}
        >
          {centerText}
        </span>
      </div>

      {description ? (
        <p className="mt-2 text-center text-[10px] leading-snug text-slate-500">
          {description}
        </p>
      ) : null}
    </div>
  );
}
