import type { PriorityLevel } from "@/types/nis";

const CONFIG: Record<PriorityLevel, { label: string; cls: string }> = {
  3: { label: "★★★", cls: "bg-amber-500/20 text-amber-300 ring-amber-400/30" },
  2: { label: "★★", cls: "bg-blue-500/20 text-blue-300 ring-blue-400/30" },
  1: { label: "★", cls: "bg-slate-500/20 text-slate-400 ring-slate-400/20" },
  0: { label: "−", cls: "bg-slate-800/40 text-slate-600 ring-slate-700/20" },
};

export function KwPriorityBadge({ level }: { level: PriorityLevel }) {
  const c = CONFIG[level];
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ring-1 ring-inset ${c.cls}`}>
      {c.label}
    </span>
  );
}
