"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  METRICS_MAX_RANGE_DAYS,
  buildIntelligenceSearchParams,
  type RangeKey,
} from "@/lib/metrics/date-range";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

export function IntelligenceDateRange({
  projectId,
  view,
  rangeStart,
  rangeEnd,
  activePreset,
  /** 既定 `/projects/{id}`。Clarity ページ等は `/projects/{id}/clarity` */
  navigateBasePath,
}: {
  projectId: string;
  view: string;
  rangeStart: string;
  rangeEnd: string;
  activePreset: RangeKey | null;
  navigateBasePath?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [fromVal, setFromVal] = useState(rangeStart);
  const [toVal, setToVal] = useState(rangeEnd);
  const [hint, setHint] = useState<string | null>(null);
  const [pendingPreset, setPendingPreset] = useState<RangeKey | null>(null);
  const [applyPending, setApplyPending] = useState(false);

  useEffect(() => {
    setFromVal(rangeStart);
    setToVal(rangeEnd);
    // ナビゲーション完了時にローカルのペンディング状態をクリア
    setPendingPreset(null);
    setApplyPending(false);
  }, [rangeStart, rangeEnd]);

  const viewParam = view === "global" ? undefined : view;
  const base = navigateBasePath ?? `/projects/${projectId}`;

  const goPreset = (r: RangeKey) => {
    setHint(null);
    setPendingPreset(r);
    startTransition(() => {
      const q = buildIntelligenceSearchParams({ view: viewParam, range: r });
      router.push(`${base}${q}`);
    });
  };

  const applyCustom = () => {
    setHint(null);
    if (!fromVal || !toVal) {
      setHint("開始日と終了日を入力してください。");
      return;
    }
    if (fromVal > toVal) {
      setHint("開始日は終了日以前にしてください。");
      return;
    }
    const s = new Date(`${fromVal}T12:00:00`);
    const e = new Date(`${toVal}T12:00:00`);
    const days = Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
    if (days > METRICS_MAX_RANGE_DAYS) {
      setHint(`期間は最大 ${METRICS_MAX_RANGE_DAYS} 日までです。`);
      return;
    }
    setApplyPending(true);
    startTransition(() => {
      const q = buildIntelligenceSearchParams({ view: viewParam, from: fromVal, to: toVal });
      router.push(`${base}${q}`);
    });
  };

  const presetBtn = (r: RangeKey, label: string) => {
    const active = activePreset === r;
    const loading = isPending && pendingPreset === r;
    return (
      <button
        key={r}
        type="button"
        onClick={() => goPreset(r)}
        disabled={isPending}
        className={
          active
            ? "inline-flex items-center gap-1.5 rounded-lg bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 ring-1 ring-cyan-400/40 disabled:opacity-60"
            : "inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10 disabled:opacity-60"
        }
      >
        {loading ? <LoadingSpinner variant="ring" size="xs" /> : null}
        {label}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <div className="flex flex-wrap gap-2">
        {presetBtn("7d", "過去7日")}
        {presetBtn("30d", "過去30日")}
        {presetBtn("90d", "過去90日")}
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-slate-500">開始</Label>
          <Input
            type="date"
            value={fromVal}
            onChange={(e) => setFromVal(e.target.value)}
            disabled={isPending}
            className="h-9 w-[11rem] border-white/15 bg-white/5 text-slate-100 disabled:opacity-60"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wide text-slate-500">終了</Label>
          <Input
            type="date"
            value={toVal}
            onChange={(e) => setToVal(e.target.value)}
            disabled={isPending}
            className="h-9 w-[11rem] border-white/15 bg-white/5 text-slate-100 disabled:opacity-60"
          />
        </div>
        <Button
          type="button"
          variant="secondary"
          className="h-9 min-w-[6.5rem] rounded-lg text-xs"
          onClick={applyCustom}
          disabled={isPending}
        >
          {isPending && applyPending ? (
            <>
              <LoadingSpinner variant="ring" size="xs" />
              読み込み中…
            </>
          ) : (
            "期間を適用"
          )}
        </Button>
      </div>
      {activePreset === null && !isPending ? (
        <span className="w-full text-[10px] text-slate-500 sm:w-auto">カスタム期間を表示中</span>
      ) : null}
      {isPending ? (
        <span className="flex w-full items-center gap-1.5 text-[10px] text-cyan-400 sm:w-auto">
          <LoadingSpinner variant="pulse" size="xs" />
          データを読み込んでいます…
        </span>
      ) : null}
      {hint ? <p className="w-full text-xs text-rose-300">{hint}</p> : null}
    </div>
  );
}
