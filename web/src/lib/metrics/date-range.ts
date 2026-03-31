import { format, parseISO, subDays } from "date-fns";

export type RangeKey = "7d" | "30d" | "90d";

export const METRICS_MAX_RANGE_DAYS = 90;

export type ResolvedMetricsWindow = {
  start: string;
  end: string;
  /** 前期間（同じ日数・直前） */
  prevStart: string;
  prevEnd: string;
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

export function computePreviousWindow(start: string, end: string): { prevStart: string; prevEnd: string } {
  const n = daysInclusive(start, end);
  const prevEnd = format(subDays(parseISO(start), 1), "yyyy-MM-dd");
  const prevStart = format(subDays(parseISO(start), n), "yyyy-MM-dd");
  return { prevStart, prevEnd };
}

function rangeKey(raw: string | undefined): RangeKey {
  if (raw === "30d" || raw === "90d") return raw;
  return "7d";
}

function rangeDays(key: RangeKey): number {
  if (key === "7d") return 7;
  if (key === "30d") return 30;
  return 90;
}

/** API / サーバー共通: 無効クエリ時は過去 7 日にフォールバック */
export function resolveMetricsWindowOrDefault(query: {
  from?: string;
  to?: string;
  range?: string;
}): ResolvedMetricsWindow {
  const first = resolveMetricsWindow(query);
  if (first.ok) return first.window;
  const second = resolveMetricsWindow({ range: "7d" });
  if (!second.ok) throw new Error("metrics window default");
  return second.window;
}

/** URL クエリから分析ウィンドウを決定。`from`+`to` が有効なら優先、否则 `range`（既定 7d）。 */
export function resolveMetricsWindow(query: {
  from?: string;
  to?: string;
  range?: string;
}): { ok: true; window: ResolvedMetricsWindow } | { ok: false; error: string } {
  const today = todayStr();
   
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
    const { prevStart, prevEnd } = computePreviousWindow(start, end);
    return {
      ok: true,
      window: { start, end, prevStart, prevEnd, source: "custom" },
    };
  }

  const preset = rangeKey(query.range);
  const days = rangeDays(preset);
  const end = today;
  const start = format(subDays(new Date(), days - 1), "yyyy-MM-dd");
  const { prevStart, prevEnd } = computePreviousWindow(start, end);
  return {
    ok: true,
    window: { start, end, prevStart, prevEnd, source: "preset", preset },
  };
}

/** タブ等で URL を組み立てる */
export function buildIntelligenceSearchParams(opts: {
  view?: string;
  range?: RangeKey;
  from?: string;
  to?: string;
}): string {
  const p = new URLSearchParams();
  if (opts.view && opts.view !== "global") p.set("view", opts.view);
  if (opts.from && opts.to) {
    p.set("from", opts.from);
    p.set("to", opts.to);
  } else if (opts.range && opts.range !== "7d") {
    p.set("range", opts.range);
  }
  const s = p.toString();
  return s ? `?${s}` : "";
}

/** Intelligence 画面の `?view=&from=&to=` または `?range=` */
export function buildIntelligenceQuery(w: ResolvedMetricsWindow, view?: string): string {
  if (w.source === "custom") {
    return buildIntelligenceSearchParams({ view, from: w.start, to: w.end });
  }
  return buildIntelligenceSearchParams({ view, range: w.preset ?? "7d" });
}

/** Clarity 詳細ページなど（view なし）の `?from=&to=` / `?range=` */
export function buildMetricsRangeQuery(w: ResolvedMetricsWindow): string {
  if (w.source === "custom") {
    return buildIntelligenceSearchParams({ from: w.start, to: w.end });
  }
  return buildIntelligenceSearchParams({ range: w.preset ?? "7d" });
}
