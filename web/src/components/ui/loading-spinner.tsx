"use client";

import { cn } from "@/lib/utils";

export type SpinnerVariant = "ring" | "dot" | "pulse" | "bar";
export type SpinnerSize = "xs" | "sm" | "md" | "lg";

const ringSize: Record<SpinnerSize, string> = {
  xs: "size-3 border-[1.5px]",
  sm: "size-4 border-2",
  md: "size-5 border-2",
  lg: "size-6 border-[3px]",
};

const dotSize: Record<SpinnerSize, string> = {
  xs: "size-1",
  sm: "size-1.5",
  md: "size-2",
  lg: "size-2.5",
};

const barWidth: Record<SpinnerSize, string> = {
  xs: "w-0.5",
  sm: "w-[3px]",
  md: "w-1",
  lg: "w-1.5",
};

const barMinH: Record<SpinnerSize, number> = {
  xs: 8,
  sm: 10,
  md: 14,
  lg: 18,
};

interface LoadingSpinnerProps {
  variant?: SpinnerVariant;
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function LoadingSpinner({
  variant = "ring",
  size = "sm",
  className,
  label = "読み込み中",
}: LoadingSpinnerProps) {
  if (variant === "ring") {
    return (
      <span
        role="status"
        aria-label={label}
        className={cn(
          "inline-block animate-spin rounded-full border-current border-t-transparent",
          ringSize[size],
          className,
        )}
      />
    );
  }

  if (variant === "dot") {
    return (
      <span role="status" aria-label={label} className={cn("inline-flex items-center gap-1", className)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className={cn("animate-bounce rounded-full bg-current", dotSize[size])}
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </span>
    );
  }

  if (variant === "pulse") {
    return (
      <span role="status" aria-label={label} className={cn("inline-flex items-center gap-1", className)}>
        <span
          className={cn(
            "animate-pulse rounded-full bg-current opacity-40",
            size === "xs" ? "size-2" : size === "sm" ? "size-2.5" : size === "md" ? "size-3.5" : "size-4",
          )}
        />
        <span
          className={cn(
            "animate-pulse rounded-full bg-current",
            size === "xs" ? "size-2.5" : size === "sm" ? "size-3" : size === "md" ? "size-4" : "size-5",
          )}
          style={{ animationDelay: "150ms" }}
        />
        <span
          className={cn(
            "animate-pulse rounded-full bg-current opacity-40",
            size === "xs" ? "size-2" : size === "sm" ? "size-2.5" : size === "md" ? "size-3.5" : "size-4",
          )}
          style={{ animationDelay: "300ms" }}
        />
      </span>
    );
  }

  // bar
  const heights = [40, 70, 55, 85];
  return (
    <span
      role="status"
      aria-label={label}
      className={cn("inline-flex items-end gap-0.5", className)}
    >
      {heights.map((h, i) => (
        <span
          key={i}
          className={cn("animate-pulse rounded-sm bg-current", barWidth[size])}
          style={{
            minHeight: `${barMinH[size]}px`,
            height: `${(barMinH[size] * h) / 40}px`,
            animationDelay: `${i * 100}ms`,
          }}
        />
      ))}
    </span>
  );
}
