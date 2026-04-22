import { format, parseISO, subDays, subYears, startOfMonth, startOfQuarter } from "date-fns";

export type RangeKey = "7d" | "28d" | "30d" | "90d" | "MTD" | "QTD";

export type ComparisonMode = "previous" | "yoy";

export const METRICS_MAX_RANGE_DAYS = 366;

export type ResolvedMetricsWindow = {
  start: string;
  end: string;
  /** 比較期間（同じ日数・直前 or 前年同期） */
  prevStart: string;
  prevEnd: string;
  /** 比較方法: previous = 直前期間 / yoy = 前年同期 */
  comparison: ComparisonMode;
  /** UI 表示用: プリセット経由か */
  source: "preset" | "custom";
  preset?: RangeKey;
};

const ISO = /^\d{4}-\d{2}-\d{2}$/;

function todayStr(): string {
  return format(new Date(), "yyyy-MM-dd");
}

function daysInclusive(start: string, end: string): number {
  const s = parseISO(start);
  const e = parseISO(end);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/** 直前期間の計算（同じ日数だけ前へ） */
export function computePreviousWindow(start: string, end: string): { prevStart: string; prevEnd: string } {
  const n = daysInclusive(start, end);
  const prevEnd = format(subDays(parseISO(start), 1), "yyyy-MM-dd");
  const prevStart = format(subDays(parseISO(start), n), "yyyy-MM-dd");
  return { prevStart, prevEnd };
}

/** 前年同期の計算（start/end をそれぞれ 1 年前へ） */
export function computeYoyWindow(start: string, end: string): { prevStart: string; prevEnd: string } {
  const prevStart = format(subYears(parseISO(start), 1), "yyyy-MM-dd");
  const prevEnd = format(subYears(parseISO(end), 1), "yyyy-MM-dd");
  return { prevStart, prevEnd };
}

function computeComparisonWindow(
  start: string,
  end: string,
  comparison: ComparisonMode,
): { prevStart: string; prevEnd: string } {
  return comparison === "yoy" ? computeYoyWindow(start, end) : computePreviousWindow(start, end);
}

function rangeKey(raw: string | undefined): RangeKey {
  if (raw === "7d" || raw === "28d" || raw === "30d" || raw === "90d" || raw === "MTD" || raw === "QTD") return raw;
  return "28d";
}

function comparisonKey(raw: string | undefined): ComparisonMode {
  return raw === "yoy" ? "yoy" : "previous";
}

/** プリセットから今期の開始・終了日を算出 */
function resolvePreset(preset: RangeKey): { start: string; end: string } {
  const today = todayStr();
  if (preset === "MTD") {
    return { start: format(startOfMonth(new Date()), "yyyy-MM-dd"), end: today };
  }
  if (preset === "QTD") {
    return { start: format(startOfQuarter(new Date()), "yyyy-MM-dd"), end: today };
  }
  const days = preset === "7d" ? 7 : preset === "28d" ? 28 : preset === "30d" ? 30 : 90;
  return { start: format(subDays(new Date(), days - 1), "yyyy-MM-dd"), end: today };
}

/** API / サーバー共通: 無効クエリ時は過去 28 日・直前期間比較にフォールバック */
export function resolveMetricsWindowOrDefault(query: {
  from?: string;
  to?: string;
  range?: string;
  comparison?: string;
}): ResolvedMetricsWindow {
  const first = resolveMetricsWindow(query);
  if (first.ok) return first.window;
  const second = resolveMetricsWindow({ range: "28d" });
  if (!second.ok) throw new Error("metrics window default");
  return second.window;
}

/** URL クエリ/ボディから分析ウィンドウを決定。`from`+`to` が有効なら優先、否则 `range`（既定 28d）。 */
export function resolveMetricsWindow(query: {
  from?: string;
  to?: string;
  range?: string;
  comparison?: string;
}): { ok: true; window: ResolvedMetricsWindow } | { ok: false; error: string } {
  const today = todayStr();
  const comparison = comparisonKey(query.comparison);

  if (query.from && query.to && ISO.test(query.from) && ISO.test(query.to)) {
    const start = query.from;
    let end = query.to;
    if (start > end) {
      return { ok: false, error: "from は to 以前である必要があります。" };
    }
    if (end > today) end = today;
    if (start > end) {
      return { ok: false, error: "開始日が今日より後になるため無効です。" };
    }
    const span = daysInclusive(start, end);
    if (span > METRICS_MAX_RANGE_DAYS) {
      return { ok: false, error: `期間は最大 ${METRICS_MAX_RANGE_DAYS} 日までです。` };
    }
    const { prevStart, prevEnd } = computeComparisonWindow(start, end, comparison);
    return {
      ok: true,
      window: { start, end, prevStart, prevEnd, comparison, source: "custom" },
    };
  }

  const preset = rangeKey(query.range);
  const { start, end } = resolvePreset(preset);
  const { prevStart, prevEnd } = computeComparisonWindow(start, end, comparison);
  return {
    ok: true,
    window: { start, end, prevStart, prevEnd, comparison, source: "preset", preset },
  };
}

/** タブ等で URL を組み立てる */
export function buildIntelligenceSearchParams(opts: {
  view?: string;
  range?: RangeKey;
  from?: string;
  to?: string;
  comparison?: ComparisonMode;
}): string {
  const p = new URLSearchParams();
  if (opts.view && opts.view !== "global") p.set("view", opts.view);
  if (opts.from && opts.to) {
    p.set("from", opts.from);
    p.set("to", opts.to);
  } else if (opts.range && opts.range !== "28d") {
    p.set("range", opts.range);
  }
  if (opts.comparison && opts.comparison !== "previous") {
    p.set("comparison", opts.comparison);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Intelligence 画面の `?view=&from=&to=` または `?range=` */
export function buildIntelligenceQuery(w: ResolvedMetricsWindow, view?: string): string {
  if (w.source === "custom") {
    return buildIntelligenceSearchParams({ view, from: w.start, to: w.end, comparison: w.comparison });
  }
  return buildIntelligenceSearchParams({ view, range: w.preset ?? "28d", comparison: w.comparison });
}

/** Clarity 詳細ページなど（view なし）の `?from=&to=` / `?range=` */
export function buildMetricsRangeQuery(w: ResolvedMetricsWindow): string {
  if (w.source === "custom") {
    return buildIntelligenceSearchParams({ from: w.start, to: w.end, comparison: w.comparison });
  }
  return buildIntelligenceSearchParams({ range: w.preset ?? "28d", comparison: w.comparison });
}

/** 画面・プロンプト共通の期間ラベル（例: "今期 2026-03-25〜2026-04-21 (28日) vs 前期 2026-02-25〜2026-03-24"） */
export function formatWindowLabel(w: ResolvedMetricsWindow): string {
  const days = daysInclusive(w.start, w.end);
  const label = w.comparison === "yoy" ? "前年同期" : "前期";
  return `今期 ${w.start}〜${w.end} (${days}日) vs ${label} ${w.prevStart}〜${w.prevEnd}`;
}
