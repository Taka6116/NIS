import { cn } from "@/lib/utils";
import type { ButtonHTMLAttributes } from "react";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "outline";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      type="button"
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/50 disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "btn-gradient text-slate-950 shadow-lg shadow-cyan-500/15",
        variant === "secondary" &&
          "bg-violet-500/20 text-violet-200 ring-1 ring-violet-400/30 hover:bg-violet-500/25",
        variant === "outline" &&
          "border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10",
        variant === "ghost" && "text-slate-300 hover:bg-white/5 hover:text-white",
        className,
      )}
      {...props}
    />
  );
}
