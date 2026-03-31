"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fbbf24", "#f97316", "#94a3b8", "#ec4899", "#38bdf8"];

export type ChannelMixSlice = { name: string; value: number; sessions: number; conversions: number };

export function ChannelMixPie({ data }: { data: ChannelMixSlice[] }) {
  if (!data.length) {
    return <p className="py-12 text-center text-sm text-slate-500">チャネル別のデータがありません。</p>;
  }

  return (
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="sessions"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={56}
            outerRadius={96}
            paddingAngle={2}
            stroke="rgba(15,20,29,0.9)"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "#111827",
              border: "1px solid rgba(34,211,238,0.25)",
              borderRadius: 12,
            }}
            formatter={(value: number, _name, props) => {
              const payload = props?.payload as ChannelMixSlice | undefined;
              const pct = payload?.value ?? 0;
              return [`${value.toLocaleString()} セッション（${pct}%）`, payload?.name ?? ""];
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, color: "#94a3b8" }}
            formatter={(value) => <span className="text-slate-300">{value}</span>}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
