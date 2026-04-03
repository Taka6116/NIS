"use client";

import type { PriorityLevel, ScoredKeyword } from "@/types/nis";
import { getCategoryCounts } from "@/lib/ahrefs/analyzer";

type Props = {
  data: ScoredKeyword[];
  selectedPriority: "all" | PriorityLevel;
  onPriorityChange: (v: "all" | PriorityLevel) => void;
  selectedCategory: string;
  onCategoryChange: (v: string) => void;
};

const PRIORITY_OPTIONS: { value: "all" | PriorityLevel; label: string }[] = [
  { value: "all", label: "すべて" },
  { value: 3, label: "★★★ 即攻め" },
  { value: 2, label: "★★ 有望" },
  { value: 1, label: "★ 余力" },
  { value: 0, label: "対象外" },
];

function Pill({
  active,
  onClick,
  children,
  count,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
        active
          ? "bg-cyan-500/20 text-cyan-200 ring-1 ring-cyan-400/30"
          : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200"
      }`}
    >
      {children}
      {count !== undefined && <span className="text-[10px] opacity-60">({count})</span>}
    </button>
  );
}

export function KwFilterPills(props: Props) {
  const { data, selectedPriority, onPriorityChange, selectedCategory, onCategoryChange } = props;
  const catCounts = getCategoryCounts(data);
  const categories = Object.entries(catCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {PRIORITY_OPTIONS.map((opt) => {
          const count = opt.value === "all" ? data.length : data.filter((k) => k.priority === opt.value).length;
          return (
            <Pill
              key={String(opt.value)}
              active={selectedPriority === opt.value}
              onClick={() => onPriorityChange(opt.value)}
              count={count}
            >
              {opt.label}
            </Pill>
          );
        })}
      </div>
      {categories.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <Pill active={selectedCategory === "all"} onClick={() => onCategoryChange("all")} count={data.length}>
            すべて
          </Pill>
          {categories.map(([cat, cnt]) => (
            <Pill key={cat} active={selectedCategory === cat} onClick={() => onCategoryChange(cat)} count={cnt}>
              {cat}
            </Pill>
          ))}
        </div>
      )}
    </div>
  );
}
