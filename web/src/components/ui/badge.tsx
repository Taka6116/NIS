import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

export function Badge({
  className,
  tone = "neutral",
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: "neutral" | "success" | "warning" | "danger" | "ai" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        tone === "neutral" && "bg-white/10 text-slate-200",
        tone === "success" && "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/25",
        tone === "warning" && "bg-amber-500/15 text-amber-200 ring-1 ring-amber-400/25",
        tone === "danger" && "bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25",
        tone === "ai" && "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30",
        className,
      )}
      {...props}
    />
  );
}
